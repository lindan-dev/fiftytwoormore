import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MESSAGES = {
  after_logging: [
    "Nice. Something intimate happened — and you logged it.",
    "Boom. Logged. Chemistry confirmed.",
  ],
  milestone_5: [
    "5-week streak? Someone's been busy.",
  ],
  milestone_10: [
    "10 weeks. That's… impressive.",
  ],
  milestone_15: [
    "15 weeks — your mattress is writing a complaint.",
  ],
  milestone_20: [
    "20 weeks. At this point it's a lifestyle.",
  ],
  milestone_other: [
    "{count}-week streak. Respect.",
  ],
  comeback: [
    "Streak broke. Bed didn't. Fresh start.",
    "New week = new spark.",
    "Welcome back. We missed your… dedication.",
  ],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!prefs || !prefs.push_token) {
      return new Response(
        JSON.stringify({ success: false, reason: 'no_preferences' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate current streak
    const streak = await calculateStreak(supabase, userId);
    
    // Check if user missed last week
    const missedLastWeek = await checkMissedLastWeek(supabase, userId);

    let notificationType = '';
    let message = '';

    // Determine notification type and message
    if (missedLastWeek && prefs.comeback_boosts) {
      // Comeback notification
      notificationType = 'comeback';
      message = MESSAGES.comeback[Math.floor(Math.random() * MESSAGES.comeback.length)];
    } else if (streak > 0 && streak % 5 === 0 && prefs.milestones) {
      // Milestone notification - check if we haven't sent one this week
      const weekStart = getWeekStart(new Date());
      const { data: recentMilestone } = await supabase
        .from('notification_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('notification_type', 'milestone')
        .gte('sent_at', weekStart.toISOString())
        .limit(1);

      if (!recentMilestone || recentMilestone.length === 0) {
        notificationType = 'milestone';
        if (streak === 5) {
          message = MESSAGES.milestone_5[0];
        } else if (streak === 10) {
          message = MESSAGES.milestone_10[0];
        } else if (streak === 15) {
          message = MESSAGES.milestone_15[0];
        } else if (streak === 20) {
          message = MESSAGES.milestone_20[0];
        } else {
          message = MESSAGES.milestone_other[0].replace('{count}', streak.toString());
        }
      }
    } else if (prefs.streak_celebrations) {
      // Regular after-logging celebration
      notificationType = 'after_logging';
      message = MESSAGES.after_logging[Math.floor(Math.random() * MESSAGES.after_logging.length)];
    }

    if (notificationType && message) {
      // Send the notification
      await supabase.functions.invoke('send-notification', {
        body: {
          userId,
          type: notificationType,
          message,
        },
      });

      return new Response(
        JSON.stringify({ success: true, type: notificationType }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, reason: 'no_notification_needed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error triggering notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function calculateStreak(supabase: any, userId: string): Promise<number> {
  const { data: activities } = await supabase
    .from('activities')
    .select('activity_date')
    .eq('user_id', userId)
    .order('activity_date', { ascending: false });

  if (!activities || activities.length === 0) return 0;

  let streak = 0;
  let currentWeekStart = getWeekStart(new Date());

  for (let i = 0; i < 100; i++) {
    const weekHasActivity = activities.some((activity: any) => {
      const activityDate = new Date(activity.activity_date);
      const activityWeekStart = getWeekStart(activityDate);
      return activityWeekStart.getTime() === currentWeekStart.getTime();
    });

    if (weekHasActivity) {
      streak++;
      currentWeekStart = new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      break;
    }
  }

  return streak;
}

async function checkMissedLastWeek(supabase: any, userId: string): Promise<boolean> {
  const thisWeekStart = getWeekStart(new Date());
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekEnd = new Date(thisWeekStart.getTime() - 1);

  const { data } = await supabase
    .from('activities')
    .select('id')
    .eq('user_id', userId)
    .gte('activity_date', lastWeekStart.toISOString())
    .lte('activity_date', lastWeekEnd.toISOString())
    .limit(1);

  return !data || data.length === 0;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}
