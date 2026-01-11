import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getLocalDate(timezone: string): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '2024');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  
  return new Date(year, month, day, hour, minute);
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getMondayOfWeek(timezone: string): Date {
  const local = getLocalDate(timezone);
  const day = local.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(local);
  monday.setDate(local.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

async function getLogsThisWeek(supabase: any, userIds: string[], timezone: string): Promise<number> {
  const monday = getMondayOfWeek(timezone);
  
  const { data, error } = await supabase
    .from('activities')
    .select('id')
    .in('user_id', userIds)
    .gte('activity_date', monday.toISOString());
  
  if (error) {
    console.error('Error fetching logs:', error);
    return 0;
  }
  
  return data?.length || 0;
}

async function getPreviousWeekLogs(supabase: any, userIds: string[], timezone: string): Promise<number> {
  const monday = getMondayOfWeek(timezone);
  const previousMonday = new Date(monday);
  previousMonday.setDate(monday.getDate() - 7);
  
  const { data, error } = await supabase
    .from('activities')
    .select('id')
    .in('user_id', userIds)
    .gte('activity_date', previousMonday.toISOString())
    .lt('activity_date', monday.toISOString());
  
  if (error) {
    console.error('Error fetching previous week logs:', error);
    return 0;
  }
  
  return data?.length || 0;
}

async function getLastLogRelative(supabase: any, userIds: string[], timezone: string): Promise<string> {
  const { data, error } = await supabase
    .from('activities')
    .select('activity_date')
    .in('user_id', userIds)
    .order('activity_date', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !data) return "None yet";
  
  const lastLog = new Date(data.activity_date);
  const localNow = getLocalDate(timezone);
  
  // Use ISO week comparison with timezone-aware current time
  const lastLogWeek = getWeekNumber(lastLog);
  const lastLogYear = lastLog.getFullYear();
  const currentWeek = getWeekNumber(localNow);
  const currentYear = localNow.getFullYear();
  
  const diffHours = (Date.now() - lastLog.getTime()) / (1000 * 60 * 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 24) return "Last night";
  
  // Check if same ISO week (Monday-Sunday)
  if (lastLogYear === currentYear && lastLogWeek === currentWeek) {
    return "Earlier this week";
  }
  
  // For activities from previous weeks
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 14) return "Last week";
  return `${diffDays} days ago`;
}

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

// Calculate consistency score (0-100) - same logic as frontend
async function getConsistencyScore(supabase: any, userIds: string[], timezone: string): Promise<number> {
  const localNow = getLocalDate(timezone);
  const eightWeeksAgo = new Date(localNow);
  eightWeeksAgo.setDate(localNow.getDate() - 56);
  
  const { data, error } = await supabase
    .from('activities')
    .select('activity_date')
    .in('user_id', userIds)
    .gte('activity_date', eightWeeksAgo.toISOString());
  
  if (error || !data) return 0;
  
  // Group by week
  const weekCounts = new Map<string, number>();
  data.forEach((a: any) => {
    const date = new Date(a.activity_date);
    const weekStart = new Date(date);
    const day = weekStart.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + diff);
    const weekKey = weekStart.toISOString().split('T')[0];
    weekCounts.set(weekKey, (weekCounts.get(weekKey) || 0) + 1);
  });
  
  let score = 0;
  weekCounts.forEach(count => {
    if (count >= 1) score += 12;
    if (count >= 2) score += 2;
  });
  
  return Math.min(score, 100);
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
          processedUserIds.add(profile.user_id);
        }
        
        if (emails.length === 0) {
          console.log(`No emails found for couple ${couple.id}`);
          continue;
        }
        
        // Calculate combined stats
        const signupDate = new Date(profiles[0].signup_at || new Date());
        const daysSinceSignup = (Date.now() - signupDate.getTime()) / (1000 * 60 * 60 * 24);
        const isNystart = daysSinceSignup < 28;
        
        const userIds = [couple.user1_id, couple.user2_id];
        const logsThisWeek = await getLogsThisWeek(supabase, userIds, timezone);
        const lastLogRelative = await getLastLogRelative(supabase, userIds, timezone);
        const yearTotal = await getYearTotal(supabase, userIds, timezone);
        const streakWeeks = await getStreakWeeks(supabase, userIds, timezone);
        const paceLabel = getPaceLabel(yearTotal);
        const consistencyScore = await getConsistencyScore(supabase, userIds, timezone);
        const previousWeekLogs = await getPreviousWeekLogs(supabase, userIds, timezone);
        
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
          from: "fiftytwoormore <digest@updates.lindaninc.com>",
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
    
    // Process uncoupled users
    const { data: allProfiles, error: allProfilesError } = await supabase
      .from('profiles')
      .select('user_id, timezone, email_digest_enabled, signup_at')
      .eq('email_digest_enabled', true);
    
    if (!allProfilesError && allProfiles) {
      for (const profile of allProfiles) {
        // Skip if already processed as part of a couple
        if (processedUserIds.has(profile.user_id)) continue;
        
        try {
          const timezone = profile.timezone || 'Europe/Stockholm';
          const localDate = getLocalDate(timezone);
          const isSaturday = localDate.getDay() === 6;
          const isTargetHour = localDate.getHours() === 10;
          
          if (!isSaturday || !isTargetHour) {
            console.log(`Skipping uncoupled user ${profile.user_id}: Not Saturday 10:00`);
            continue;
          }
          
          const weekNumber = getWeekNumber(localDate);
          const year = localDate.getFullYear();
          
          // Check if already sent this week
          const { data: existingLog } = await supabase
            .from('email_digest_log')
            .select('id')
            .eq('user_id', profile.user_id)
            .eq('week_number', weekNumber)
            .eq('year', year)
            .single();
          
          if (existingLog) {
            console.log(`Already sent to ${profile.user_id} for week ${weekNumber}`);
            continue;
          }
          
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
          if (!authUser?.user?.email) continue;
          
          const signupDate = new Date(profile.signup_at || new Date());
          const daysSinceSignup = (Date.now() - signupDate.getTime()) / (1000 * 60 * 60 * 24);
          const isNystart = daysSinceSignup < 28;
          
          // Calculate stats for single user
          const userIds = [profile.user_id];
          const logsThisWeek = await getLogsThisWeek(supabase, userIds, timezone);
          const lastLogRelative = await getLastLogRelative(supabase, userIds, timezone);
          const yearTotal = await getYearTotal(supabase, userIds, timezone);
          const streakWeeks = await getStreakWeeks(supabase, userIds, timezone);
          const paceLabel = getPaceLabel(yearTotal);
          const consistencyScore = await getConsistencyScore(supabase, userIds, timezone);
          const previousWeekLogs = await getPreviousWeekLogs(supabase, userIds, timezone);
          
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
          
          const subjects = isNystart ? subjectsNystart : subjectsStandard;
          const subject = subjects[Math.floor(Math.random() * subjects.length)];
          const emailType = isNystart ? 'digest-nystart' : 'digest';
          
          const plainText = getPlainText(isNystart, emailData);
          const html = getHtml(plainText);
          
          const emailResponse = await resend.emails.send({
            from: "fiftytwoormore <digest@updates.lindaninc.com>",
            to: [authUser.user.email],
            subject,
            text: plainText,
            html
          });
          
          console.log(`Email sent to uncoupled user ${authUser.user.email}:`, emailResponse);
          
          if (emailResponse.error) {
            console.error(`Failed to send to ${authUser.user.email}:`, emailResponse.error);
            results.push({ 
              userId: profile.user_id, 
              email: authUser.user.email,
              type: emailType,
              success: false, 
              error: emailResponse.error.message 
            });
          } else {
            const messageId = emailResponse.data?.id;
            
            await logEmailSent(supabase, {
              userId: profile.user_id,
              type: emailType,
              subject,
              weekNumber,
              year,
              messageId: messageId || `manual-${Date.now()}`
            });
            
            results.push({ 
              userId: profile.user_id, 
              email: authUser.user.email,
              type: emailType,
              messageId,
              success: true 
            });
          }
          
          await new Promise(resolve => setTimeout(resolve, 600));
          
        } catch (userError) {
          console.error(`Error for uncoupled user ${profile.user_id}:`, userError);
          results.push({ 
            userId: profile.user_id, 
            success: false, 
            error: userError instanceof Error ? userError.message : String(userError)
          });
        }
      }
    }
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    return new Response(
      JSON.stringify({ 
        message: `Processed ${couples?.length || 0} couples and ${allProfiles?.length || 0} total profiles: ${successful.length} sent, ${failed.length} failed`,
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