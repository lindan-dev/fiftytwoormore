import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface NotifyRequest {
  partner_id: string; // the OTHER user in the couple, not the caller
}

// Purpose-built, narrow-scope function: the caller can only trigger a
// notification about a couple relationship they are themselves part of,
// and the message content is fixed here rather than accepted from the
// client. This is deliberately less flexible than the generic
// send-push-notification function (which is superuser-only) so that an
// ordinary authenticated user can safely call it after connecting with a
// partner, without opening up arbitrary "notify anyone, anything" access.
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { partner_id }: NotifyRequest = await req.json();
    if (!partner_id) {
      return new Response(JSON.stringify({ error: "partner_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify a real couple relationship exists between the caller and the
    // named partner - prevents notifying an arbitrary user_id.
    const { data: couple, error: coupleError } = await supabase
      .from("couples")
      .select("id")
      .or(
        `and(user1_id.eq.${user.id},user2_id.eq.${partner_id}),and(user1_id.eq.${partner_id},user2_id.eq.${user.id})`,
      )
      .maybeSingle();

    if (coupleError) throw coupleError;
    if (!couple) {
      return new Response(JSON.stringify({ error: "No couple relationship found between these users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the caller's name for personalization.
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle();
    const callerName = callerProfile?.name || "Your partner";

    // Only the OTHER party gets a push - whoever just tapped "Connect"
    // already sees an immediate in-app confirmation (Alert.alert in
    // HomeScreen), so pushing them too was a redundant double
    // notification for the same event.
    const { data: tokenRows, error: tokensError } = await supabase
      .from("push_tokens")
      .select("token, user_id")
      .eq("user_id", partner_id);

    if (tokensError) throw tokensError;

    const messages = (tokenRows || []).map((row) => ({
      to: row.token,
      title: "You're connected! 🎉",
      body: `${callerName} connected with you. You're all set!`,
      sound: "default" as const,
    }));

    if (messages.length > 0) {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
        },
        body: JSON.stringify(messages),
      });
    }

    return new Response(JSON.stringify({ sent: messages.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error notifying partner connected:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
