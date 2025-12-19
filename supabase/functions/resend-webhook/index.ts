import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

// Map Resend event types to our event types
const EVENT_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.clicked": "clicked"
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get raw body for signature verification
    const body = await req.text();
    const payload = JSON.parse(body);
    
    console.log("Received Resend webhook:", JSON.stringify(payload, null, 2));
    
    // Extract webhook headers for signature verification
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");
    
    // TODO: Implement signature verification if RESEND_WEBHOOK_SECRET is set
    // For now, we'll proceed without verification but log a warning
    if (!webhookSecret) {
      console.warn("RESEND_WEBHOOK_SECRET not configured - webhook signature not verified");
    }
    
    const eventType = payload.type;
    const data = payload.data;
    
    if (!eventType || !data) {
      console.log("Invalid webhook payload - missing type or data");
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const mappedEvent = EVENT_MAP[eventType];
    if (!mappedEvent) {
      console.log(`Ignoring unknown event type: ${eventType}`);
      return new Response(JSON.stringify({ message: "Event ignored" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const messageId = data.email_id;
    if (!messageId) {
      console.log("No email_id in webhook data");
      return new Response(JSON.stringify({ error: "Missing email_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    // Look up the original email log by Resend's message ID to get user_id, type, and our tracking message_id
    const { data: emailLog, error: lookupError } = await supabase
      .from("email_digest_log")
      .select("user_id, type, variant_key, message_id")
      .eq("resend_message_id", messageId)
      .maybeSingle();
    
    if (lookupError) {
      console.error("Error looking up email log:", lookupError);
    }
    
    // Build metadata
    const metadata: Record<string, any> = {};
    if (data.bounce) {
      metadata.bounce_type = data.bounce.type;
      metadata.bounce_message = data.bounce.message;
    }
    if (data.complaint) {
      metadata.complaint_type = data.complaint.type;
    }
    if (data.click) {
      metadata.click_url = data.click.link;
    }
    
    // Use our tracking message_id if found, otherwise fall back to Resend's message ID
    const trackingMessageId = emailLog?.message_id || messageId;
    
    // Insert event (upsert to handle duplicates)
    const { error: insertError } = await supabase
      .from("email_events")
      .upsert({
        message_id: trackingMessageId,
        user_id: emailLog?.user_id || "00000000-0000-0000-0000-000000000000",
        type: emailLog?.type || "unknown",
        variant_key: emailLog?.variant_key || null,
        event: mappedEvent,
        event_at: data.created_at || new Date().toISOString(),
        metadata: Object.keys(metadata).length > 0 ? metadata : null
      }, {
        onConflict: "message_id,event"
      });
    
    if (insertError) {
      console.error("Error inserting event:", insertError);
      return new Response(JSON.stringify({ error: "Failed to log event" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    console.log(`Successfully logged ${mappedEvent} event for message ${messageId}`);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );
  }
};

serve(handler);
