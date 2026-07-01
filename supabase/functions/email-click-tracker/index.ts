import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const APP_URL = "https://app.fiftytwoormore.com";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_TYPES = new Set([
  "weekly-digest",
  "digest",
  "digest-nystart",
  "midweek-nudge",
  "yearly-review",
  "activation-uncoupled-day2",
  "activation-uncoupled-day6",
  "activation-uncoupled-day14",
  "activation-coupled-day2",
  "activation-coupled-day6",
  "activation-reengagement",
  "signup-notification",
]);
const VARIANT_REGEX = /^[a-z0-9_-]{0,10}$/i;

const handler = async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const messageId = url.searchParams.get("mid");
    const userId = url.searchParams.get("u");
    const emailType = url.searchParams.get("type");
    const variantKey = url.searchParams.get("v");

    // Validate required params
    if (!messageId || !userId) {
      console.log("Missing required params:", { messageId, userId });
      return Response.redirect(APP_URL, 302);
    }

    // Strict validation — reject malformed input to prevent DB pollution.
    if (!UUID_REGEX.test(userId) || !UUID_REGEX.test(messageId)) {
      console.log("Invalid UUID format for userId or messageId");
      return Response.redirect(APP_URL, 302);
    }
    const sanitizedType = (emailType || "").slice(0, 50);
    if (sanitizedType && !ALLOWED_TYPES.has(sanitizedType)) {
      console.log("Rejected unknown email type:", sanitizedType);
      return Response.redirect(APP_URL, 302);
    }
    const sanitizedVariant = (variantKey || "").slice(0, 10);
    if (sanitizedVariant && !VARIANT_REGEX.test(sanitizedVariant)) {
      console.log("Rejected invalid variant key:", sanitizedVariant);
      return Response.redirect(APP_URL, 302);
    }
    const sanitizedMessageId = messageId;
    const sanitizedUserId = userId;

    console.log("Click tracked:", {
      messageId: sanitizedMessageId,
      userId: sanitizedUserId,
      type: sanitizedType,
      variant: sanitizedVariant
    });

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert click event (ignore duplicates via unique constraint)
    const { error } = await supabase
      .from("email_events")
      .upsert({
        message_id: sanitizedMessageId,
        user_id: sanitizedUserId,
        type: sanitizedType,
        variant_key: sanitizedVariant || null,
        event: "clicked",
        event_at: new Date().toISOString()
      }, {
        onConflict: "message_id,event"
      });

    if (error) {
      console.error("Error logging click:", error);
    }

    // Redirect to app
    return Response.redirect(APP_URL, 302);
    
  } catch (error) {
    console.error("Error in click tracker:", error);
    // Always redirect even on error
    return Response.redirect(APP_URL, 302);
  }
};

serve(handler);
