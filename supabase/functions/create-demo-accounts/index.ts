import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// One-off setup utility for creating an App Store review demo account:
// two auth users, pre-connected as a couple, with sample activity history
// so a reviewer sees a populated app immediately instead of an empty
// "waiting for partner" state or having to go through the whole
// signup -> email confirmation -> invite flow themselves.
//
// Gated with a shared setup key (not a real user JWT) since this creates
// real accounts with service-role privileges - not something to leave
// callable by anyone who finds the URL. DELETE THIS FUNCTION after use.
const SETUP_KEY = "fiftytwoormore-demo-setup-2026";

const EMOJIS = ["🍑", "🍆", "💋", "🔥", "🍩"];
const NOTES = [null, null, "Great morning together", null, "Anniversary weekend", null];

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body.setup_key !== SETUP_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const demo1Email = body.demo1_email || "demo1@fiftytwoormore.com";
    const demo2Email = body.demo2_email || "demo2@fiftytwoormore.com";
    const password = body.password || "AppReviewDemo2026!";

    // Create both users with email already confirmed - no confirmation
    // email needed for a demo account.
    const { data: user1, error: err1 } = await supabase.auth.admin.createUser({
      email: demo1Email,
      password,
      email_confirm: true,
      user_metadata: { name: "Alex" },
    });
    if (err1) throw new Error(`Creating demo1: ${err1.message}`);

    const { data: user2, error: err2 } = await supabase.auth.admin.createUser({
      email: demo2Email,
      password,
      email_confirm: true,
      user_metadata: { name: "Sam" },
    });
    if (err2) throw new Error(`Creating demo2: ${err2.message}`);

    const user1Id = user1.user.id;
    const user2Id = user2.user.id;

    // handle_new_user trigger creates the profiles rows automatically on
    // insert into auth.users - no need to insert those manually here.

    // couples has a check constraint requiring user1_id < user2_id
    // (lexicographically), to prevent the same pair being stored twice in
    // reversed order - sort the two generated UUIDs before inserting,
    // since there's no guarantee which one comes out smaller.
    const [orderedUser1, orderedUser2] = [user1Id, user2Id].sort();

    const { error: coupleError } = await supabase.from("couples").insert({
      user1_id: orderedUser1,
      user2_id: orderedUser2,
      anniversary: "2024-02-14",
    });
    if (coupleError) throw new Error(`Creating couple: ${coupleError.message}`);

    // Spread sample activities over the last ~10 weeks, alternating which
    // partner logged it, with a mix of emoji/notes/location so Stats,
    // Calendar, and the Map tab all have something to show.
    const activities = [];
    const now = new Date();
    for (let i = 0; i < 18; i++) {
      const daysAgo = i * 4 + Math.floor(Math.random() * 3);
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);

      const hasLocation = i % 3 === 0;
      activities.push({
        user_id: i % 2 === 0 ? user1Id : user2Id,
        activity_date: date.toISOString(),
        emoji: EMOJIS[i % EMOJIS.length],
        notes: NOTES[i % NOTES.length],
        location_label: hasLocation ? "Stockholm" : null,
        location_country: hasLocation ? "SE" : null,
        location_lat: hasLocation ? 59.3293 : null,
        location_lng: hasLocation ? 18.0686 : null,
      });
    }

    const { error: activitiesError } = await supabase.from("activities").insert(activities);
    if (activitiesError) throw new Error(`Inserting activities: ${activitiesError.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        demo_account: { email: demo1Email, password },
        partner_account: { email: demo2Email, password },
        activities_created: activities.length,
        note: "Log in with either account - they're already connected as a couple with sample history. Give Apple the demo_account credentials.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error creating demo accounts:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
