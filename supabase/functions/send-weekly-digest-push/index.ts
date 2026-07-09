// Push-first weekly digest orchestrator (BACKLOG.md Ticket 2). Runs
// hourly via cron (see migration 20260709095418_push_first_notifications)
// and internally gates to "is it currently ~Saturday 10:00 in this
// couple's timezone", exactly mirroring send-weekly-digest's own
// timezone-local check - a fixed UTC cron time would fire at the wrong
// local hour depending on where a couple lives.
//
// Per couple: if every member has a registered push token, send push
// only. If ANY member lacks one, fall back to the existing
// send-digest-manual email function for the whole couple (that function
// already emails both partners' addresses, so partial per-member email
// suppression isn't attempted here - a couple with one missing token
// gets the email version for both, which is a reasonable simplification
// rather than building per-member email splitting).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getLocalDate, getWeekNumber, countLogsThisWeek, calculateStreakWeeks } from "../_shared/statsCalculations.ts";
import { corsHeaders, requireSuperuserOrServiceRole, sendPushToUsers } from "../_shared/pushHelpers.ts";

interface RequestBody {
  user_ids?: string[]; // optional: scope to specific users for manual testing
  force?: boolean; // optional: skip the Saturday-10am gate, for manual testing
}

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
        const isSaturday = localDate.getDay() === 6;
        const isTargetHour = localDate.getHours() === 10;
        if (!isSaturday || !isTargetHour) {
          results.push({ couple_id: couple.id, channel: "none", skipped: "not Saturday 10:00 in their timezone" });
          continue;
        }
      }

      const weekNumber = getWeekNumber(localDate);
      const year = localDate.getFullYear();

      const { data: existingLog } = await supabase
        .from("push_notification_log")
        .select("id")
        .eq("user_id", couple.user1_id)
        .eq("type", "weekly-digest")
        .eq("week_number", weekNumber)
        .eq("year", year)
        .maybeSingle();
      if (existingLog) {
        results.push({ couple_id: couple.id, channel: "none", skipped: "already sent this week" });
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
        const { data: activities } = await supabase
          .from("activities")
          .select("activity_date")
          .in("user_id", memberIds);
        const acts = (activities || []).map((a: { activity_date: string }) => ({ activity_date: a.activity_date }));
        const logsThisWeek = countLogsThisWeek(acts, timezone);
        const streakWeeks = calculateStreakWeeks(acts, timezone);

        const title = logsThisWeek > 0 ? `${logsThisWeek} moments this week 🔥` : "Your week in review";
        const body =
          logsThisWeek > 0
            ? `You're on a ${streakWeeks}-week streak. Keep it going!`
            : "No moments logged yet this week - there's still time.";

        await sendPushToUsers(supabase, memberIds, title, body, { screen: "Home", action: "openStats" });
        pushSent += 1;
        channel = "push";
      } else {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-digest-manual`, {
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
        type: "weekly-digest",
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
    console.error("Error in weekly digest push orchestrator:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);