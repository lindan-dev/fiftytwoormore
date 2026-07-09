// Push-first midweek nudge orchestrator (BACKLOG.md Ticket 2). Same
// pattern as send-weekly-digest-push - see that file for the full
// rationale on timezone gating, dedup, and the per-couple email-fallback
// simplification.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getLocalDate, getWeekNumber, countLogsThisWeek } from "../_shared/statsCalculations.ts";
import { corsHeaders, requireSuperuserOrServiceRole, sendPushToUsers } from "../_shared/pushHelpers.ts";

interface RequestBody {
  user_ids?: string[];
  force?: boolean;
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
    const { user_ids, force }: RequestBody = await req.json().catch(() => ({}));

    const { data: couples, error: couplesError } = await supabase
      .from("couples")
      .select("id, user1_id, user2_id");
    if (couplesError) throw couplesError;

    let pushSent = 0;
    let emailFallbacks = 0;
    const results: Array<{ couple_id: string; channel: string; skipped?: string }> = [];

    for (const couple of couples || []) {
      const memberIds = [couple.user1_id, couple.user2_id];
      if (user_ids?.length && !memberIds.some((id) => user_ids.includes(id))) continue;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, timezone")
        .in("user_id", memberIds);
      const timezone = profiles?.[0]?.timezone || "Europe/Stockholm";
      const localDate = getLocalDate(timezone);

      if (!force) {
        const isWednesday = localDate.getDay() === 3;
        const isTargetHour = localDate.getHours() === 10;
        if (!isWednesday || !isTargetHour) {
          results.push({ couple_id: couple.id, channel: "none", skipped: "not Wednesday 10:00 in their timezone" });
          continue;
        }
      }

      const weekNumber = getWeekNumber(localDate);
      const year = localDate.getFullYear();

      const { data: existingLog } = await supabase
        .from("push_notification_log")
        .select("id")
        .eq("user_id", couple.user1_id)
        .eq("type", "midweek-nudge")
        .eq("week_number", weekNumber)
        .eq("year", year)
        .maybeSingle();
      if (existingLog) {
        results.push({ couple_id: couple.id, channel: "none", skipped: "already sent this week" });
        continue;
      }

      const { data: activities } = await supabase
        .from("activities")
        .select("activity_date")
        .in("user_id", memberIds);
      const acts = (activities || []).map((a: { activity_date: string }) => ({ activity_date: a.activity_date }));
      const logsThisWeek = countLogsThisWeek(acts, timezone);

      if (logsThisWeek > 0) {
        results.push({ couple_id: couple.id, channel: "none", skipped: "already logged this week" });
        continue;
      }

      const { data: tokenRows } = await supabase
        .from("push_tokens")
        .select("user_id")
        .in("user_id", memberIds);
      const membersWithTokens = new Set((tokenRows || []).map((r: { user_id: string }) => r.user_id));
      const allMembersHaveTokens = memberIds.every((id) => membersWithTokens.has(id));

      let channel: "push" | "email-fallback";

      if (allMembersHaveTokens) {
        const message = NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)];
        await sendPushToUsers(supabase, memberIds, "fiftytwoormore", message, { screen: "Home", action: "openLogDialog" });
        pushSent += 1;
        channel = "push";
      } else {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-midweek-nudge-manual`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ couple_id: couple.id }),
        });
        emailFallbacks += 1;
        channel = "email-fallback";
      }

      await supabase.from("push_notification_log").insert({
        user_id: couple.user1_id,
        type: "midweek-nudge",
        channel,
        week_number: weekNumber,
        year,
      });

      results.push({ couple_id: couple.id, channel });
    }

    return new Response(JSON.stringify({ pushSent, emailFallbacks, couples: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in midweek nudge push orchestrator:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);