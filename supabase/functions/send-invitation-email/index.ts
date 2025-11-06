import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationEmailRequest {
  receiverEmail: string;
  senderName: string;
  invitationId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { receiverEmail, senderName, invitationId }: InvitationEmailRequest = await req.json();
    
    console.log("Sending invitation email to:", receiverEmail);

    const appUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "") || "";
    const signupLink = `${appUrl}?invitation=${invitationId}`;

    const emailResponse = await resend.emails.send({
      from: "52 or More <onboarding@resend.dev>",
      to: ["fiftytwoormore@lindaninc.com"],
      subject: "Partner Invitation Created - 52 or More",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Partner Invitation Created!</h1>
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            <strong>${senderName}</strong> has created an invitation to connect with a partner.
          </p>
          <div style="margin: 30px 0; padding: 20px; background-color: #f5f5f5; border-radius: 8px;">
            <h2 style="color: #333; margin-top: 0;">Invitation Details:</h2>
            <ul style="font-size: 14px; line-height: 1.8; color: #555;">
              <li><strong>Sender:</strong> ${senderName}</li>
              <li><strong>Recipient Email:</strong> ${receiverEmail}</li>
              <li><strong>Invitation ID:</strong> ${invitationId}</li>
              <li><strong>Created at:</strong> ${new Date().toLocaleString()}</li>
            </ul>
          </div>
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
            <p style="font-size: 12px; color: #999;">
              © ${new Date().getFullYear()} Lindan AB. All rights reserved.<br>
              Contact: <a href="mailto:fiftytwoormore@lindaninc.com" style="color: #666;">fiftytwoormore@lindaninc.com</a>
            </p>
          </div>
        </div>
      `,
    });

    console.log("Invitation email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending invitation email:", error);
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
