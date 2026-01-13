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

// ============ Helper Functions ============

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

function getDaysSince(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  const date = new Date(dateStr);
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

// ============ Email Content ============

interface EmailContent {
  type: string;
  subjects: string[];
  body: string;
}

// Type 1: Getting Started (Uncoupled Users)
const uncoupledEmails: EmailContent[] = [
  {
    type: 'activation-uncoupled-1',
    subjects: [
      "Your partner hasn't joined yet — but you can still get started",
      "Ready when you are",
      "While you wait…"
    ],
    body: `Hi there,

Your partner hasn't connected yet — no rush.

But here's a secret: you don't have to wait.

You can start logging moments on your own.
When your partner joins, everything will merge.

In the meantime, you could:
→ Log that first memory (whenever it happened)
→ Send your partner a gentle nudge

The invitation link is still active.

One step at a time.

— fiftytwoormore`
  },
  {
    type: 'activation-uncoupled-2',
    subjects: [
      "Still waiting? You don't have to",
      "A gentle nudge (for you)",
      "Your tracker is ready — with or without"
    ],
    body: `Hi again,

It's been a few days since you signed up.

Your partner still hasn't connected — and that's okay.

Some people start solo. They log their first few moments alone.
Then when their partner joins, everything clicks together.

No judgment. No pressure.

Just a reminder that the app is here, and so is your data.

If you want to resend the invite, it's in your profile.

Or just… start.

We'll be here either way.

— fiftytwoormore`
  },
  {
    type: 'activation-uncoupled-3',
    subjects: [
      "Last check-in before we go quiet",
      "Still thinking about it?",
      "We'll be here when you're ready"
    ],
    body: `Hi,

This is the last nudge for now.

Your partner still hasn't joined — and maybe the timing isn't right.

That's completely fine.

If you ever want to pick it up again:
→ The app is still here
→ Your account is active
→ You can start logging anytime — solo or together

No pressure. No expiration.

When you're ready, we're ready.

Until then, take care.

— fiftytwoormore`
  }
];

// Type 2: First Moment (Coupled, No Activity)
const coupledNoActivityEmails: EmailContent[] = [
  {
    type: 'activation-coupled-1',
    subjects: [
      "You're connected! Now what?",
      "The first log is the hardest",
      "Ready to track your first moment?"
    ],
    body: `Hi you two,

You're officially connected. 

Now comes the easy part: logging your first moment.

It doesn't have to be tonight.
It can be something from last week.
Or last month.
Or that thing you both remember from way back.

The app doesn't judge timing — it just keeps track.

One tap. One memory. That's all it takes to start.

— fiftytwoormore`
  },
  {
    type: 'activation-coupled-2',
    subjects: [
      "Still thinking about that first log?",
      "A nudge for you two",
      "The first one is always the weirdest"
    ],
    body: `Hi again,

Just a gentle check-in.

You've been connected for about a week now — but no logs yet.

That's okay. Sometimes starting is the hardest part.

Here's what might help:
→ Backdate your first entry (we won't tell)
→ Keep it simple — just a tap, no notes required
→ Think of it as "saving" a moment, not "reporting" one

No streaks to lose. No goals to hit. Just… a start.

Whenever you're ready.

— fiftytwoormore`
  }
];

// Type 3: Re-engagement (Inactive Couples)
const reengagementEmail: EmailContent = {
  type: 'reengagement-1',
  subjects: [
    "It's been a while",
    "No pressure — just checking in",
    "Still here when you're ready"
  ],
  body: `Hi you two,

It's been a few weeks since your last log.

No judgment here — life happens.

This is just a quiet reminder that the app is still here.

Waiting. Patient. Ready whenever you are.

If you want to pick it back up:
→ One moment breaks the silence
→ Backdating is always allowed
→ The streak can start fresh

And if not? That's okay too.

We'll stay quiet until you're ready.

— fiftytwoormore`
};

// Timing thresholds (in days)
const UNCOUPLED_EMAIL_1_DAYS = 2;
const UNCOUPLED_EMAIL_2_DAYS = 6;
const UNCOUPLED_EMAIL_3_DAYS = 14;
const COUPLED_EMAIL_1_DAYS = 2;
const COUPLED_EMAIL_2_DAYS = 6;
const REENGAGEMENT_DAYS = 21;

function selectSubject(emailContent: EmailContent, weekNumber: number): string {
  const subjectIndex = weekNumber % emailContent.subjects.length;
  return emailContent.subjects[subjectIndex];
}

function getHtml(text: string, messageId?: string, userId?: string, emailType?: string): string {
  let ctaHtml = '';
  if (messageId && userId) {
    const trackingUrl = `https://uuijigmwkpmakltymkqe.supabase.co/functions/v1/email-click-tracker?mid=${encodeURIComponent(messageId)}&u=${encodeURIComponent(userId)}&type=${encodeURIComponent(emailType || 'activation')}`;
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
  subject: string;
  weekNumber: number;
  year: number;
  messageId: string;
  resendMessageId?: string;
}) {
  const { userId, type, subject, weekNumber, year, messageId, resendMessageId } = params;
  
  await supabase.from('email_digest_log').insert({
    user_id: userId,
    type,
    subject,
    week_number: weekNumber,
    year,
    message_id: messageId,
    resend_message_id: resendMessageId
  });
  
  await supabase.from('email_events').insert({
    message_id: messageId,
    user_id: userId,
    type,
    event: 'sent',
    event_at: new Date().toISOString()
  });
}

async function hasReceivedEmail(supabase: any, userId: string, emailType: string): Promise<boolean> {
  const { data } = await supabase
    .from('email_digest_log')
    .select('id')
    .eq('user_id', userId)
    .eq('type', emailType)
    .limit(1);
  
  return (data?.length || 0) > 0;
}

async function getUserActivityCount(supabase: any, userIds: string[]): Promise<number> {
  const { data, error } = await supabase
    .from('activities')
    .select('id')
    .in('user_id', userIds);
  
  if (error) {
    console.error('Error fetching activities:', error);
    return 0;
  }
  
  return data?.length || 0;
}

async function getLastActivityDate(supabase: any, userIds: string[]): Promise<string | null> {
  const { data, error } = await supabase
    .from('activities')
    .select('activity_date')
    .in('user_id', userIds)
    .order('activity_date', { ascending: false })
    .limit(1);
  
  if (error || !data || data.length === 0) return null;
  return data[0].activity_date;
}

// ============ Main Handler ============

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('Starting activation email job...');
    
    const results: any[] = [];
    let emailsSent = 0;
    
    // Get test user IDs to exclude
    const { data: testRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'test_user');
    
    const testUserIds = new Set(testRoles?.map(r => r.user_id) || []);
    console.log(`Excluding ${testUserIds.size} test users`);
    
    // Get all profiles with email digest enabled
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, timezone, email_digest_enabled, signup_at')
      .eq('email_digest_enabled', true);
    
    if (profilesError) throw profilesError;
    
    // Filter out test users
    const profiles = allProfiles?.filter(p => !testUserIds.has(p.user_id)) || [];
    console.log(`Found ${profiles.length} eligible profiles (excluding test users)`);
    
    // Get all couples
    const { data: couples, error: couplesError } = await supabase
      .from('couples')
      .select('id, user1_id, user2_id, created_at');
    
    if (couplesError) throw couplesError;
    
    // Create map of user -> couple
    const userCoupleMap = new Map<string, { coupleId: string; partnerId: string; coupledAt: string }>();
    for (const couple of couples || []) {
      if (!testUserIds.has(couple.user1_id) && !testUserIds.has(couple.user2_id)) {
        userCoupleMap.set(couple.user1_id, { coupleId: couple.id, partnerId: couple.user2_id, coupledAt: couple.created_at });
        userCoupleMap.set(couple.user2_id, { coupleId: couple.id, partnerId: couple.user1_id, coupledAt: couple.created_at });
      }
    }
    
    const processedCouples = new Set<string>();
    
    for (const profile of profiles) {
      const timezone = profile.timezone || 'Europe/Stockholm';
      const localDate = getLocalDate(timezone);
      
      // Only send at 10:00 AM local time
      if (localDate.getHours() !== 10) {
        continue;
      }
      
      const weekNumber = getWeekNumber(localDate);
      const year = localDate.getFullYear();
      const daysSinceSignup = getDaysSince(profile.signup_at);
      
      const coupleInfo = userCoupleMap.get(profile.user_id);
      
      // ============ TYPE 1: Uncoupled Users ============
      if (!coupleInfo) {
        console.log(`Processing uncoupled user ${profile.user_id}, days since signup: ${daysSinceSignup}`);
        
        let emailToSend: EmailContent | null = null;
        
        // Determine which email to send based on days since signup
        if (daysSinceSignup >= UNCOUPLED_EMAIL_1_DAYS && daysSinceSignup < UNCOUPLED_EMAIL_2_DAYS) {
          if (!(await hasReceivedEmail(supabase, profile.user_id, 'activation-uncoupled-1'))) {
            emailToSend = uncoupledEmails[0];
          }
        } else if (daysSinceSignup >= UNCOUPLED_EMAIL_2_DAYS && daysSinceSignup < UNCOUPLED_EMAIL_3_DAYS) {
          if (!(await hasReceivedEmail(supabase, profile.user_id, 'activation-uncoupled-2'))) {
            emailToSend = uncoupledEmails[1];
          }
        } else if (daysSinceSignup >= UNCOUPLED_EMAIL_3_DAYS) {
          if (!(await hasReceivedEmail(supabase, profile.user_id, 'activation-uncoupled-3'))) {
            emailToSend = uncoupledEmails[2];
          }
        }
        
        if (emailToSend) {
          // Get user email
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
          const email = authUser?.user?.email;
          
          if (email) {
            const subject = selectSubject(emailToSend, weekNumber);
            const messageId = crypto.randomUUID();
            const html = getHtml(emailToSend.body, messageId, profile.user_id, emailToSend.type);
            
            console.log(`Sending ${emailToSend.type} to ${email}`);
            
            const emailResponse = await resend.emails.send({
              from: "fiftytwoormore <digest@updates.lindaninc.com>",
              to: [email],
              subject,
              text: emailToSend.body,
              html
            });
            
            if (emailResponse.error) {
              console.error(`Failed to send ${emailToSend.type}:`, emailResponse.error);
              results.push({ userId: profile.user_id, type: emailToSend.type, success: false, error: emailResponse.error.message });
            } else {
              await logEmailSent(supabase, {
                userId: profile.user_id,
                type: emailToSend.type,
                subject,
                weekNumber,
                year,
                messageId,
                resendMessageId: emailResponse.data?.id
              });
              
              results.push({ userId: profile.user_id, type: emailToSend.type, success: true });
              emailsSent++;
              
              // Rate limiting: 600ms delay
              await new Promise(resolve => setTimeout(resolve, 600));
            }
          }
        }
        continue;
      }
      
      // ============ TYPE 2 & 3: Coupled Users ============
      // Skip if we already processed this couple
      if (processedCouples.has(coupleInfo.coupleId)) {
        continue;
      }
      processedCouples.add(coupleInfo.coupleId);
      
      const userIds = [profile.user_id, coupleInfo.partnerId];
      const activityCount = await getUserActivityCount(supabase, userIds);
      const daysSinceCoupled = getDaysSince(coupleInfo.coupledAt);
      
      console.log(`Processing couple ${coupleInfo.coupleId}: activities=${activityCount}, daysSinceCoupled=${daysSinceCoupled}`);
      
      let emailToSend: EmailContent | null = null;
      
      // TYPE 2: Coupled but no activities
      if (activityCount === 0) {
        if (daysSinceCoupled >= COUPLED_EMAIL_1_DAYS && daysSinceCoupled < COUPLED_EMAIL_2_DAYS) {
          if (!(await hasReceivedEmail(supabase, profile.user_id, 'activation-coupled-1'))) {
            emailToSend = coupledNoActivityEmails[0];
          }
        } else if (daysSinceCoupled >= COUPLED_EMAIL_2_DAYS) {
          if (!(await hasReceivedEmail(supabase, profile.user_id, 'activation-coupled-2'))) {
            emailToSend = coupledNoActivityEmails[1];
          }
        }
      } else {
        // TYPE 3: Has activities but inactive for 3+ weeks
        const lastActivityDate = await getLastActivityDate(supabase, userIds);
        const daysSinceLastActivity = getDaysSince(lastActivityDate);
        
        if (daysSinceLastActivity >= REENGAGEMENT_DAYS) {
          if (!(await hasReceivedEmail(supabase, profile.user_id, 'reengagement-1'))) {
            emailToSend = reengagementEmail;
          }
        }
      }
      
      if (emailToSend) {
        // Get both partners' emails
        const emails: string[] = [];
        for (const userId of userIds) {
          const { data: authUser } = await supabase.auth.admin.getUserById(userId);
          if (authUser?.user?.email) {
            emails.push(authUser.user.email);
          }
        }
        
        if (emails.length > 0) {
          const subject = selectSubject(emailToSend, weekNumber);
          const messageId = crypto.randomUUID();
          const html = getHtml(emailToSend.body, messageId, profile.user_id, emailToSend.type);
          
          console.log(`Sending ${emailToSend.type} to couple ${coupleInfo.coupleId} (${emails.join(', ')})`);
          
          const emailResponse = await resend.emails.send({
            from: "fiftytwoormore <digest@updates.lindaninc.com>",
            to: emails,
            subject,
            text: emailToSend.body,
            html
          });
          
          if (emailResponse.error) {
            console.error(`Failed to send ${emailToSend.type}:`, emailResponse.error);
            results.push({ coupleId: coupleInfo.coupleId, type: emailToSend.type, success: false, error: emailResponse.error.message });
          } else {
            // Log for both users
            for (const userId of userIds) {
              await logEmailSent(supabase, {
                userId,
                type: emailToSend.type,
                subject,
                weekNumber,
                year,
                messageId,
                resendMessageId: emailResponse.data?.id
              });
            }
            
            results.push({ coupleId: coupleInfo.coupleId, type: emailToSend.type, success: true });
            emailsSent++;
            
            // Rate limiting: 600ms delay
            await new Promise(resolve => setTimeout(resolve, 600));
          }
        }
      }
    }
    
    console.log(`Activation email job complete. Sent ${emailsSent} emails.`);
    
    return new Response(JSON.stringify({
      success: true,
      emailsSent,
      results
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error: any) {
    console.error("Error in send-activation-emails:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

serve(handler);
