// Push equivalent of send-activation-emails. Targets users who signed up
// recently but haven't logged a single activity yet. Manually triggered
// for now (see BACKLOG.md Ticket 2).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, requireSuperuserOrServiceRole, sendPushToUsers } from "../_shared/pushHelpers.ts";

interface RequestBody {
  user_ids?: string[];
  max_days_since_signup?: number; // default 14
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireSuperuserOrServiceRole(req);
  if ("errorResponse" in auth) return auth.errorResponse;
  const { supabase } = auth;

  try {
    const { user_ids, max_days_since_signup = 14 }: RequestBody = await req.json().catch(() => ({}));

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - max_days_since_signup);

    let query = supabase
      .from("profiles")
      .select("user_id, name, signup_at, created_at")
      .gte("signup_at", cutoff.toISOString());

    if (user_ids?.length) query = query.in("user_id", user_ids);

    const { data: profiles, error: profilesError } = await query;
    if (profilesError) throw profilesError;

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ totalSent: 0, candidates: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const candidateIds = profiles.map((p: { user_id: string }) => p.user_id);
    const { data: activities } = await supabase
      .from("activities")
      .select("user_id")
      .in("user_id", candidateIds);

    const usersWithActivity = new Set((activities || []).map((a: { user_id: string }) => a.user_id));
    const usersWithoutActivity = candidateIds.filter((id: string) => !usersWithActivity.has(id));

    const sent = await sendPushToUsers(
      supabase,
      usersWithoutActivity,
      "Ready when you are 💛",
      "Log your first moment on fiftytwoormore - it only takes a few seconds.",
      { screen: "Home", action: "openLogDialog" },
    );

    return new Response(
      JSON.stringify({ totalSent: sent, candidates: candidateIds.length, targeted: usersWithoutActivity.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error sending activation nudge push:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
