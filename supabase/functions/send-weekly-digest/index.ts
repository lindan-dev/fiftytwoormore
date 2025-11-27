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

interface User {
  user_id: string;
  email: string;
  name: string | null;
  timezone: string;
  email_digest_enabled: boolean;
  signup_at: string;
  streak_weeks: number;
  year_total: number;
}

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

async function getLogsThisWeek(supabase: any, userId: string, timezone: string): Promise<number> {
  const monday = getMondayOfWeek(timezone);
  
  const { data, error } = await supabase
    .from('activities')
    .select('id')
    .eq('user_id', userId)
    .gte('activity_date', monday.toISOString());
  
  if (error) {
    console.error('Error fetching logs:', error);
    return 0;
  }
  
  return data?.length || 0;
}

async function getLastLogRelative(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('activities')
    .select('activity_date')
    .eq('user_id', userId)
    .order('activity_date', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !data) return "None yet";
  
  const lastLog = new Date(data.activity_date);
  const now = new Date();
  const diffHours = (now.getTime() - lastLog.getTime()) / (1000 * 60 * 60);
  
  if (diffHours < 24) return "Last night";
  if (diffHours < 168) return "Earlier this week";
  return `${Math.floor(diffHours / 24)} days ago`;
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

function getHtml(text: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <pre style="white-space: pre-wrap; font-family: sans-serif;">${text}</pre>
</body>
</html>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get all users with digest enabled
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, timezone, email_digest_enabled, signup_at, streak_weeks, year_total')
      .eq('email_digest_enabled', true);
    
    if (profilesError) throw profilesError;
    
    const results = [];
    
    for (const profile of profiles || []) {
      try {
        // Check if it's Saturday 10:00 in user's timezone
        const localDate = getLocalDate(profile.timezone || 'Europe/Stockholm');
        const isSaturday = localDate.getDay() === 6;
        const isTargetHour = localDate.getHours() === 10;
        
        if (!isSaturday || !isTargetHour) {
          console.log(`Skipping ${profile.user_id}: Not Saturday 10:00 in their timezone`);
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
        
        // Get user email
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
        if (!authUser?.user?.email) continue;
        
        // Calculate if in onboarding period
        const signupDate = new Date(profile.signup_at || new Date());
        const daysSinceSignup = (Date.now() - signupDate.getTime()) / (1000 * 60 * 60 * 24);
        const isNystart = daysSinceSignup < 28;
        
        // Get stats
        const logsThisWeek = await getLogsThisWeek(supabase, profile.user_id, profile.timezone || 'Europe/Stockholm');
        const lastLogRelative = await getLastLogRelative(supabase, profile.user_id);
        const paceLabel = getPaceLabel(profile.year_total || 0);
        
        const emailData = {
          logsThisWeek,
          lastLogRelative,
          streakWeeks: profile.streak_weeks || 0,
          yearTotal: profile.year_total || 0,
          paceLabel
        };
        
        // Select random subject
        const subjects = isNystart ? subjectsNystart : subjectsStandard;
        const subject = subjects[Math.floor(Math.random() * subjects.length)];
        
        // Generate email content
        const plainText = getPlainText(isNystart, emailData);
        const html = getHtml(plainText);
        
        // Send email
        const emailResponse = await resend.emails.send({
          from: "fiftytwoormore <digest@resend.dev>",
          to: [authUser.user.email],
          subject,
          text: plainText,
          html
        });
        
        console.log(`Email sent to ${authUser.user.email}:`, emailResponse);
        
        // Log to database
        await supabase
          .from('email_digest_log')
          .insert({
            user_id: profile.user_id,
            type: isNystart ? 'digest-nystart' : 'digest',
            week_number: weekNumber,
            year
          });
        
        results.push({ 
          userId: profile.user_id, 
          email: authUser.user.email,
          type: isNystart ? 'nystart' : 'standard',
          success: true 
        });
        
      } catch (userError) {
        console.error(`Error for user ${profile.user_id}:`, userError);
        results.push({ 
          userId: profile.user_id, 
          success: false, 
          error: userError instanceof Error ? userError.message : String(userError)
        });
      }
    }
    
    return new Response(
      JSON.stringify({ 
        message: `Processed ${profiles?.length || 0} users`,
        sent: results.filter(r => r.success).length,
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