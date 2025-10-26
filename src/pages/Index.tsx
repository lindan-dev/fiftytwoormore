import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Auth from "@/components/Auth";
import EmojiSelector from "@/components/EmojiSelector";
import { Button } from "@/components/ui/button";
import { Heart, Plus, BarChart3, List, LogOut, Mail, Send, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ActivityLog from "@/components/ActivityLog";
import StatsView from "@/components/StatsView";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Activity {
  id: string;
  user_id: string;
  activity_date: string;
  created_at: string;
  emoji?: string;
}

interface Invitation {
  id: string;
  sender_id: string;
  receiver_email: string;
  status: string;
  created_at: string;
}

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPartner, setHasPartner] = useState(false);
  const [checkingPartner, setCheckingPartner] = useState(true);
  const [view, setView] = useState<"log" | "stats">("log");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [sendingInvitation, setSendingInvitation] = useState(false);
  const [sentInvitation, setSentInvitation] = useState<Invitation | null>(null);
  const [receivedInvitation, setReceivedInvitation] = useState<Invitation | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkPartnerStatus();
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkPartnerStatus();
      } else {
        setActivities([]);
        setHasPartner(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkPartnerStatus = async () => {
    setCheckingPartner(true);
    const { data } = await supabase
      .from("couples")
      .select("*")
      .or(`user1_id.eq.${session?.user.id},user2_id.eq.${session?.user.id}`)
      .single();

    if (data) {
      setHasPartner(true);
      fetchActivities();
    } else {
      setHasPartner(false);
      checkInvitations();
    }
    setCheckingPartner(false);
  };

  const checkInvitations = async () => {
    if (!session?.user) return;

    // Check for sent invitations
    const { data: sent } = await supabase
      .from("couple_invitations")
      .select("*")
      .eq("sender_id", session.user.id)
      .eq("status", "pending")
      .single();

    if (sent) setSentInvitation(sent);

    // Check for received invitations
    const { data: received } = await supabase
      .from("couple_invitations")
      .select("*")
      .eq("receiver_email", session.user.email)
      .eq("status", "pending")
      .single();

    if (received) setReceivedInvitation(received);
  };

  const handleSendInvitation = async () => {
    if (!partnerEmail || partnerEmail === session?.user.email) {
      toast({
        title: "Invalid email",
        description: "Please enter your partner's email address",
        variant: "destructive",
      });
      return;
    }

    setSendingInvitation(true);

    try {
      const { error } = await supabase.from("couple_invitations").insert([
        {
          sender_id: session!.user.id,
          receiver_email: partnerEmail.toLowerCase().trim(),
        },
      ]);

      if (error) throw error;

      toast({
        title: "Invitation sent!",
        description: "Your partner can now accept the invitation when they sign up.",
      });

      checkInvitations();
      setPartnerEmail("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingInvitation(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!receivedInvitation || !session?.user) return;

    setSendingInvitation(true);

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
          user2_id: session.user.id,
        },
      ]);

      if (coupleError) throw coupleError;

      toast({
        title: "Connected!",
        description: "You and your partner are now connected.",
      });

      checkPartnerStatus();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingInvitation(false);
    }
  };

  const handleRejectInvitation = async () => {
    if (!receivedInvitation) return;

    setSendingInvitation(true);

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
      setSendingInvitation(false);
    }
  };

  const fetchActivities = async () => {
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .order("activity_date", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load activities",
        variant: "destructive",
      });
    } else {
      setActivities(data || []);
    }
  };

  const handleLogActivity = async (activityDate?: Date, emoji?: string) => {
    if (!session?.user) return;

    if (!hasPartner) {
      toast({
        title: "Partner required",
        description: "You need to connect with your partner first.",
        variant: "destructive",
      });
      return;
    }

    const dateToLog = activityDate || new Date();

    const { error } = await supabase.from("activities").insert([
      {
        user_id: session.user.id,
        activity_date: dateToLog.toISOString(),
        emoji: emoji || null,
      },
    ]);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to log activity",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Activity logged!",
      });
      fetchActivities();
      setDialogOpen(false);
      setCustomDate("");
      setCustomTime("");
      setSelectedEmoji("");
    }
  };

  const handleCustomLog = () => {
    if (!customDate || !customTime) {
      toast({
        title: "Error",
        description: "Please select both date and time",
        variant: "destructive",
      });
      return;
    }

    if (!selectedEmoji) {
      toast({
        title: "Error",
        description: "Please select an emoji",
        variant: "destructive",
      });
      return;
    }

    const combinedDateTime = new Date(`${customDate}T${customTime}`);
    handleLogActivity(combinedDateTime, selectedEmoji);
  };

  const handleDeleteActivity = async (id: string) => {
    const { error } = await supabase.from("activities").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete activity",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Activity deleted",
      });
      fetchActivities();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-soft">
        <div className="animate-pulse">
          <Heart className="w-12 h-12 text-primary" />
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (checkingPartner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-soft">
        <div className="animate-pulse">
          <Heart className="w-12 h-12 text-primary" />
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-soft pb-20">
      {/* Header */}
      <div className="bg-gradient-primary text-white p-6 shadow-glow">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Heart className="w-6 h-6" fill="white" />
            </div>
            <h1 className="text-2xl font-bold">fiftytwoormore</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="text-white hover:bg-white/20"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-6 space-y-6 animate-fade-in">
        {/* Received Invitation Alert */}
        {!hasPartner && receivedInvitation && (
          <Alert className="border-2 border-primary/30 bg-primary/5 animate-fade-in">
            <Mail className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-semibold">You have an invitation!</p>
                <p className="text-sm">Someone wants to connect with you as their partner.</p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAcceptInvitation}
                    disabled={sendingInvitation}
                    size="sm"
                    className="bg-gradient-primary hover:opacity-90"
                  >
                    {sendingInvitation ? (
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
                    disabled={sendingInvitation}
                    variant="outline"
                    size="sm"
                    className="border-2"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Decline
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Awaiting Connection Alert */}
        {!hasPartner && !receivedInvitation && sentInvitation && (
          <Alert className="border-2 border-primary/30 bg-primary/5 animate-fade-in">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              <div>
                <p className="font-semibold">Awaiting connection</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Waiting for {sentInvitation.receiver_email} to accept your invitation
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Send Invitation Section */}
        {!hasPartner && !receivedInvitation && !sentInvitation && (
          <div className="bg-card p-6 rounded-xl border-2 border-primary/20 shadow-sm animate-fade-in space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">Connect with Your Partner</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your partner's email to send an invitation
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="partner@example.com"
                value={partnerEmail}
                onChange={(e) => setPartnerEmail(e.target.value)}
                disabled={sendingInvitation}
                className="flex-1 border-2 focus:border-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && partnerEmail) {
                    handleSendInvitation();
                  }
                }}
              />
              <Button
                onClick={handleSendInvitation}
                disabled={sendingInvitation || !partnerEmail}
                className="bg-gradient-primary hover:opacity-90"
              >
                {sendingInvitation ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Quick Log Button */}
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                disabled={!hasPartner}
                className="flex-1 h-16 text-lg font-semibold bg-gradient-primary hover:opacity-90 transition-opacity shadow-glow disabled:opacity-50"
              >
                <Plus className="w-6 h-6 mr-2" />
                Log Now
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Choose an Activity</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <EmojiSelector
                  onSelect={setSelectedEmoji}
                  selectedEmoji={selectedEmoji}
                />
                <Button
                  onClick={() => handleLogActivity(undefined, selectedEmoji)}
                  disabled={!selectedEmoji}
                  className="w-full bg-gradient-primary hover:opacity-90"
                >
                  Log Activity
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                disabled={!hasPartner}
                variant="outline"
                className="h-16 px-6 border-2 border-primary/30 hover:border-primary hover:bg-primary/5 disabled:opacity-50"
              >
                Custom
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log Custom Activity</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Activity Type</Label>
                  <EmojiSelector
                    onSelect={setSelectedEmoji}
                    selectedEmoji={selectedEmoji}
                  />
                </div>
                <Button
                  onClick={handleCustomLog}
                  className="w-full bg-gradient-primary hover:opacity-90"
                  disabled={!selectedEmoji || !customDate || !customTime}
                >
                  Log Activity
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 bg-card p-1 rounded-xl border-2 border-primary/10">
          <Button
            variant={view === "log" ? "default" : "ghost"}
            className={`flex-1 ${
              view === "log"
                ? "bg-gradient-primary text-white hover:opacity-90"
                : "hover:bg-primary/5"
            }`}
            onClick={() => setView("log")}
          >
            <List className="w-4 h-4 mr-2" />
            Log
          </Button>
          <Button
            variant={view === "stats" ? "default" : "ghost"}
            className={`flex-1 ${
              view === "stats"
                ? "bg-gradient-primary text-white hover:opacity-90"
                : "hover:bg-primary/5"
            }`}
            onClick={() => setView("stats")}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Stats
          </Button>
        </div>

        {/* Content Area */}
        {view === "log" ? (
          <ActivityLog
            activities={activities}
            onDelete={handleDeleteActivity}
            currentUserId={session.user.id}
          />
        ) : (
          <StatsView activities={activities} />
        )}
      </div>
    </div>
  );
};

export default Index;
