import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Auth from "@/components/Auth";
import EmojiSelector from "@/components/EmojiSelector";
import { Button } from "@/components/ui/button";
import { Heart, Plus, BarChart3, List, LogOut, Copy, Loader2 } from "lucide-react";
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
  const [invitationCode, setInvitationCode] = useState("");
  const [enterCode, setEnterCode] = useState("");
  const [sendingInvitation, setSendingInvitation] = useState(false);
  const [myInvitationCode, setMyInvitationCode] = useState<string | null>(null);
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
    if (!session?.user?.id) return;
    
    setCheckingPartner(true);
    const { data } = await supabase
      .from("couples")
      .select("*")
      .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`)
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

    // Check if I have an active invitation code
    const { data: myInvite } = await supabase
      .from("couple_invitations")
      .select("*")
      .eq("sender_id", session.user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (myInvite) {
      setMyInvitationCode(myInvite.id.substring(0, 8).toUpperCase());
    }
  };

  const generateInvitationCode = async () => {
    if (!session?.user) return;

    setSendingInvitation(true);

    try {
      const { data, error } = await supabase
        .from("couple_invitations")
        .insert([
          {
            sender_id: session.user.id,
            receiver_email: "", // Empty for code-based invitations
          },
        ])
        .select()
        .single();

      if (error) throw error;

      const code = data.id.substring(0, 8).toUpperCase();
      setMyInvitationCode(code);

      toast({
        title: "Invitation code created!",
        description: "Share this code with your partner.",
      });
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

  const handleConnectWithCode = async () => {
    if (!enterCode || !session?.user) {
      toast({
        title: "Error",
        description: "Please enter an invitation code",
        variant: "destructive",
      });
      return;
    }

    setSendingInvitation(true);

    try {
      // Find invitation by code prefix
      const { data: invitations, error: searchError } = await supabase
        .from("couple_invitations")
        .select("*")
        .eq("status", "pending");

      if (searchError) throw searchError;

      const matchingInvite = invitations?.find((inv) =>
        inv.id.toUpperCase().startsWith(enterCode.toUpperCase())
      );

      if (!matchingInvite) {
        toast({
          title: "Invalid code",
          description: "This invitation code doesn't exist or has expired.",
          variant: "destructive",
        });
        return;
      }

      if (matchingInvite.sender_id === session.user.id) {
        toast({
          title: "Error",
          description: "You can't use your own invitation code.",
          variant: "destructive",
        });
        return;
      }

      // Update invitation status
      const { error: updateError } = await supabase
        .from("couple_invitations")
        .update({ status: "accepted" })
        .eq("id", matchingInvite.id);

      if (updateError) throw updateError;

      // Create couple relationship
      const { error: coupleError } = await supabase.from("couples").insert([
        {
          user1_id: matchingInvite.sender_id,
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

  const copyInvitationCode = () => {
    if (myInvitationCode) {
      navigator.clipboard.writeText(myInvitationCode);
      toast({
        title: "Copied!",
        description: "Invitation code copied to clipboard",
      });
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
        {/* Connection Section */}
        {!hasPartner && (
          <div className="bg-card p-6 rounded-xl border-2 border-primary/20 shadow-sm animate-fade-in space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" fill="white" />
              </div>
              <div>
                <h3 className="font-semibold">Connect with Your Partner</h3>
                <p className="text-sm text-muted-foreground">
                  Share your code or enter your partner's code
                </p>
              </div>
            </div>

            {/* My Invitation Code */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Your Invitation Code</Label>
              {myInvitationCode ? (
                <div className="flex gap-2">
                  <div className="flex-1 bg-primary/5 border-2 border-primary/20 rounded-lg p-4 flex items-center justify-center">
                    <code className="text-2xl font-bold tracking-wider text-primary">
                      {myInvitationCode}
                    </code>
                  </div>
                  <Button
                    onClick={copyInvitationCode}
                    variant="outline"
                    size="icon"
                    className="h-auto border-2"
                  >
                    <Copy className="w-5 h-5" />
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={generateInvitationCode}
                  disabled={sendingInvitation}
                  className="w-full bg-gradient-primary hover:opacity-90"
                >
                  {sendingInvitation ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Generate Code"
                  )}
                </Button>
              )}
              {myInvitationCode && (
                <p className="text-xs text-muted-foreground">
                  Share this code with your partner via WhatsApp, SMS, or any messaging app
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-primary/20"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            {/* Enter Partner's Code */}
            <div className="space-y-3">
              <Label htmlFor="enter-code" className="text-sm font-semibold">
                Enter Partner's Code
              </Label>
              <div className="flex gap-2">
                <Input
                  id="enter-code"
                  type="text"
                  placeholder="ABC12345"
                  value={enterCode}
                  onChange={(e) => setEnterCode(e.target.value.toUpperCase())}
                  disabled={sendingInvitation}
                  maxLength={8}
                  className="flex-1 border-2 focus:border-primary text-center text-lg font-mono tracking-wider"
                />
                <Button
                  onClick={handleConnectWithCode}
                  disabled={sendingInvitation || !enterCode || enterCode.length < 8}
                  className="bg-gradient-primary hover:opacity-90"
                >
                  {sendingInvitation ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Connect"
                  )}
                </Button>
              </div>
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
