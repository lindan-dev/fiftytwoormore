import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, requireSuperuserOrServiceRole, sendPushToUsers } from "../_shared/pushHelpers.ts";

interface RequestBody {
  user_ids?: string[];
  year?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireSuperuserOrServiceRole(req);
  if ("errorResponse" in auth) return auth.errorResponse;
  const { supabase } = auth;

  try {
    const body: RequestBody = await req.json().catch(() => ({}));
    const reviewYear = body.year ?? new Date().getFullYear() - 1;
    const yearStart = `${reviewYear}-01-01T00:00:00Z`;
    const yearEnd = `${reviewYear + 1}-01-01T00:00:00Z`;

    let query = supabase
      .from("activities")
      .select("user_id")
      .gte("activity_date", yearStart)
      .lt("activity_date", yearEnd);

    if (body.user_ids?.length) query = query.in("user_id", body.user_ids);

    const { data: activities, error } = await query;
    if (error) throw error;

    const targetIds = [...new Set((activities || []).map((a: { user_id: string }) => a.user_id))];

    const sent = await sendPushToUsers(
      supabase,
      targetIds,
      `Your ${reviewYear} Year in Review is ready ✨`,
      "Relive your highlights, streaks, and favourite ways to connect.",
      { screen: "YearInReview", year: reviewYear },
    );

    return new Response(JSON.stringify({ totalSent: sent, targeted: targetIds.length, year: reviewYear }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending year in review push:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);