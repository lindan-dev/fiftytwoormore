// Tells a partner that the other one has answered this week's question
// (BACKLOG.md Ticket 16, "Three things"). Called by the app right after a
// FIRST submit. The push text never contains the question or any answer: the
// lock screen can be seen by other people.
//
// Safe to call more than once: the answer row is "claimed" atomically through
// partner_notified_at, so a given answer sends at most one push.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, sendPushToUsers } from "../_shared/pushHelpers.ts";

const FLAG = "three_things";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { round_id }: { round_id?: string } = await req.json().catch(() => ({}));
    if (!round_id) return json({ error: "round_id is required" }, 400);

    // Flag first: when the feature is off nothing is sent, whatever the app says.
    const { data: enabled, error: flagError } = await supabase.rpc("feature_enabled_for", {
      flag_key: FLAG,
      uid: user.id,
    });
    if (flagError) throw flagError;
    if (!enabled) return json({ sent: 0, skipped: "feature_off" });

    // The round must belong to the caller's couple.
    const { data: round } = await supabase
      .from("prompt_rounds")
      .select("id, couple_id")
      .eq("id", round_id)
      .maybeSingle();
    if (!round) return json({ error: "Round not found" }, 404);

    const { data: couple } = await supabase
      .from("couples")
      .select("user1_id, user2_id")
      .eq("id", round.couple_id)
      .maybeSingle();
    if (!couple || (couple.user1_id !== user.id && couple.user2_id !== user.id)) {
      return json({ error: "Round not found" }, 404);
    }
    const partnerId = couple.user1_id === user.id ? couple.user2_id : couple.user1_id;

    // The caller must actually have answered.
    const { data: mine } = await supabase
      .from("prompt_answers")
      .select("id")
      .eq("round_id", round_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!mine) return json({ error: "No answer to announce" }, 400);

    // Claim the notification: only the first caller gets a row back.
    const { data: claimed, error: claimError } = await supabase
      .from("prompt_answers")
      .update({ partner_notified_at: new Date().toISOString() })
      .eq("id", mine.id)
      .is("partner_notified_at", null)
      .select("id");
    if (claimError) throw claimError;
    if (!claimed || claimed.length === 0) return json({ sent: 0, skipped: "already_notified" });

    // Only notify a partner who can see the feature themselves.
    const { data: partnerEnabled } = await supabase.rpc("feature_enabled_for", { flag_key: FLAG, uid: partnerId });
    if (!partnerEnabled) return json({ sent: 0, skipped: "partner_feature_off" });

    // Has the partner already answered? Then the reveal is waiting for them.
    const { data: theirs } = await supabase
      .from("prompt_answers")
      .select("id")
      .eq("round_id", round_id)
      .eq("user_id", partnerId)
      .maybeSingle();

    const body = theirs ? "Your partner answered. Tap to see." : "Your partner answered. Add yours to see theirs.";

    const sent = await sendPushToUsers(supabase, [partnerId], "fiftytwoormore", body, {
      screen: "Home",
      action: "openQuestion",
    });

    return json({ sent });
  } catch (error) {
    console.error("Error in notify-partner-answered:", error);
    return json({ error: "Internal error" }, 500);
  }
};

serve(handler);
