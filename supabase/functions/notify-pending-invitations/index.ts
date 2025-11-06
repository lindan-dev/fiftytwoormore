import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Find invitations that are 1 day old and still pending
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const { data: pendingInvitations, error: fetchError } = await supabase
      .from("couple_invitations")
      .select(`
        id,
        receiver_email,
        created_at,
        sender_id,
        profiles!couple_invitations_sender_id_fkey(name)
      `)
      .eq("status", "pending")
      .lte("created_at", oneDayAgo.toISOString());

    if (fetchError) {
      console.error("Error fetching pending invitations:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingInvitations?.length || 0} pending invitations to remind`);

    const results = [];
    
    for (const invitation of pendingInvitations || []) {
      try {
        const senderName = invitation.profiles?.name || "Your partner";
        const appUrl = supabaseUrl.replace(".supabase.co", "") || "";
        const signupLink = `${appUrl}?invitation=${invitation.id}`;

        const emailResponse = await resend.emails.send({
          from: "52 or More <onboarding@resend.dev>",
          to: ["fiftytwoormore@lindaninc.com"],
          subject: "Pending Invitation Reminder - 52 or More",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #333;">Pending Invitation Reminder</h1>
              <p style="font-size: 16px; line-height: 1.6; color: #555;">
                An invitation has been pending for over 24 hours.
              </p>
              <div style="margin: 30px 0; padding: 20px; background-color: #f5f5f5; border-radius: 8px;">
                <h2 style="color: #333; margin-top: 0;">Invitation Details:</h2>
                <ul style="font-size: 14px; line-height: 1.8; color: #555;">
                  <li><strong>Sender:</strong> ${senderName}</li>
                  <li><strong>Recipient Email:</strong> ${invitation.receiver_email}</li>
                  <li><strong>Created:</strong> ${new Date(invitation.created_at).toLocaleString()}</li>
                  <li><strong>Days pending:</strong> ${Math.floor((Date.now() - new Date(invitation.created_at).getTime()) / (1000 * 60 * 60 * 24))} days</li>
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

        console.log(`Reminder email sent to ${invitation.receiver_email}:`, emailResponse);
        results.push({ email: invitation.receiver_email, success: true });
      } catch (emailError: any) {
        console.error(`Error sending reminder to ${invitation.receiver_email}:`, emailError);
        results.push({ email: invitation.receiver_email, success: false, error: emailError.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: results.length,
        results 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invitation-reminder function:", error);
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
