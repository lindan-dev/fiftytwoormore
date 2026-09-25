import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PartnerAcceptedRequest {
  senderId: string;
  receiverId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("Missing Authorization header");
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("Invalid token:", authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { senderId, receiverId }: PartnerAcceptedRequest = await req.json();

    // Verify the authenticated user is either the sender or receiver
    if (user.id !== senderId && user.id !== receiverId) {
      console.error("User is not authorized to trigger this notification");
      return new Response(
        JSON.stringify({ error: 'Forbidden' }), 
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Partner accepted - fetching user data for authenticated user:", user.id);

    // Get sender's email and name
    const { data: senderAuth, error: senderAuthError } = await supabase.auth.admin.getUserById(senderId);
    if (senderAuthError) throw senderAuthError;

    // Get receiver's name
    const { data: receiverProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", receiverId)
      .single();

    // Get sender's name
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", senderId)
      .single();

    if (!senderAuth?.user?.email) {
      throw new Error("Sender email not found");
    }

    console.log("Sending partner joined email to admin");

    const emailResponse = await resend.emails.send({
      from: "fiftytwoormore <updates@fiftytwoormore.com>",
      to: ["fiftytwoormore@lindaninc.com"],
      subject: "Partner Connection Completed - 52 or More",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Partner Connection Completed!</h1>
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            <strong>${receiverProfile?.name || 'A user'}</strong> has accepted the invitation from <strong>${senderProfile?.name || 'another user'}</strong>.
          </p>
          <div style="margin: 30px 0; padding: 20px; background-color: #f0f9ff; border-radius: 8px; text-align: center;">
            <p style="font-size: 18px; color: #333; margin: 0;">
              🎊 They're now connected! 🎊
            </p>
          </div>
          <div style="margin: 30px 0; padding: 20px; background-color: #f5f5f5; border-radius: 8px;">
            <h2 style="color: #333; margin-top: 0;">Connection Details:</h2>
            <ul style="font-size: 14px; line-height: 1.8; color: #555;">
              <li><strong>User 1:</strong> ${senderProfile?.name || 'User'} (${senderAuth.user.email})</li>
              <li><strong>User 2:</strong> ${receiverProfile?.name || 'User'}</li>
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

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in handle-partner-accepted function:", error);
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

