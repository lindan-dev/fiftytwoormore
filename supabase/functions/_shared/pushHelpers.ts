import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Verifies the caller is either the service role key itself (trusted
 * server-to-server / future cron calls) or an authenticated superuser
 * (manual trigger from the admin panel). Returns the Supabase client to
 * use, or null + a Response to return immediately if unauthorized.
 */
export async function requireSuperuserOrServiceRole(
  req: Request,
): Promise<{ supabase: SupabaseClient } | { errorResponse: Response }> {
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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

  if (token === serviceRoleKey) {
    return { supabase };
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

  return { supabase };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Sends push messages for a set of user_ids, looking up their tokens. */
export async function sendPushToUsers(
  supabase: SupabaseClient,
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<number> {
  if (userIds.length === 0) return 0;

  const { data: tokenRows, error } = await supabase
    .from("push_tokens")
    .select("token")
    .in("user_id", userIds);

  if (error) throw error;
  if (!tokenRows || tokenRows.length === 0) return 0;

  const messages = tokenRows.map((row: { token: string }) => ({
    to: row.token,
    title,
    body,
    data,
    sound: "default" as const,
  }));

  for (const batch of chunk(messages, 100)) {
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
      },
      body: JSON.stringify(batch),
    });
  }

  return messages.length;
}