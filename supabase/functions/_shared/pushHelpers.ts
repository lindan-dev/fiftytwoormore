import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as sdkCorsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { recentTokens, sendExpoTickets, type TokenRow, type PushOutcome } from "./notificationDelivery.ts";

export const corsHeaders = {
  ...sdkCorsHeaders,
  "Access-Control-Allow-Headers": `${sdkCorsHeaders["Access-Control-Allow-Headers"]}, x-cron-secret`,
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing configuration: ${name}`);
  return value;
}

/**
 * Verifies the caller is either the service role key itself (trusted
 * server-to-server / future cron calls) or an authenticated superuser
 * (manual trigger from the admin panel). Returns the Supabase client to
 * use, or null + a Response to return immediately if unauthorized.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export async function requireSuperuserOrServiceRole(
  req: Request,
  options: { allowCron?: boolean } = {},
): Promise<{ supabase: SupabaseClient; caller: "cron" | "service-role" | "superuser" } | { errorResponse: Response }> {
  // Trusted cron caller: shared secret in x-cron-secret. Never accepted when
  // either side is empty.
  const cronHeader = req.headers.get("x-cron-secret") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (options.allowCron !== false && cronHeader && cronSecret && constantTimeEqual(cronHeader, cronSecret)) {
    return {
      supabase: createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY")),
      caller: "cron",
    };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return {
      errorResponse: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const token = authHeader.replace("Bearer ", "");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(requiredEnv("SUPABASE_URL"), serviceRoleKey);

  if (token === serviceRoleKey) {
    return { supabase, caller: "service-role" };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return {
      errorResponse: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "superuser")
    .maybeSingle();

  if (!role) {
    return {
      errorResponse: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  return { supabase, caller: "superuser" };
}

/** Detailed per-person results; all callers share ticket handling and cleanup. */
export async function sendPushToUsersDetailed(
  supabase: SupabaseClient,
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  recentOnly = false,
): Promise<PushOutcome[]> {
  if (userIds.length === 0) return [];

  const { data: tokenRows, error } = await supabase
    .from("push_tokens")
    .select("id, user_id, token, updated_at")
    .in("user_id", userIds);

  if (error) throw new Error("Push token lookup failed");
  const rows: TokenRow[] = tokenRows || [];
  const outcomes = await sendExpoTickets(recentOnly ? recentTokens(rows) : rows, userIds, title, body, data, async row => {
    // Match ownership too, so a concurrent reassignment cannot delete another user's token.
    const { error: deleteError } = await supabase.from("push_tokens").delete().eq("id", row.id).eq("user_id", row.user_id).eq("token", row.token);
    if (deleteError) console.error("Dead push token cleanup failed", { user_id: row.user_id.slice(0, 8) });
  });
  for (const result of outcomes) {
    console.log("Push outcome", { user_id: result.user_id.slice(0, 8), outcome: result.outcome, attempted: result.attempted, accepted: result.accepted });
  }
  return outcomes;
}

/** Compatible numeric API for existing callers: number of OK Expo tickets. */
export async function sendPushToUsers(
  supabase: SupabaseClient, userIds: string[], title: string, body: string, data?: Record<string, unknown>,
): Promise<number> {
  const results = await sendPushToUsersDetailed(supabase, userIds, title, body, data);
  return results.reduce((sum, result) => sum + result.accepted, 0);
}