// Daily admin digest: funnel, typical timings, new signups and users who got stuck,
// emailed to everyone with the superuser role. Run by cron; can also be triggered
// manually. Body options: { "dry_run": true } returns the result without sending
// anything and without marking any alerts as sent.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { corsHeaders, requireSuperuserOrServiceRole } from "../_shared/pushHelpers.ts";
import { buildDigest, type FunnelRow, type StuckRow } from "../_shared/adminInsights.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const FROM = "fiftytwoormore <digest@updates.fiftytwoormore.com>";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireSuperuserOrServiceRole(req);
  if ("errorResponse" in auth) return auth.errorResponse;
  const { supabase } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;

    const { data: funnel, error: funnelError } = await supabase.from("user_funnel").select("*");
    if (funnelError) throw new Error(`user_funnel: ${funnelError.message}`);
    const { data: stuck, error: stuckError } = await supabase.from("stuck_users").select("*");
    if (stuckError) throw new Error(`stuck_users: ${stuckError.message}`);
    const { data: logged, error: loggedError } = await supabase.from("admin_alert_log").select("user_id, rule");
    if (loggedError) throw new Error(`admin_alert_log: ${loggedError.message}`);

    const alreadyAlerted = new Set((logged ?? []).map((l: { user_id: string; rule: string }) => `${l.user_id}:${l.rule}`));
    const stuckRows = (stuck ?? []) as StuckRow[];
    const newAlerts = stuckRows.filter((s) => !alreadyAlerted.has(`${s.user_id}:${s.rule}`));

    // Recipients: everyone with the superuser role (emails live in auth, so look them up by id).
    const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("user_id").eq("role", "superuser");
    if (roleError) throw new Error(`user_roles: ${roleError.message}`);
    const recipients: string[] = [];
    for (const r of roleRows ?? []) {
      const { data } = await supabase.auth.admin.getUserById(r.user_id);
      if (data?.user?.email) recipients.push(data.user.email);
    }

    const digest = buildDigest({
      rows: (funnel ?? []) as FunnelRow[],
      newAlerts,
      stuckTotal: stuckRows.length,
      now: new Date(),
    });

    const summary = {
      recipients,
      users: (funnel ?? []).length,
      new_alerts: newAlerts.length,
      stuck_total: stuckRows.length,
      subject: digest.subject,
    };

    if (dryRun) return json({ dry_run: true, ...summary, text: digest.text });
    if (!recipients.length) return json({ error: "No users with the superuser role have an email address", ...summary }, 400);

    const { error: sendError } = await resend.emails.send({
      from: FROM,
      to: recipients,
      subject: digest.subject,
      html: digest.html,
      text: digest.text,
    });
    if (sendError) throw new Error(`Resend: ${sendError.message}`);

    // Mark alerts as sent only after the email actually went out, so a failed send is retried next run.
    if (newAlerts.length) {
      const { error: logError } = await supabase
        .from("admin_alert_log")
        .upsert(newAlerts.map((a) => ({ user_id: a.user_id, rule: a.rule })), { onConflict: "user_id,rule", ignoreDuplicates: true });
      if (logError) throw new Error(`admin_alert_log insert: ${logError.message}`);
    }

    return json({ sent: true, ...summary });
  } catch (error) {
    console.error("admin-daily-digest failed:", error);
    return json({ error: (error as Error).message }, 500);
  }
};

serve(handler);

