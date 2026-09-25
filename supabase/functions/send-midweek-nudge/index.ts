import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import {
  getLocalDate,
  getWeekNumber,
  toLocalDate,
  countLogsThisWeek,
} from "../_shared/statsCalculations.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ============ Time of Day Insights ============

async function getDominantTimeOfDay(supabase: any, userIds: string[]): Promise<string | null> {
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  
  const { data, error } = await supabase
    .from('activities')
    .select('activity_date')
    .in('user_id', userIds)
    .gte('activity_date', eightWeeksAgo.toISOString());
  
  if (error || !data || data.length < 3) return null;
  
  const stats = { nightOwl: 0, earlyBird: 0, lazyMorning: 0, nooner: 0, afternoon: 0, evening: 0 };
  
  data.forEach((a: any) => {
    const hour = new Date(a.activity_date).getHours();
    if (hour >= 22 || hour < 4) stats.nightOwl++;
    else if (hour >= 4 && hour < 8) stats.earlyBird++;
    else if (hour >= 8 && hour < 12) stats.lazyMorning++;
    else if (hour >= 12 && hour < 15) stats.nooner++;
    else if (hour >= 15 && hour < 18) stats.afternoon++;
    else if (hour >= 18 && hour < 22) stats.evening++;
  });
  
  const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  const [dominant, count] = entries[0];
  const total = data.length;
  
  // Only return if clearly dominant (>30% of activities)
  if (count / total < 0.3) return null;
  
  const labels: Record<string, string> = {
    nightOwl: 'nights', earlyBird: 'early mornings', lazyMorning: 'mornings',
    nooner: 'midday', afternoon: 'afternoons', evening: 'evenings'
  };
  return labels[dominant] || null;
}

const timeOfDayInsights = [
  (tod: string) => `Most of your moments lately happen in the ${tod}. Wednesday counts too.`,
  (tod: string) => `Looks like ${tod} are your thing lately. Mid-week ${tod} included.`,
  (tod: string) => `You tend to connect later in the day. No reason tonight can't count.`,
  (tod: string) => `Your recent pattern says "${tod === 'evenings' ? 'Evening Bliss' : tod}". Wednesdays qualify.`,
];

// ============ Nudge Variants ============

interface NudgeVariant {
  key: string;
  subjects: string[];
  body: string;
}

const variants: NudgeVariant[] = [
  {
    key: 'A',
    subjects: [
      "Mid-week check: want to plan something?",
      "A small plan goes a long way",
      "Two minutes of planning, that's it"
    ],
    body: `Hi you two,

Mid-week already. No need to do anything yet — but this is a great moment to plan.

A quick question for you:

Is there a night this week that could be… yours?

It doesn't have to be big.

Just agreeing on when often does most of the work.

If you want, open the app and mark the week as "planned".

Or just mention it to each other over coffee.

One small plan now = much less thinking later.

Warmly,
fiftytwoormore`
  },
  {
    key: 'B',
    subjects: [
      "Consider this a nudge",
      "A tiny signal can be enough",
      "Mid-week spark check 🔥"
    ],
    body: `Hi you two,

This is your mid-week reminder that it's okay to send a signal.

Not a proposal.

Not a performance.

Just a hint.

A look.

A text.

A "hey, maybe later this week?"

You don't need the whole plan — just enough to let the other know you're open.

If something happens later, great.

If not, you still showed up.

That counts.

— fiftytwoormore`
  },
  {
    key: 'C',
    subjects: [
      "Mid-week reminder: the bar is low",
      "This is not a productivity email",
      "One is enough (still true)"
    ],
    body: `Hi you two,

Mid-week reminder:

The bar is still low. On purpose.

One moment this week is enough.

Planned or spontaneous.

Silly or slow.

If scheduling helps — schedule.

If not — don't.

Just remember that something small beats waiting for perfect.

Weekend is closer than it looks.

Warmly,
fiftytwoormore`
  },
  {
    key: 'D',
    subjects: [
      "Your calendar called",
      "Reminder: intimacy likes calendars too",
      "Mid-week logistics (the fun kind)"
    ],
    body: `Hi you two,

This is your friendly reminder that intimacy is surprisingly good at one thing:

showing up when it's scheduled.

You don't need a full plan.

Just a window.

"Thursday after dinner?"

"Saturday morning?"

"Sometime before we fall asleep scrolling?"

Pick one. See what happens.

— fiftytwoormore`
  },
  {
    key: 'E',
    subjects: [
      "You're already covered (but still…)",
      "Mid-week bonus round?",
      "Streak safe. Extras optional."
    ],
    body: `Hi you two,

Looks like you're already covered this week.

Nicely done.

This is just a reminder that anything else this week is pure bonus.

No pressure.

No tracking obligation.

Just… options.

Enjoy the rest of the week.

— fiftytwoormore`
  }
];

function selectVariant(weekNumber: number, userId: string, logsThisWeek: number): NudgeVariant {
  // If already logged this week, always send variant E
  if (logsThisWeek > 0) {
    return variants.find(v => v.key === 'E')!;
  }
  
  // Otherwise, rotate through A-D deterministically
  const rotatingVariants = variants.filter(v => v.key !== 'E');
  const userHash = hashUserId(userId);
  const variantIndex = (weekNumber + userHash) % rotatingVariants.length;
  return rotatingVariants[variantIndex];
}

function selectSubject(variant: NudgeVariant, weekNumber: number): string {
  // Deterministic subject selection within variant
  const subjectIndex = weekNumber % variant.subjects.length;
  return variant.subjects[subjectIndex];
}

function getHtml(text: string, messageId?: string, userId?: string, emailType?: string, variantKey?: string): string {
  let ctaHtml = '';
  if (messageId && userId) {
    const trackingUrl = `https://uuijigmwkpmakltymkqe.supabase.co/functions/v1/email-click-tracker?mid=${encodeURIComponent(messageId)}&u=${encodeURIComponent(userId)}&type=${encodeURIComponent(emailType || 'midweek-nudge')}&v=${encodeURIComponent(variantKey || '')}`;
    ctaHtml = `<p style="margin-top: 24px;"><a href="${trackingUrl}" style="color: #2754C5; text-decoration: underline;">Open fiftytwoormore →</a></p>`;
  }
  
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <pre style="white-space: pre-wrap; font-family: sans-serif;">${text}</pre>
  ${ctaHtml}
</body>
</html>`;
}

function addTimeOfDayInsight(body: string, dominantToD: string | null, weekNumber: number): string {
  if (!dominantToD) return body;
  
  const insightFn = timeOfDayInsights[weekNumber % timeOfDayInsights.length];
  const insight = insightFn(dominantToD);
  
  // Add insight after the greeting
  const lines = body.split('\n');
  const insertIndex = lines.findIndex(l => l.startsWith('Hi you two')) + 2;
  lines.splice(insertIndex, 0, '', `💡 ${insight}`, '');
  
  return lines.join('\n');
}

async function logEmailSent(supabase: any, params: {
  userId: string;
  type: string;
  variantKey?: string;
  subject: string;
  weekNumber: number;
  year: number;
  messageId: string;
}) {
  const { userId, type, variantKey, subject, weekNumber, year, messageId } = params;
  
  await supabase.from('email_digest_log').insert({
    user_id: userId,
    type,
    variant_key: variantKey,
    subject,
    week_number: weekNumber,
    year,
    message_id: messageId
  });
  
  await supabase.from('email_events').insert({
    message_id: messageId,
    user_id: userId,
    type,
    variant_key: variantKey,
    event: 'sent',
    event_at: new Date().toISOString()
  });
}

// ============ Main Handler ============

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('Starting mid-week nudge email job...');
    
    // Get all couples
    const { data: couples, error: couplesError } = await supabase
      .from('couples')
      .select('id, user1_id, user2_id');
    
    if (couplesError) throw couplesError;
    
    const results: any[] = [];
    const processedUserIds = new Set<string>();
    
    // Process couples
    for (const couple of couples || []) {
      try {
        // Get both partners' profiles
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, timezone, email_digest_enabled')
          .in('user_id', [couple.user1_id, couple.user2_id]);
        
        if (profilesError || !profiles || profiles.length === 0) {
          console.log(`No profiles found for couple ${couple.id}`);
          continue;
        }
        
        // Check if at least one partner has digest enabled
        const hasDigestEnabled = profiles.some(p => p.email_digest_enabled);
        if (!hasDigestEnabled) {
          console.log(`No digest enabled for couple ${couple.id}`);
          continue;
        }
        
        // Use first partner's timezone
        const timezone = profiles[0].timezone || 'Europe/Stockholm';
        
        // Check if it's Wednesday 10:00 in their timezone
        const localDate = getLocalDate(timezone);
        const isWednesday = localDate.getDay() === 3;
        const isTargetHour = localDate.getHours() === 10;
        
        if (!isWednesday || !isTargetHour) {
          console.log(`Skipping couple ${couple.id}: Not Wednesday 10:00 in ${timezone} (day=${localDate.getDay()}, hour=${localDate.getHours()})`);
          continue;
        }
        
        const weekNumber = getWeekNumber(localDate);
        const year = localDate.getFullYear();
        
        // Check if already sent this week (type=midweek-nudge)
        const { data: existingLog } = await supabase
          .from('email_digest_log')
          .select('id')
          .eq('user_id', couple.user1_id)
          .eq('week_number', weekNumber)
          .eq('year', year)
          .eq('type', 'midweek-nudge')
          .single();
        
        if (existingLog) {
          console.log(`Already sent midweek nudge to couple ${couple.id} for week ${weekNumber}`);
          continue;
        }
        
        // Get both partners' emails
        const emails: string[] = [];
        for (const profile of profiles) {
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
          if (authUser?.user?.email) {
            emails.push(authUser.user.email);
          }
          processedUserIds.add(profile.user_id);
        }
        
        if (emails.length === 0) {
          console.log(`No emails found for couple ${couple.id}`);
          continue;
        }
        
        // Fetch activities and calculate logs this week using shared timezone-aware function
        const userIds = [couple.user1_id, couple.user2_id];
        const { data: activities } = await supabase.from('activities').select('activity_date').in('user_id', userIds);
        const logsThisWeek = countLogsThisWeek(activities || [], timezone);
        
        // Select variant and subject
        const variant = selectVariant(weekNumber, couple.user1_id, logsThisWeek);
        const subject = selectSubject(variant, weekNumber);
        
        console.log(`Couple ${couple.id}: logsThisWeek=${logsThisWeek}, variant=${variant.key}, subject="${subject}"`);
        
        // Get time of day insight
        const dominantToD = await getDominantTimeOfDay(supabase, userIds);
        
        // Generate email content with optional insight
        const plainText = addTimeOfDayInsight(variant.body, dominantToD, weekNumber);
        const html = getHtml(plainText);
        
        // Send ONE email to BOTH partners
        const emailResponse = await resend.emails.send({
          from: "fiftytwoormore <updates@fiftytwoormore.com>",
          to: emails,
          subject,
          text: plainText,
          html
        });
        
        console.log(`Nudge email sent to couple ${couple.id} (${emails.join(', ')}):`, emailResponse);
        
        if (emailResponse.error) {
          console.error(`Failed to send nudge to couple ${couple.id}:`, emailResponse.error);
          results.push({ 
            coupleId: couple.id,
            emails,
            variant: variant.key,
            success: false, 
            error: emailResponse.error.message 
          });
        } else {
          const messageId = emailResponse.data?.id;
          
          // Log successful send with variant info
          await logEmailSent(supabase, {
            userId: couple.user1_id,
            type: 'midweek-nudge',
            variantKey: variant.key,
            subject,
            weekNumber,
            year,
            messageId: messageId || `manual-${Date.now()}`
          });
          
          results.push({ 
            coupleId: couple.id,
            emails,
            variant: variant.key,
            subject,
            messageId,
            success: true 
          });
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 600));
        
      } catch (coupleError) {
        console.error(`Error for couple ${couple.id}:`, coupleError);
        results.push({ 
          coupleId: couple.id,
          success: false, 
          error: coupleError instanceof Error ? coupleError.message : String(coupleError)
        });
      }
    }
    
    const summary = {
      totalProcessed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
    
    console.log('Mid-week nudge job complete:', summary);
    
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
    
  } catch (error) {
    console.error("Error in mid-week nudge function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

