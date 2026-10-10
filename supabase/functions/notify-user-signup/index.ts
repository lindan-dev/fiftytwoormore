import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Used only if no superuser has an email address, so a signup is never silently missed.
const FALLBACK_RECIPIENT = "fiftytwoormore@lindaninc.com";

interface SignupNotification {
  email: string;
  name: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

// The name and email come from the sign-up form (anyone can type anything there),
// so they must never be placed into the email as HTML.
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name }: SignupNotification = await req.json();

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== "string" || !emailPattern.test(email)) {
      return json({ error: "Invalid email" }, 400);
    }
    const safeName = typeof name === "string" && name.trim() ? name.trim().slice(0, 100) : "there";

    // This function runs before the new user has a session, so it cannot require a login.
    // Instead, only notify about a signup that really happened: an account with this
    // email must have been created in the last few minutes.
    const { data: genuine, error: checkError } = await supabase.rpc("recent_signup_exists", { _email: email });
    if (checkError) throw new Error(`Signup check failed: ${checkError.message}`);
    if (genuine !== true) {
      console.log("Ignored a signup notification with no matching recent account");
      return json({ notified: false });
    }

    // Recipients: everyone with the superuser role (emails live in auth, so look them up by id).
    const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("user_id").eq("role", "superuser");
    if (roleError) throw new Error(`Could not read superusers: ${roleError.message}`);
    const recipients: string[] = [];
    for (const r of roleRows ?? []) {
      const { data } = await supabase.auth.admin.getUserById(r.user_id);
      if (data?.user?.email) recipients.push(data.user.email);
    }
    if (recipients.length === 0) recipients.push(FALLBACK_RECIPIENT);

    const when = new Date().toLocaleString("en-GB", { timeZone: "Europe/Stockholm" });
    const emailResponse = await resend.emails.send({
      from: "fiftytwoormore <digest@updates.fiftytwoormore.com>",
      to: recipients,
      subject: "New signup: fiftytwoormore",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">New user signed up</h1>
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            A new user has just signed up for fiftytwoormore.
          </p>
          <div style="margin: 30px 0; padding: 20px; background-color: #f5f5f5; border-radius: 8px;">
            <h2 style="color: #333; margin-top: 0;">User details</h2>
            <ul style="font-size: 14px; line-height: 1.8; color: #555;">
              <li><strong>Name:</strong> ${escapeHtml(safeName)}</li>
              <li><strong>Email:</strong> ${escapeHtml(email)}</li>
              <li><strong>Signed up at:</strong> ${escapeHtml(when)} (Stockholm time)</li>
            </ul>
          </div>
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
            <p style="font-size: 12px; color: #999;">
              &copy; ${new Date().getFullYear()} Lindan AB. All rights reserved.<br>
              Contact: <a href="mailto:fiftytwoormore@lindaninc.com" style="color: #666;">fiftytwoormore@lindaninc.com</a>
            </p>
          </div>
        </div>
      `,
    });

    console.log("Signup notification sent to", recipients.length, "recipient(s)");
    return json({ notified: true, recipients: recipients.length, ...(emailResponse as object) });
  } catch (error: any) {
    console.error("Error sending signup notification:", error);
    return json({ error: error.message }, 500);
  }
};

serve(handler);

