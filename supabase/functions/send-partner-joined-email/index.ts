import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PartnerJoinedEmailRequest {
  senderEmail: string;
  senderName: string;
  partnerName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { senderEmail, senderName, partnerName }: PartnerJoinedEmailRequest = await req.json();
    
    console.log("Sending partner joined email to:", senderEmail);

    const emailResponse = await resend.emails.send({
      from: "52 or More <onboarding@resend.dev>",
      to: ["fiftytwoormore@lindaninc.com"],
      subject: "Partner Accepted Invitation - 52 or More",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Partner Accepted Invitation!</h1>
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            <strong>${partnerName}</strong> has accepted the invitation from <strong>${senderName}</strong>.
          </p>
          <div style="margin: 30px 0; padding: 20px; background-color: #f0f9ff; border-radius: 8px; text-align: center;">
            <p style="font-size: 18px; color: #333; margin: 0;">
              🎊 They're now connected! 🎊
            </p>
          </div>
          <div style="margin: 30px 0; padding: 20px; background-color: #f5f5f5; border-radius: 8px;">
            <h2 style="color: #333; margin-top: 0;">Connection Details:</h2>
            <ul style="font-size: 14px; line-height: 1.8; color: #555;">
              <li><strong>User 1:</strong> ${senderName} (${senderEmail})</li>
              <li><strong>User 2:</strong> ${partnerName}</li>
              <li><strong>Connected at:</strong> ${new Date().toLocaleString()}</li>
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

    console.log("Partner joined email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending partner joined email:", error);
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
