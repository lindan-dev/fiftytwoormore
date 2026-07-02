import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegisterRequest {
  token: string;
  device_type: string | null;
}

// A push token identifies a device, not a person. When a different user
// logs in on a device that was previously registered to someone else
// (common in testing - same simulator, different test accounts; also a
// real scenario if a phone changes hands), the old owner's row needs to
// be reassigned. RLS correctly prevents a client from updating/deleting a
// row it doesn't own, so that reassignment has to happen here, server-side,
// with the service role key - the client-side `push_tokens` upsert this
// replaces was hitting a 42501 (insufficient_privilege) RLS error in
// exactly this situation.
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { token: pushToken, device_type }: RegisterRequest = await req.json();
    if (!pushToken) {
      return new Response(JSON.stringify({ error: "token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Remove any existing row for this exact device token, regardless of
    // which user previously owned it, then insert a fresh row for the
    // currently authenticated user.
    const { error: deleteError } = await supabase
      .from("push_tokens")
      .delete()
      .eq("token", pushToken);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase
      .from("push_tokens")
      .insert({ user_id: user.id, token: pushToken, device_type });
    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error registering push token:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);