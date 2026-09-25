import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  name: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name }: WelcomeEmailRequest = await req.json();

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== "string" || !emailPattern.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const safeName = typeof name === "string" && name.trim() ? name.trim().slice(0, 100) : "there";

    console.log("Sending welcome email for new signup:", email);

    const emailResponse = await resend.emails.send({
      from: "fiftytwoormore <updates@fiftytwoormore.com>",
      to: ["fiftytwoormore@lindaninc.com"],
      subject: "New User Signup - 52 or More",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">New User Signed Up!</h1>
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            A new user has just signed up for 52 or More.
          </p>
          <div style="margin: 30px 0; padding: 20px; background-color: #f5f5f5; border-radius: 8px;">
            <h2 style="color: #333; margin-top: 0;">User Details:</h2>
            <ul style="font-size: 14px; line-height: 1.8; color: #555;">
              <li><strong>Name:</strong> ${safeName}</li>
              <li><strong>Email:</strong> ${email}</li>
              <li><strong>Signed up at:</strong> ${new Date().toLocaleString()}</li>
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

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

