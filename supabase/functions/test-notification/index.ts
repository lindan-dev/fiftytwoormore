import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, targetEmail, message, type = 'test' } = await req.json();
    
    console.log('Test notification request:', { userId, targetEmail, message, type });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify caller is a superuser
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - no auth header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !caller) {
      console.log('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if caller is superuser
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'superuser')
      .maybeSingle();

    if (roleError || !roleData) {
      console.log('Not a superuser:', caller.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden - superuser access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find target user by email or userId
    let targetUserId = userId;
    if (targetEmail && !userId) {
      const { data: userData } = await supabase.auth.admin.listUsers();
      const targetUser = userData?.users?.find(u => u.email === targetEmail);
      if (!targetUser) {
        console.log('User not found by email:', targetEmail);
        return new Response(
          JSON.stringify({ error: 'User not found', details: `No user with email ${targetEmail}` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      targetUserId = targetUser.id;
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'Must provide userId or targetEmail' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Target user ID:', targetUserId);

    // Get user's notification preferences and push token
    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', targetUserId)
      .maybeSingle();

    console.log('User preferences:', prefs);
    console.log('Preferences error:', prefsError);

    if (!prefs) {
      return new Response(
        JSON.stringify({ 
          error: 'No notification preferences found',
          details: 'User has not set up notification preferences',
          diagnostics: { targetUserId, prefsError }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!prefs.push_token) {
      return new Response(
        JSON.stringify({ 
          error: 'No push token found',
          details: 'User has not enabled push notifications on any device',
          diagnostics: { 
            targetUserId, 
            hasPreferences: true,
            preferences: {
              weekly_nudges: prefs.weekly_nudges,
              streak_celebrations: prefs.streak_celebrations,
              milestones: prefs.milestones,
              monthly_recap: prefs.monthly_recap,
              comeback_boosts: prefs.comeback_boosts,
              timezone: prefs.timezone,
            }
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send push notification directly (bypass fallback rules for testing)
    console.log('Sending push notification...');
    
    const pushSubscription = JSON.parse(prefs.push_token);
    const webpush = await import('https://esm.sh/web-push@3.6.5');
    
    const vapidPublicKey = Deno.env.get('VITE_VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    
    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ 
          error: 'VAPID keys not configured',
          details: 'Server is missing push notification credentials'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    webpush.setVapidDetails(
      'mailto:admin@52plus.app',
      vapidPublicKey,
      vapidPrivateKey
    );

    const notificationMessage = message || `Test notification sent at ${new Date().toLocaleTimeString()}`;
    
    const payload = JSON.stringify({
      title: '52+ Test',
      body: notificationMessage,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: {
        url: '/',
        type: 'test',
      },
    });

    try {
      await webpush.sendNotification(pushSubscription, payload);
      console.log('Push notification sent successfully');
    } catch (pushError: any) {
      console.error('Push notification error:', pushError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send push notification',
          details: pushError.message,
          statusCode: pushError.statusCode,
          diagnostics: {
            endpoint: pushSubscription.endpoint?.substring(0, 50) + '...',
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the test notification
    await supabase.from('notification_logs').insert({
      user_id: targetUserId,
      notification_type: 'test',
      message: notificationMessage,
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Test notification sent successfully',
        diagnostics: {
          targetUserId,
          notificationType: type,
          pushTokenPresent: true,
          preferencesPresent: true,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in test-notification:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
