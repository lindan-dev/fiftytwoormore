import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const userId = user.id;

    const { data: coupleData } = await supabase
      .from("couples")
      .select("*")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .maybeSingle();

    if (coupleData) {
      const partnerId = coupleData.user1_id === userId ? coupleData.user2_id : coupleData.user1_id;
      await supabase.from("activities").delete().in("user_id", [userId, partnerId]);
      await supabase.from("couples").delete().or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
    } else {
      await supabase.from("activities").delete().eq("user_id", userId);
    }

    await supabase.from("couple_invitations").delete().eq("sender_id", userId);
    await supabase.from("push_tokens").delete().eq("user_id", userId);
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("profiles").delete().eq("user_id", userId);

    // Analytics and log tables. A database cascade (migration 003) also covers these when the
    // account is deleted, but we clear them explicitly too. Best effort: an error here is logged
    // and must never stop someone from deleting their account.
    for (const table of ["user_events", "email_digest_log", "email_events", "push_notification_log"]) {
      const { error: cleanupError } = await supabase.from(table).delete().eq("user_id", userId);
      if (cleanupError) console.error(`Cleanup failed for ${table}:`, cleanupError.message);
    }

    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteUserError) throw deleteUserError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);