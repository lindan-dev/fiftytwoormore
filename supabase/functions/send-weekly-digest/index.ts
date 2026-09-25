import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import {
  getLocalDate,
  getWeekNumber,
  toLocalDate,
  countLogsThisWeek,
  countLogsPreviousWeek,
  countYearTotal,
  calculateStreakWeeks,
  getLastLogRelative,
  calculateConsistencyScore,
} from "../_shared/statsCalculations.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getPaceLabel(yearTotal: number, timezone: string): string {
  const localNow = getLocalDate(timezone);
  const weekNumber = getWeekNumber(localNow);
  
  if (yearTotal >= weekNumber) return "nicely ahead";
  if (yearTotal === weekNumber - 1) return "on track";
  return "slightly behind—but weekends fix that";
}

// Get optional insight for weekly digest
function getDigestInsight(data: { logsThisWeek: number; streakWeeks: number; consistencyScore: number; previousWeekLogs: number }): string | null {
  const insightOptions: string[] = [];
  
  // Consistency trend insights
  if (data.consistencyScore >= 80) {
    insightOptions.push("You've been showing up more consistently lately. It adds up.");
    insightOptions.push("Your consistency score is trending up. Quiet progress.");
    insightOptions.push("Steady beats intense. You're doing steady.");
  }
  
  // Period comparison insights
  const diff = data.logsThisWeek - data.previousWeekLogs;
  if (diff > 0) {
    insightOptions.push("More moments than last week. Momentum looks good.");
  } else if (diff < 0 && data.logsThisWeek > 0) {
    insightOptions.push("Slight dip from last period — still very much in the game.");
    insightOptions.push("Different rhythm this week. That's normal.");
  }
  
  // Return random insight or null
  if (insightOptions.length === 0) return null;
  return insightOptions[Math.floor(Math.random() * insightOptions.length)];
}

const subjectsStandard = [
  "Your week in moments (so far)",
  "Weekend window: open",
  "This week's intimacy stats",
  "Your chemistry check for this week"
];

const subjectsNystart = [
  "A little weekly check-in (your pace, your rules)",
  "Your week in tiny moments",
  "A soft nudge for your weekend"
];

function getPlainText(isNystart: boolean, data: any): string {
  const { logsThisWeek, lastLogRelative, streakWeeks, yearTotal, paceLabel, insight } = data;
  
  if (isNystart) {
    return `Hi you two,

You're in your first weeks with fiftytwoormore, so here's a gentle check-in to help you build your rhythm — at your own pace.

This week:
- Moments logged: ${logsThisWeek}
- Last moment: ${lastLogRelative}
- Streak: ${streakWeeks > 0 ? `${streakWeeks} week${streakWeeks > 1 ? 's' : ''}` : 'No active streak yet'}

${logsThisWeek === 0 
  ? 'A quiet start is totally normal. Most couples begin slowly before they find their flow.'
  : 'Nice start. Every moment you log helps you build your own pattern.'}

Year progress: ${yearTotal} / 52
That puts you: ${paceLabel}.

There's no "right amount" in the beginning — just small steps that feel real for the two of you.

If something happens this weekend, log it.
If not, you're still exactly where you should be.

Warmly,
fiftytwoormore
Here for your journey — softly.`;
  }
  
  const insightLine = insight ? `\n${insight}\n` : '';
  
  return `Hi you two,

Here's a quick look at your week so far — no pressure, just the fun part.

This week:
- Moments logged: ${logsThisWeek}
- Last moment: ${lastLogRelative}
- Streak: ${streakWeeks > 0 ? `${streakWeeks} week${streakWeeks > 1 ? 's' : ''}` : 'No active streak'}

${logsThisWeek === 0 ? "Looks like a quiet week so far. Quiet is fine. Quiet can turn interesting." : ''}

Year progress: ${yearTotal} / 52
That puts you: ${paceLabel}.

${streakWeeks > 0 
  ? `Your streak: ${streakWeeks} week${streakWeeks > 1 ? 's' : ''}.\nThat's some admirable consistency. Keep doing whatever you're doing.`
  : 'No streak right now — which is perfect.\nEvery streak starts with one moment.'}
${insightLine}
Weekend is a great time for sparks, cuddles, glances, winks…
(or whatever your version of chemistry looks like.)

One moment this weekend counts just as much as a perfect week.

If something happens, log it.
If nothing happens, that's just a moment waiting to be claimed.

Warmly,
fiftytwoormore
Helping couples stay… consistent.`;
}

function getHtml(text: string, messageId?: string, userId?: string, emailType?: string, variantKey?: string): string {
  // Build CTA link with click tracking if messageId provided
  let ctaHtml = '';
  if (messageId && userId) {
    const trackingUrl = `https://uuijigmwkpmakltymkqe.supabase.co/functions/v1/email-click-tracker?mid=${encodeURIComponent(messageId)}&u=${encodeURIComponent(userId)}&type=${encodeURIComponent(emailType || 'digest')}&v=${encodeURIComponent(variantKey || '')}`;
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
  
  // Insert into email_digest_log
  await supabase.from('email_digest_log').insert({
    user_id: userId,
    type,
    variant_key: variantKey,
    subject,
    week_number: weekNumber,
    year,
    message_id: messageId
  });
  
  // Insert sent event into email_events
  await supabase.from('email_events').insert({
    message_id: messageId,
    user_id: userId,
    type,
    variant_key: variantKey,
    event: 'sent',
    event_at: new Date().toISOString()
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get all couples
    const { data: couples, error: couplesError } = await supabase
      .from('couples')
      .select('id, user1_id, user2_id');
    
    if (couplesError) throw couplesError;
    
    const results = [];
    
    // Process couples
    for (const couple of couples || []) {
      try {
        // Get both partners' profiles
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, timezone, email_digest_enabled, signup_at')
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
        
        // Check if it's Saturday 10:00 in their timezone
        const localDate = getLocalDate(timezone);
        const isSaturday = localDate.getDay() === 6;
        const isTargetHour = localDate.getHours() === 10;
        
        if (!isSaturday || !isTargetHour) {
          console.log(`Skipping couple ${couple.id}: Not Saturday 10:00 in their timezone`);
          continue;
        }
        
        const weekNumber = getWeekNumber(localDate);
        const year = localDate.getFullYear();
        
        // Check if already sent this week (check for first user, only digest types)
        const { data: existingLog } = await supabase
          .from('email_digest_log')
          .select('id')
          .eq('user_id', couple.user1_id)
          .eq('week_number', weekNumber)
          .eq('year', year)
          .in('type', ['digest', 'digest-nystart'])
          .single();
        
        if (existingLog) {
          console.log(`Already sent to couple ${couple.id} for week ${weekNumber}`);
          continue;
        }
        
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
        
        // Fetch all activities for the couple
        const userIds = [couple.user1_id, couple.user2_id];
        const { data: activities, error: activitiesError } = await supabase
          .from('activities')
          .select('activity_date')
          .in('user_id', userIds)
          .order('activity_date', { ascending: false });
        
        if (activitiesError) {
          console.error(`Error fetching activities for couple ${couple.id}:`, activitiesError);
          continue;
        }
        
        const activityList = activities || [];
        
        // Calculate stats using shared timezone-aware functions
        const signupDate = new Date(profiles[0].signup_at || new Date());
        const daysSinceSignup = (Date.now() - signupDate.getTime()) / (1000 * 60 * 60 * 24);
        const isNystart = daysSinceSignup < 28;
        
        const logsThisWeek = countLogsThisWeek(activityList, timezone);
        const lastLogRelative = getLastLogRelative(activityList, timezone);
        const yearTotal = countYearTotal(activityList, timezone);
        const streakWeeks = calculateStreakWeeks(activityList, timezone);
        const paceLabel = getPaceLabel(yearTotal, timezone);
        const consistencyScore = calculateConsistencyScore(activityList, timezone);
        const previousWeekLogs = countLogsPreviousWeek(activityList, timezone);
        
        console.log(`Couple ${couple.id} stats (timezone: ${timezone}):`, {
          logsThisWeek,
          streakWeeks,
          yearTotal,
          previousWeekLogs,
          consistencyScore,
          activitiesCount: activityList.length
        });
        
        // Generate optional insight for standard digest (not nystart)
        const insight = !isNystart ? getDigestInsight({
          logsThisWeek,
          streakWeeks,
          consistencyScore,
          previousWeekLogs
        }) : null;
        
        const emailData = {
          logsThisWeek,
          lastLogRelative,
          streakWeeks,
          yearTotal,
          paceLabel,
          insight
        };
        
        // Select random subject
        const subjects = isNystart ? subjectsNystart : subjectsStandard;
        const subject = subjects[Math.floor(Math.random() * subjects.length)];
        const emailType = isNystart ? 'digest-nystart' : 'digest';
        
        // Generate email content (without tracking link yet - need messageId first)
        const plainText = getPlainText(isNystart, emailData);
        const htmlWithoutTracking = getHtml(plainText);
        
        // Send ONE email to BOTH partners
        const emailResponse = await resend.emails.send({
          from: "fiftytwoormore <updates@fiftytwoormore.com>",
          to: emails,
          subject,
          text: plainText,
          html: htmlWithoutTracking
        });
        
        console.log(`Email sent to couple ${couple.id} (${emails.join(', ')}):`, emailResponse);
        
        // Check for errors
        if (emailResponse.error) {
          console.error(`Failed to send to couple ${couple.id}:`, emailResponse.error);
          results.push({ 
            coupleId: couple.id,
            emails,
            type: emailType,
            success: false, 
            error: emailResponse.error.message 
          });
        } else {
          const messageId = emailResponse.data?.id;
          
          // Log successful send with messageId
          await logEmailSent(supabase, {
            userId: couple.user1_id,
            type: emailType,
            subject,
            weekNumber,
            year,
            messageId: messageId || `manual-${Date.now()}`
          });
          
          results.push({ 
            coupleId: couple.id,
            emails,
            type: emailType,
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
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    return new Response(
      JSON.stringify({ 
        message: `Processed ${couples?.length || 0} couples: ${successful.length} sent, ${failed.length} failed`,
        sent: successful.length,
        failed: failed.length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: any) {
    console.error("Error in send-weekly-digest:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);

