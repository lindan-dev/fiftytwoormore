import { z } from "npm:zod@3.25.76";
import { getLocalDate, getWeekNumber, countLogsThisWeek, calculateStreakWeeks } from "./statsCalculations.ts";
import { corsHeaders, requireSuperuserOrServiceRole, sendPushToUsersDetailed } from "./pushHelpers.ts";
import { chooseDelivery, deliverPerson, overrideAllowed, inDeliveryWindow, type Decision, type TokenRow } from "./notificationDelivery.ts";

const RequestSchema = z.object({
  user_ids: z.array(z.string().uuid()).max(100).optional(),
  force: z.boolean().default(false),
  dry_run: z.boolean().default(false),
}).strict();

const NUDGE_MESSAGES = [
  "Weekend's coming up - time to connect? 💫",
  "No moments logged yet this week. Still time!",
  "A little reminder from fiftytwoormore 💛",
];

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export function createNotificationOrchestrator(type: "weekly-digest" | "midweek-nudge") {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "POST required" }, 405);
    try {
      const auth = await requireSuperuserOrServiceRole(req);
      if ("errorResponse" in auth) return auth.errorResponse;
      const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return json({ error: "Invalid request: use optional user_ids (UUID array), force and dry_run (booleans)" }, 400);
      const { user_ids, force, dry_run } = parsed.data;
      if (!overrideAllowed(auth.caller, force, dry_run)) return json({ error: "force and dry_run require a superuser or valid cron secret" }, 403);
      const { supabase } = auth;
      const { data: couples, error: couplesError } = await supabase.from("couples").select("id, user1_id, user2_id");
      if (couplesError) throw new Error("Couple lookup failed");
      const results: Array<{ couple_id: string; people: Array<Decision & { user_id: string }> }> = [];
      let pushSent = 0;
      let emailFallbacks = 0;

      for (const couple of couples || []) {
        const memberIds: string[] = [couple.user1_id, couple.user2_id];
        if (user_ids?.length && !memberIds.some(id => user_ids.includes(id))) continue;
        const { data: profiles, error: profileError } = await supabase.from("profiles").select("user_id, timezone").in("user_id", memberIds);
        if (profileError) throw new Error("Timezone lookup failed");
        // Preserve the existing couple timezone and Wednesday/Saturday 10:00 logic.
        const timezone = profiles?.[0]?.timezone || "Europe/Stockholm";
        const localDate = getLocalDate(timezone);
        const people: Array<Decision & { user_id: string }> = [];
        results.push({ couple_id: couple.id.slice(0, 8), people });
        if (!force && !inDeliveryWindow(type, localDate)) {
          for (const id of memberIds) people.push({ user_id: id.slice(0, 8), channel: "none", reason: "outside_delivery_window" });
          continue;
        }
        const weekNumber = getWeekNumber(localDate);
        const year = localDate.getFullYear();
        const { data: logs, error: logError } = await supabase.from("push_notification_log")
          .select("user_id, delivery_scope").in("user_id", memberIds).eq("type", type).eq("week_number", weekNumber).eq("year", year);
        if (logError) throw new Error("Notification history lookup failed");
        const { data: activities, error: activityError } = await supabase.from("activities").select("activity_date").in("user_id", memberIds);
        if (activityError) throw new Error("Activity lookup failed");
        const logsThisWeek = countLogsThisWeek(activities || [], timezone);
        const { data: tokenRows, error: tokenError } = await supabase.from("push_tokens").select("id, user_id, token, updated_at").in("user_id", memberIds);
        // Never interpret a failed lookup as missing tokens and email both people.
        if (tokenError) throw new Error("Push token lookup failed");
        const tokens: TokenRow[] = tokenRows || [];
        const streakWeeks = calculateStreakWeeks(activities || [], timezone);
        const title = type === "midweek-nudge" ? "fiftytwoormore" : logsThisWeek > 0 ? `${logsThisWeek} moments this week 🔥` : "Your week in review";
        const body = type === "midweek-nudge" ? NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)] : logsThisWeek > 0
          ? `You're on a ${streakWeeks}-week streak. Keep it going!` : "No moments logged yet this week - there's still time.";

        for (const userId of memberIds) {
          const decision = chooseDelivery(userId, tokens, logs || [], type !== "midweek-nudge" || logsThisWeek === 0);
          const result = await deliverPerson(decision, dry_run, async () => {
            const outcomes = await sendPushToUsersDetailed(supabase, [userId], title, body,
              { screen: "Home", action: type === "weekly-digest" ? "openStats" : "openLogDialog" }, true);
            return outcomes[0] || { user_id: userId, outcome: "no_token", accepted: 0, attempted: 0 };
          }, async () => {
            if (decision.channel === "email") console.log("Push outcome", { user_id: userId.slice(0, 8), outcome: "no_token", reason: decision.reason });
            const path = type === "weekly-digest" ? "send-digest-manual" : "send-midweek-nudge-manual";
            const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${path}`, {
              method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify({ couple_id: couple.id, recipient_user_id: userId }),
            });
            if (!response.ok) return false;
            const responseBody = await response.json();
            const successful = responseBody.sent ?? responseBody.successful ?? 0;
            return successful === 1;
          }, async (channel, outcome, reason) => {
            const { error } = await supabase.from("push_notification_log").insert({ user_id: userId, type, channel,
              week_number: weekNumber, year, delivery_scope: "person", outcome, reason });
            if (error) throw new Error("Notification log write failed");
            console.log("Notification delivery", { user_id: userId.slice(0, 8), type, channel, outcome, reason });
          });
          people.push({ user_id: userId.slice(0, 8), ...result });
          if (!dry_run && result.channel === "push") pushSent++;
          if (!dry_run && result.channel === "email") emailFallbacks++;
        }
      }
      return json({ dry_run, pushSent, emailFallbacks, couples: results.length, results });
    } catch (error) {
      // Raw provider errors can contain personal data; keep the response and log sanitized.
      const knownErrors = ["Couple lookup failed", "Timezone lookup failed", "Notification history lookup failed", "Activity lookup failed", "Push token lookup failed", "Notification log write failed"];
      const message = error instanceof Error && knownErrors.includes(error.message) ? error.message : "Notification processing failed";
      console.error("Notification orchestrator failed", { type, reason: message });
      return json({ error: "Notification processing failed; no missing-token fallback is inferred from lookup errors" }, 500);
    }
  };
}