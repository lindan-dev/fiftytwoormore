import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Where every click in our emails ends up. This used to be the old web app (app.fiftytwoormore.com).
// The bridge page tries to open the installed app and otherwise shows the App Store button.
const APP_URL = "https://fiftytwoormore.com/app-redirect?type=open";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The email type is only a label (for example "digest" or "activation-uncoupled-1") that the admin
// statistics group by. It used to be checked against a fixed list, but the list drifted out of sync
// with the emails we actually send (all activation emails and the manual sends were missing), so
// their clicks were silently dropped. Now any well-formed label is accepted: letters, digits and
// hyphens only, so nothing odd can end up in the database, and a new kind of email works at once.
const TYPE_REGEX = /^[a-z0-9-]{1,50}$/i;
const VARIANT_REGEX = /^[a-z0-9_-]{0,10}$/i;

const handler = async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const messageId = url.searchParams.get("mid");
    // "u" is what most emails send; the yearly review email sends "uid", so accept both
    // (before this, its clicks were never recorded because the user id looked missing).
    const userId = url.searchParams.get("u") ?? url.searchParams.get("uid");
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
    if (sanitizedType && !TYPE_REGEX.test(sanitizedType)) {
      console.log("Rejected malformed email type:", sanitizedType);
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
