import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const APP_URL = "https://app.fiftytwoormore.com";

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

    // Sanitize inputs (basic validation)
    const sanitizedMessageId = messageId.slice(0, 100);
    const sanitizedUserId = userId.slice(0, 100);
    const sanitizedType = (emailType || "").slice(0, 50);
    const sanitizedVariant = (variantKey || "").slice(0, 10);

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
