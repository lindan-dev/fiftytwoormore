import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import {
  getLocalDate,
  getWeekNumber,
  countLogsThisWeek,
  countYearTotal,
  calculateStreakWeeks,
  getLastLogRelative,
} from "../_shared/statsCalculations.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple hash function for user ID to get deterministic rotation
function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Removed duplicate - using imported getLastLogRelative from shared module

async function getYearTotal(supabase: any, userIds: string[], timezone: string): Promise<number> {
  const localNow = getLocalDate(timezone);
  const yearStart = new Date(localNow.getFullYear(), 0, 1).toISOString();
  const { data, error } = await supabase
    .from('activities')
    .select('id')
    .in('user_id', userIds)
    .gte('activity_date', yearStart);
  
  if (error) {
    console.error('Error fetching year total:', error);
    return 0;
  }
  
  return data?.length || 0;
}

async function getStreakWeeks(supabase: any, userIds: string[], timezone: string): Promise<number> {
  const { data, error } = await supabase
    .from('activities')
    .select('activity_date')
    .in('user_id', userIds)
    .order('activity_date', { ascending: false });
  
  if (error || !data || data.length === 0) return 0;
  
  // Group activities by ISO week using Set for O(1) lookups
  const weekSet = new Set<string>();
  data.forEach((activity: any) => {
    const date = new Date(activity.activity_date);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    weekSet.add(`${year}-W${week}`);
  });
  
  // Use timezone-aware current time for "now"
  const localNow = getLocalDate(timezone);
  let checkYear = localNow.getFullYear();
  let checkWeek = getWeekNumber(localNow);
  let streak = 0;
  
  // Check if current week has activity - if so, count it
  const currentWeekKey = `${checkYear}-W${checkWeek}`;
  if (weekSet.has(currentWeekKey)) {
    streak = 1;
  }
  
  // Move to previous week to start counting backwards
  checkWeek--;
  if (checkWeek < 1) {
    checkYear--;
    checkWeek = getWeekNumber(new Date(checkYear, 11, 31));
  }
  
  // Count consecutive weeks backwards from previous week
  for (let i = 0; i < 52; i++) {
    const weekKey = `${checkYear}-W${checkWeek}`;
    if (weekSet.has(weekKey)) {
      streak++;
    } else {
      break; // Only break when checking past weeks, not current week
    }
    
    // Move to previous week
    checkWeek--;
    if (checkWeek < 1) {
      checkYear--;
      checkWeek = getWeekNumber(new Date(checkYear, 11, 31));
    }
  }
  
  return streak;
}

function getPaceLabel(yearTotal: number): string {
  const now = new Date();
  const weekNumber = getWeekNumber(now);
  
  if (yearTotal >= weekNumber) return "nicely ahead";
  if (yearTotal === weekNumber - 1) return "on track";
  return "slightly behind—but weekends fix that";
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
  const { logsThisWeek, lastLogRelative, streakWeeks, yearTotal, paceLabel } = data;
  
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

Weekend is a great time for sparks, cuddles, glances, winks…
(or whatever your version of chemistry looks like.)

One moment this weekend counts just as much as a perfect week.

If something happens, log it.
If nothing happens, that's just a moment waiting to be claimed.

Warmly,
fiftytwoormore
Helping couples stay… consistent.`;
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check if specific couple_id is requested
    const body = req.method === "POST" ? await req.json() : {};
    const requestedCoupleId = body?.couple_id;
    
    // Get couples (either specific one or all)
    let couplesQuery = supabase.from('couples').select('id, user1_id, user2_id');
    
    if (requestedCoupleId) {
      couplesQuery = couplesQuery.eq('id', requestedCoupleId);
    }
    
    const { data: couples, error: couplesError } = await couplesQuery;
    
    if (couplesError) throw couplesError;
    
    const results = [];
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();
    const processedUserIds = new Set<string>();
    
    // Process couples first
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
        
        // Use first partner's timezone and signup date
        const timezone = profiles[0].timezone || 'Europe/Stockholm';
        const signupDate = new Date(profiles[0].signup_at || new Date());
        const daysSinceSignup = (Date.now() - signupDate.getTime()) / (1000 * 60 * 60 * 24);
        const isNystart = daysSinceSignup < 28;
        
        // Fetch activities and calculate stats using shared timezone-aware functions
        const userIds = [couple.user1_id, couple.user2_id];
        const { data: activities } = await supabase.from('activities').select('activity_date').in('user_id', userIds).order('activity_date', { ascending: false });
        const activityList = activities || [];
        
        const logsThisWeek = countLogsThisWeek(activityList, timezone);
        const lastLogRelative = getLastLogRelative(activityList, timezone);
        const yearTotal = countYearTotal(activityList, timezone);
        const streakWeeks = calculateStreakWeeks(activityList, timezone);
        const paceLabel = getPaceLabel(yearTotal);
        
        const emailData = {
          logsThisWeek,
          lastLogRelative,
          streakWeeks,
          yearTotal,
          paceLabel
        };
        
        // Select random subject
        const subjects = isNystart ? subjectsNystart : subjectsStandard;
        const subject = subjects[Math.floor(Math.random() * subjects.length)];
        const variantKey = isNystart ? 'nystart' : 'standard';
        
        // Generate a tracking ID for the CTA (we'll use this before we have the Resend messageId)
        const trackingId = crypto.randomUUID();
        
        // Generate email content with CTA tracking
        const plainText = getPlainText(isNystart, emailData);
        const html = getHtml(plainText, {
          messageId: trackingId,
          userId: couple.user1_id,
          emailType: 'digest-manual',
          variantKey
        });
        
        // Send ONE email to BOTH partners
        const emailResponse = await resend.emails.send({
          from: "fiftytwoormore <updates@fiftytwoormore.com>",
          to: emails,
          subject,
          text: plainText,
          html
        });
        
        console.log(`Email sent to couple ${couple.id} (${emails.join(', ')}):`, emailResponse);
        
        // Check for errors
        if (emailResponse.error) {
          console.error(`Failed to send to couple ${couple.id}:`, emailResponse.error);
          results.push({ 
            coupleId: couple.id,
            emails,
            type: isNystart ? 'nystart' : 'standard',
            success: false, 
            error: emailResponse.error.message 
          });
        } else {
          const resendMessageId = emailResponse.data?.id;
          
          // Log successful send with both tracking ID and Resend message ID
          await supabase
            .from('email_digest_log')
            .insert({
              user_id: couple.user1_id,
              type: 'digest-manual',
              week_number: weekNumber,
              year,
              message_id: trackingId,
              resend_message_id: resendMessageId,
              variant_key: variantKey,
              subject
            });
          
          // Also log to email_events for tracking
          await supabase
            .from('email_events')
            .insert({
              message_id: trackingId,
              user_id: couple.user1_id,
              type: 'digest-manual',
              variant_key: variantKey,
              event: 'sent',
              metadata: { resend_id: resendMessageId, emails }
            });
          
          results.push({ 
            coupleId: couple.id,
            emails,
            type: isNystart ? 'nystart' : 'standard',
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
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const message = requestedCoupleId 
      ? `Sent digest to ${successful.length > 0 ? 'selected couple' : 'no one (check logs)'}`
      : `Processed ${couples?.length || 0} couples: ${successful.length} sent, ${failed.length} failed`;
    
    return new Response(
      JSON.stringify({ 
        message,
        sent: successful.length,
        failed: failed.length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: any) {
    console.error("Error in send-digest-manual:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
