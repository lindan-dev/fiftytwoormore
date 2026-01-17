import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import {
  getLocalDate,
  getWeekNumber,
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
  if (logsThisWeek > 0) {
    return variants.find(v => v.key === 'E')!;
  }
  
  const rotatingVariants = variants.filter(v => v.key !== 'E');
  const userHash = hashUserId(userId);
  const variantIndex = (weekNumber + userHash) % rotatingVariants.length;
  return rotatingVariants[variantIndex];
}

function selectSubject(variant: NudgeVariant, weekNumber: number): string {
  const subjectIndex = weekNumber % variant.subjects.length;
  return variant.subjects[subjectIndex];
}

function getHtml(text: string, trackingParams?: { messageId: string; userId: string; emailType: string; variantKey?: string }): string {
  let ctaHtml = '';
  if (trackingParams) {
    const trackingUrl = `https://uuijigmwkpmakltymkqe.supabase.co/functions/v1/email-click-tracker?mid=${encodeURIComponent(trackingParams.messageId)}&u=${encodeURIComponent(trackingParams.userId)}&type=${encodeURIComponent(trackingParams.emailType)}&v=${encodeURIComponent(trackingParams.variantKey || '')}`;
    ctaHtml = `<p style="margin-top: 24px;"><a href="${trackingUrl}" style="color: #2754C5; text-decoration: underline; font-family: sans-serif;">Open fiftytwoormore →</a></p>`;
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

// ============ Main Handler ============

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Parse request body for optional couple_id
    let requestedCoupleId: string | null = null;
    try {
      const body = await req.json();
      requestedCoupleId = body?.couple_id || null;
    } catch {
      // No body or invalid JSON, proceed with all couples
    }
    
    console.log('Starting manual mid-week nudge...', requestedCoupleId ? `for couple ${requestedCoupleId}` : 'for all couples');
    
    // Build query for couples
    let couplesQuery = supabase.from('couples').select('id, user1_id, user2_id');
    if (requestedCoupleId) {
      couplesQuery = couplesQuery.eq('id', requestedCoupleId);
    }
    
    const { data: couples, error: couplesError } = await couplesQuery;
    
    if (couplesError) throw couplesError;
    
    const results: any[] = [];
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();
    
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
        
        // Check if at least one partner has digest enabled (skip for manual single couple)
        if (!requestedCoupleId) {
          const hasDigestEnabled = profiles.some(p => p.email_digest_enabled);
          if (!hasDigestEnabled) {
            console.log(`No digest enabled for couple ${couple.id}`);
            continue;
          }
        }
        
        const timezone = profiles[0].timezone || 'Europe/Stockholm';
        
        // Get both partners' emails
        const emails: string[] = [];
        for (const profile of profiles) {
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
          if (authUser?.user?.email) {
            emails.push(authUser.user.email);
          }
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
        
        // Generate tracking ID for CTA
        const trackingId = crypto.randomUUID();
        
        // Generate email content with CTA tracking
        const plainText = variant.body;
        const html = getHtml(plainText, {
          messageId: trackingId,
          userId: couple.user1_id,
          emailType: 'midweek-nudge-manual',
          variantKey: variant.key
        });
        
        // Send ONE email to BOTH partners
        const emailResponse = await resend.emails.send({
          from: "fiftytwoormore <digest@updates.lindaninc.com>",
          to: emails,
          subject,
          text: plainText,
          html
        });
        
        console.log(`Manual nudge sent to couple ${couple.id} (${emails.join(', ')}):`, emailResponse);
        
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
          const resendMessageId = emailResponse.data?.id;
          
          // Log successful send with tracking info
          await supabase
            .from('email_digest_log')
            .insert({
              user_id: couple.user1_id,
              type: 'midweek-nudge-manual',
              week_number: weekNumber,
              year,
              variant_key: variant.key,
              subject,
              message_id: trackingId,
              resend_message_id: resendMessageId
            });
          
          // Also log to email_events for tracking
          await supabase
            .from('email_events')
            .insert({
              message_id: trackingId,
              user_id: couple.user1_id,
              type: 'midweek-nudge-manual',
              variant_key: variant.key,
              event: 'sent',
              metadata: { resend_id: resendMessageId, emails }
            });
          
          results.push({ 
            coupleId: couple.id,
            emails,
            variant: variant.key,
            subject,
            trackingId,
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
    
    console.log('Manual mid-week nudge complete:', summary);
    
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
    
  } catch (error) {
    console.error("Error in manual mid-week nudge function:", error);
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
