import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  userId: string;
  type: string;
  message: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, type, message }: NotificationRequest = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user preferences and push token
    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (prefsError || !prefs || !prefs.push_token) {
      console.log('No push token for user', userId);
      return new Response(
        JSON.stringify({ success: false, reason: 'no_token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check global fallback rules
    const canSend = await checkFallbackRules(supabase, userId, type, prefs);
    if (!canSend.allowed) {
      console.log('Notification blocked:', canSend.reason);
      return new Response(
        JSON.stringify({ success: false, reason: canSend.reason }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send push notification using Web Push API
    const pushSubscription = JSON.parse(prefs.push_token);
    const webpush = await import('https://esm.sh/web-push@3.6.5');
    
    const vapidPublicKey = Deno.env.get('VITE_VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    
    webpush.setVapidDetails(
      'mailto:your-email@example.com',
      vapidPublicKey,
      vapidPrivateKey
    );

    const payload = JSON.stringify({
      title: '52+',
      body: message,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: {
        url: '/',
        type,
      },
    });

    await webpush.sendNotification(pushSubscription, payload);

    // Log the notification
    await supabase.from('notification_logs').insert({
      user_id: userId,
      notification_type: type,
      message,
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function checkFallbackRules(supabase: any, userId: string, type: string, prefs: any) {
  // Rule 1: 24h suppression - check last activity
  const { data: lastActivity } = await supabase
    .from('activities')
    .select('activity_date')
    .eq('user_id', userId)
    .order('activity_date', { ascending: false })
    .limit(1)
    .single();

  if (lastActivity) {
    const lastLogAt = new Date(lastActivity.activity_date);
    const hoursSinceLog = (Date.now() - lastLogAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLog < 24 && isScheduledNudge(type)) {
      return { allowed: false, reason: '24h_suppression' };
    }
  }

  // Rule 2: Weekly push cap (max 3 scheduled nudges/week)
  if (isScheduledNudge(type)) {
    const weekStart = getWeekStart(new Date());
    const { data: weeklyLogs, error } = await supabase
      .from('notification_logs')
      .select('id')
      .eq('user_id', userId)
      .gte('sent_at', weekStart.toISOString())
      .in('notification_type', ['weekly_kickoff', 'mid_week', 'weekend', 'last_call']);

    if (!error && weeklyLogs && weeklyLogs.length >= 3) {
      return { allowed: false, reason: 'weekly_cap_exceeded' };
    }
  }

  // Rule 3: Check preferences for notification type
  const typePrefs: Record<string, boolean> = {
    'weekly_kickoff': prefs.weekly_nudges,
    'mid_week': prefs.weekly_nudges,
    'weekend': prefs.weekly_nudges,
    'last_call': prefs.weekly_nudges,
    'after_logging': prefs.streak_celebrations,
    'milestone': prefs.milestones,
    'comeback': prefs.comeback_boosts,
    'monthly_recap': prefs.monthly_recap,
  };

  if (typePrefs[type] === false) {
    return { allowed: false, reason: 'user_preference_disabled' };
  }

  return { allowed: true };
}

function isScheduledNudge(type: string): boolean {
  return ['weekly_kickoff', 'mid_week', 'weekend', 'last_call'].includes(type);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}
