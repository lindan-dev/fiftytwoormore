import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Check, X, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo.png";

interface Invitation {
  id: string;
  sender_id: string;
  receiver_email: string;
  status: string;
  created_at: string;
}

interface InvitationFlowProps {
  userEmail: string;
  userId: string;
  onConnected: () => void;
}

export default function InvitationFlow({ userEmail, userId, onConnected }: InvitationFlowProps) {
  const [partnerEmail, setPartnerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentInvitation, setSentInvitation] = useState<Invitation | null>(null);
  const [receivedInvitation, setReceivedInvitation] = useState<Invitation | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkInvitations();
  }, []);

  const checkInvitations = async () => {
    // Check for sent invitations
    const { data: sent } = await supabase
      .from("couple_invitations")
      .select("*")
      .eq("sender_id", userId)
      .eq("status", "pending")
      .single();

    if (sent) setSentInvitation(sent);

    // Check for received invitations
    const { data: received } = await supabase
      .from("couple_invitations")
      .select("*")
      .eq("receiver_email", userEmail)
      .eq("status", "pending")
      .single();

    if (received) setReceivedInvitation(received);
  };

  const handleSendInvitation = async () => {
    if (!partnerEmail || partnerEmail === userEmail) {
      toast({
        title: "Invalid email",
        description: "Please enter your partner's email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from("couple_invitations").insert([
        {
          sender_id: userId,
          receiver_email: partnerEmail.toLowerCase().trim(),
        },
      ]);

      if (error) throw error;

      toast({
        title: "Invitation sent!",
        description: "Your partner can now accept the invitation when they sign up.",
      });

      checkInvitations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!receivedInvitation) return;

    setLoading(true);

    try {
      // Update invitation status
      const { error: updateError } = await supabase
        .from("couple_invitations")
        .update({ status: "accepted" })
        .eq("id", receivedInvitation.id);

      if (updateError) throw updateError;

      // Create couple relationship
      const { error: coupleError } = await supabase.from("couples").insert([
        {
          user1_id: receivedInvitation.sender_id,
          user2_id: userId,
        },
      ]);

      if (coupleError) throw coupleError;

      toast({
        title: "Connected!",
        description: "You and your partner are now connected.",
      });

      onConnected();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectInvitation = async () => {
    if (!receivedInvitation) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("couple_invitations")
        .update({ status: "rejected" })
        .eq("id", receivedInvitation.id);

      if (error) throw error;

      toast({
        title: "Invitation declined",
        description: "You can accept a different invitation or send your own.",
      });

      setReceivedInvitation(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-soft p-4">
      <Card className="w-full max-w-md shadow-glow border-2 border-primary/20 animate-scale-in">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-glow">
            <img src={logo} alt="52+" className="w-12 h-12" />
          </div>
          <CardTitle className="text-3xl font-bold">Connect with Your Partner</CardTitle>
          <CardDescription className="text-base">
            To start tracking your activities together, invite your partner or accept their invitation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {receivedInvitation ? (
            <div className="space-y-4 p-4 bg-primary/5 rounded-lg border-2 border-primary/20">
              <div className="flex items-center gap-2 text-primary">
                <Mail className="w-5 h-5" />
                <p className="font-semibold">You have an invitation!</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Someone wants to connect with you as their partner
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleAcceptInvitation}
                  disabled={loading}
                  className="flex-1 bg-gradient-primary hover:opacity-90"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Accept
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleRejectInvitation}
                  disabled={loading}
                  variant="outline"
                  className="flex-1 border-2"
                >
                  <X className="w-4 h-4 mr-2" />
                  Decline
                </Button>
              </div>
            </div>
          ) : sentInvitation ? (
            <div className="space-y-4 p-4 bg-primary/5 rounded-lg border-2 border-primary/20 text-center">
              <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
              <div>
                <p className="font-semibold">Invitation sent</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Waiting for {sentInvitation.receiver_email} to accept
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="partner-email">Partner&apos;s Email</Label>
                <Input
                  id="partner-email"
                  type="email"
                  placeholder="partner@example.com"
                  value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                  disabled={loading}
                  className="h-12 border-2 focus:border-primary transition-colors"
                />
              </div>
              <Button
                onClick={handleSendInvitation}
                disabled={loading || !partnerEmail}
                className="w-full h-12 text-lg font-semibold bg-gradient-primary hover:opacity-90 transition-opacity shadow-glow"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Mail className="w-5 h-5 mr-2" />
                    Send Invitation
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
