import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Notification messages for each type and condition
const MESSAGES = {
  weekly_kickoff: {
    not_logged: [
      "New week. One intimate moment is all it takes.",
      "Low bar, high chemistry. Once = enough.",
    ],
    logged: [
      "New week and you're already ahead. Show-off.",
      "Early start? Impressive. Very impressive.",
    ],
  },
  mid_week: {
    not_logged: [
      "Mid-week check-in: any sparks yet?",
      "Still plenty of time for a little quality time.",
    ],
    logged: [
      "Already logged this week? Calm down, legends.",
      "Mid-week and you're already covered. Respect.",
    ],
  },
  weekend: {
    not_logged: [
      "Weekend. Perfect window for some… connection.",
      "One intimate moment = streak happiness.",
    ],
    logged: [
      "You're good for this week — but hey, bonus points never hurt.",
      "Streak secured. Everything else is… extracurricular.",
    ],
  },
  last_call: {
    not_logged: [
      "Last call for this week's intimacy point…",
      "If something cozy happens tonight, your streak will thank you.",
    ],
    logged: [
      "Week's wrapped. Well played.",
      "Streak safe. Feet up, halos on.",
    ],
  },
  after_logging: [
    "Nice. Something intimate happened — and you logged it.",
    "Boom. Logged. Chemistry confirmed.",
  ],
  milestone: [
    "5-week streak? Someone's been busy.",
    "10 weeks. That's… impressive.",
    "15 weeks — your mattress is writing a complaint.",
    "20 weeks. At this point it's a lifestyle.",
  ],
  comeback: [
    "Streak broke. Bed didn't. Fresh start.",
    "New week = new spark.",
    "Welcome back. We missed your… dedication.",
  ],
  monthly_recap: [
    "Last month: {count} intimate moments. Not bad.",
    "Your monthly chemistry score: {count}. Respect.",
  ],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // This function should be called by a cron job
    // It checks all users and sends appropriate notifications based on their schedule

    const { data: users } = await supabase
      .from('notification_preferences')
      .select('user_id, push_token, weekly_nudges')
      .not('push_token', 'is', null);

    if (!users) {
      return new Response(
        JSON.stringify({ message: 'No users with push tokens' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    let sentCount = 0;

    for (const user of users) {
      if (!user.weekly_nudges) continue;

      // Check if user has a schedule for today at this time
      const { data: schedules } = await supabase
        .from('notification_schedule')
        .select('*')
        .eq('user_id', user.user_id)
        .eq('day_of_week', dayOfWeek);

      if (!schedules || schedules.length === 0) continue;

      // Find matching time slot (within 5 minutes)
      const matchingSlot = schedules.find(slot => {
        const slotTime = slot.time.substring(0, 5);
        return Math.abs(timeToMinutes(slotTime) - timeToMinutes(currentTime)) <= 5;
      });

      if (!matchingSlot) continue;

      // Determine notification type based on day and time
      const notifType = determineNotificationType(dayOfWeek, currentTime);
      if (!notifType) continue;

      // Check if user has logged this week
      const hasLogged = await hasLoggedThisWeek(supabase, user.user_id);
      
      // Select appropriate message
      const messageSet = MESSAGES[notifType as keyof typeof MESSAGES];
      let message: string;
      
      if (typeof messageSet === 'object' && 'not_logged' in messageSet) {
        const options = hasLogged ? messageSet.logged : messageSet.not_logged;
        message = options[Math.floor(Math.random() * options.length)];
      } else {
        message = (messageSet as string[])[Math.floor(Math.random() * (messageSet as string[]).length)];
      }

      // Send notification via edge function
      await supabase.functions.invoke('send-notification', {
        body: {
          userId: user.user_id,
          type: notifType,
          message,
        },
      });

      sentCount++;
    }

    return new Response(
      JSON.stringify({ success: true, sentCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scheduling notifications:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function determineNotificationType(dayOfWeek: number, time: string): string | null {
  const hour = parseInt(time.split(':')[0]);
  
  // Monday morning (6-11)
  if (dayOfWeek === 1 && hour >= 6 && hour <= 11) {
    return 'weekly_kickoff';
  }
  
  // Wednesday afternoon (13-17)
  if (dayOfWeek === 3 && hour >= 13 && hour <= 17) {
    return 'mid_week';
  }
  
  // Saturday morning (8-12)
  if (dayOfWeek === 6 && hour >= 8 && hour <= 12) {
    return 'weekend';
  }
  
  // Sunday evening (16-20)
  if (dayOfWeek === 0 && hour >= 16 && hour <= 20) {
    return 'last_call';
  }
  
  return null;
}

async function hasLoggedThisWeek(supabase: any, userId: string): Promise<boolean> {
  const weekStart = getWeekStart(new Date());
  
  const { data } = await supabase
    .from('activities')
    .select('id')
    .eq('user_id', userId)
    .gte('activity_date', weekStart.toISOString())
    .limit(1);
  
  return data && data.length > 0;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
