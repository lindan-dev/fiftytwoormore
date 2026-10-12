// Deletes a user from the admin website. Same data cleanup as the app's own "delete account"
// (delete-account), because the shared history belongs to the couple: if the account is
// connected to a partner, both partners' activities are deleted. On top of that:
//   - only a signed-in superuser may call it (not the service role, not anyone else)
//   - you cannot delete yourself, and you cannot delete another superuser (team account)
//   - the caller must repeat the account's email (the website asks the admin to type it)
//   - every deletion is written to admin_audit_log (ids and counts only, no personal data)
// If a core cleanup step fails, the account is NOT deleted, so nothing is left half done.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
    const token = authHeader.replace(/^Bearer\s+/i, "");

    // Deliberately no service-role shortcut here: this must be a real person who is a superuser.
    if (token === serviceRoleKey) return json({ error: "Only a signed-in superuser can delete accounts" }, 403);

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const actor = authData?.user;
    if (authError || !actor) return json({ error: "Unauthorized" }, 401);

    const { data: actorRole } = await supabase
      .from("user_roles").select("role").eq("user_id", actor.id).eq("role", "superuser").maybeSingle();
    if (!actorRole) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const userId: unknown = body?.user_id;
    const confirmEmail: unknown = body?.confirm_email;
    if (typeof userId !== "string" || !UUID.test(userId) || typeof confirmEmail !== "string") {
      return json({ error: "user_id (uuid) and confirm_email are required" }, 400);
    }

    const { data: targetData, error: targetError } = await supabase.auth.admin.getUserById(userId);
    const target = targetData?.user;
    if (targetError || !target) return json({ error: "User not found" }, 404);

    if (target.id === actor.id) return json({ error: "You cannot delete your own account here" }, 400);

    const { data: targetRole } = await supabase
      .from("user_roles").select("role").eq("user_id", target.id).eq("role", "superuser").maybeSingle();
    if (targetRole) {
      return json({ error: "Team accounts (superusers) cannot be deleted here. Remove the superuser role first." }, 400);
    }

    const expected = (target.email ?? target.id).toLowerCase();
    if (confirmEmail.trim().toLowerCase() !== expected) {
      return json({ error: "The confirmation does not match this account" }, 400);
    }

    // What will be removed (also reported back and written to the audit log).
    const { data: couple } = await supabase
      .from("couples").select("id, user1_id, user2_id").or(`user1_id.eq.${target.id},user2_id.eq.${target.id}`).maybeSingle();
    const partnerId: string | null = couple ? (couple.user1_id === target.id ? couple.user2_id : couple.user1_id) : null;

    const { count: ownActivities } = await supabase
      .from("activities").select("id", { count: "exact", head: true }).eq("user_id", target.id);
    let partnerActivities = 0;
    if (partnerId) {
      const { count } = await supabase.from("activities").select("id", { count: "exact", head: true }).eq("user_id", partnerId);
      partnerActivities = count ?? 0;
    }

    // Core cleanup. A failure here stops everything BEFORE the account is deleted.
    const { error: activitiesError } = partnerId
      ? await supabase.from("activities").delete().in("user_id", [target.id, partnerId])
      : await supabase.from("activities").delete().eq("user_id", target.id);
    if (activitiesError) throw new Error(`Could not delete activities: ${activitiesError.message}`);

    if (couple) {
      const { error: coupleError } = await supabase.from("couples").delete().eq("id", couple.id);
      if (coupleError) throw new Error(`Could not delete the couple: ${coupleError.message}`);
    }

    // The rest also cascades from the account itself; cleared explicitly too, best effort.
    for (const [table, column] of [
      ["couple_invitations", "sender_id"],
      ["push_tokens", "user_id"],
      ["user_roles", "user_id"],
      ["profiles", "user_id"],
      ["user_events", "user_id"],
      ["email_digest_log", "user_id"],
      ["email_events", "user_id"],
      ["push_notification_log", "user_id"],
    ] as const) {
      const { error } = await supabase.from(table).delete().eq(column, target.id);
      if (error) console.error(`Cleanup failed for ${table}:`, error.message);
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(target.id);
    if (deleteError) throw new Error(`Could not delete the account: ${deleteError.message}`);

    // Ids and counts only. No email, no name.
    const details = {
      had_partner: !!couple,
      partner_user_id: partnerId,
      own_activities_deleted: ownActivities ?? 0,
      partner_activities_deleted: partnerActivities,
    };
    const { error: auditError } = await supabase.from("admin_audit_log").insert({
      action: "delete_user",
      actor_user_id: actor.id,
      target_user_id: target.id,
      details,
    });
    if (auditError) console.error("Audit log failed (the account WAS deleted):", auditError.message);

    return json({ success: true, deleted_user_id: target.id, audit_logged: !auditError, ...details });
  } catch (error) {
    console.error("admin-delete-user failed:", error);
    return json({ error: (error as Error).message }, 500);
  }
};

serve(handler);

