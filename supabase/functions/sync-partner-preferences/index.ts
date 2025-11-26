import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header to identify the user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user client to get the authenticated user
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { 
      weekly_nudges, 
      streak_celebrations, 
      milestones, 
      monthly_recap, 
      comeback_boosts,
      push_token,
      timezone 
    } = body;

    console.log(`Syncing preferences for user ${user.id}`);

    // Get partner's user_id using admin client
    const { data: partnerId, error: partnerError } = await supabaseAdmin.rpc('get_partner_id', {
      user_id: user.id
    });

    if (partnerError) {
      console.error('Error getting partner:', partnerError);
    }

    console.log(`Partner ID: ${partnerId}`);

    const sharedPrefs = {
      weekly_nudges,
      streak_celebrations,
      milestones,
      monthly_recap,
      comeback_boosts,
    };

    // Update current user's preferences using admin client
    const { error: userError } = await supabaseAdmin
      .from("notification_preferences")
      .upsert({
        user_id: user.id,
        ...sharedPrefs,
        push_token: push_token,
        timezone: timezone,
      }, {
        onConflict: 'user_id'
      });

    if (userError) {
      console.error('Error updating user preferences:', userError);
      throw userError;
    }

    console.log('User preferences updated');

    // If partner exists, update their preferences too (keeping their push_token)
    if (partnerId) {
      // First get partner's existing preferences
      const { data: partnerPrefs } = await supabaseAdmin
        .from("notification_preferences")
        .select("push_token, timezone")
        .eq("user_id", partnerId)
        .maybeSingle();

      console.log('Partner existing prefs:', partnerPrefs);

      // Upsert partner preferences with admin client
      const { error: partnerUpdateError } = await supabaseAdmin
        .from("notification_preferences")
        .upsert({
          user_id: partnerId,
          ...sharedPrefs,
          push_token: partnerPrefs?.push_token || null,
          timezone: partnerPrefs?.timezone || timezone,
        }, {
          onConflict: 'user_id'
        });

      if (partnerUpdateError) {
        console.error('Error updating partner preferences:', partnerUpdateError);
        // Don't throw - we've already saved the user's prefs
      } else {
        console.log('Partner preferences updated');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        partnerSynced: !!partnerId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing preferences:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
