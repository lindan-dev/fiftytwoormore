// Push equivalent of send-midweek-nudge. Manually triggered for now (see
// BACKLOG.md Ticket 2). Unlike the email version, no A/B message variants
// yet - can be added later once we know push open/engagement rates.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { countLogsThisWeek } from "../_shared/statsCalculations.ts";
import { corsHeaders, requireSuperuserOrServiceRole, sendPushToUsers } from "../_shared/pushHelpers.ts";

interface RequestBody {
  user_ids?: string[];
}

const NUDGE_MESSAGES = [
  "Weekend's coming up - time to connect? 💫",
  "No moments logged yet this week. Still time!",
  "A little reminder from fiftytwoormore 💛",
];

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireSuperuserOrServiceRole(req);
  if ("errorResponse" in auth) return auth.errorResponse;
  const { supabase } = auth;

  try {
    const { user_ids }: RequestBody = await req.json().catch(() => ({}));

    const { data: couples, error: couplesError } = await supabase
      .from("couples")
      .select("id, user1_id, user2_id");
    if (couplesError) throw couplesError;

    let totalSent = 0;
    const results: Array<{ couple_id: string; sent: number; skipped?: string }> = [];

    for (const couple of couples || []) {
      const memberIds = [couple.user1_id, couple.user2_id];
      if (user_ids?.length && !memberIds.some((id) => user_ids.includes(id))) continue;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, timezone")
        .in("user_id", memberIds);
      const timezone = profiles?.[0]?.timezone || "Europe/Stockholm";

      const { data: activities } = await supabase
        .from("activities")
        .select("activity_date")
        .in("user_id", memberIds);

      const acts = (activities || []).map((a: { activity_date: string }) => ({ activity_date: a.activity_date }));
      const logsThisWeek = countLogsThisWeek(acts, timezone);

      if (logsThisWeek > 0) {
        results.push({ couple_id: couple.id, sent: 0, skipped: "already logged this week" });
        continue;
      }

      const message = NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)];
      const sent = await sendPushToUsers(supabase, memberIds, "fiftytwoormore", message, { screen: "Home", action: "openLogDialog" });
      totalSent += sent;
      results.push({ couple_id: couple.id, sent });
    }

    return new Response(JSON.stringify({ totalSent, couples: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending midweek nudge push:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
