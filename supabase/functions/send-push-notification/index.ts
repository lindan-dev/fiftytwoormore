import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "npm:zod@3.25.76";
import { corsHeaders, requireSuperuserOrServiceRole, sendPushToUsersDetailed } from "../_shared/pushHelpers.ts";

const RequestSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(100),
  title: z.string().min(1).max(255),
  body: z.string().min(1).max(4096),
  data: z.record(z.unknown()).optional(),
}).strict();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = await requireSuperuserOrServiceRole(req, { allowCron: false });
    if ("errorResponse" in auth) return auth.errorResponse;
    const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Valid user_ids, title, body and optional data required" }, 400);
    const { user_ids, title, body, data } = parsed.data;
    const outcomes = await sendPushToUsersDetailed(auth.supabase, user_ids, title, body, data);
    return json({ sent: outcomes.reduce((sum, item) => sum + item.accepted, 0),
      results: outcomes.map(item => ({ ...item, user_id: item.user_id.slice(0, 8) })) });
  } catch {
    console.error("Push notification processing failed");
    return json({ error: "Push notification processing failed" }, 500);
  }
});
