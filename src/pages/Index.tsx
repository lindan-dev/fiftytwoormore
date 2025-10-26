import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Auth from "@/components/Auth";
import EmojiSelector from "@/components/EmojiSelector";
import { Button } from "@/components/ui/button";
import { Heart, Plus, BarChart3, List, LogOut, Copy, Loader2, User } from "lucide-react";
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
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPartner, setHasPartner] = useState(false);
  const [partnerName, setPartnerName] = useState<string>("");
  const [connectedDate, setConnectedDate] = useState<string>("");
  const [checkingPartner, setCheckingPartner] = useState(true);
  const [view, setView] = useState<"log" | "stats">("log");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [enterCode, setEnterCode] = useState("");
  const [sendingInvitation, setSendingInvitation] = useState(false);
  const [myInvitationCode, setMyInvitationCode] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setActivities([]);
        setHasPartner(false);
        setPartnerName("");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check partner status when session changes
  useEffect(() => {
    if (session?.user?.id) {
      checkPartnerStatus();
    } else {
      setCheckingPartner(false);
    }
  }, [session?.user?.id]);

  // Moved after function declarations to avoid TS error

  const fetchActivities = useCallback(async () => {
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
  }, [toast]);

  const checkInvitations = useCallback(async () => {
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
  }, [session?.user]);

  const checkPartnerStatus = useCallback(async () => {
    if (!session?.user?.id) {
      setCheckingPartner(false);
      return;
    }
    
    setCheckingPartner(true);
    try {
      const { data, error } = await supabase
        .from("couples")
        .select("*")
        .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`)
        .maybeSingle();

      if (error) {
        console.error("Error fetching couple:", error);
        setHasPartner(false);
        setPartnerName("");
        setConnectedDate("");
        checkInvitations();
        setCheckingPartner(false);
        return;
      }

      if (data) {
        setHasPartner(true);
        setConnectedDate(data.created_at);
        
        // Get partner's ID
        const partnerId = data.user1_id === session.user.id ? data.user2_id : data.user1_id;
        
        // Fetch partner's profile
        const { data: partnerProfile, error: profileError } = await supabase
          .from("profiles")
          .select("name")
          .eq("user_id", partnerId)
          .maybeSingle();
        
        if (profileError) {
          console.error("Error fetching partner profile:", profileError);
        }
        
        if (partnerProfile) {
          setPartnerName(partnerProfile.name || "Partner");
        } else {
          setPartnerName("Partner");
        }
        
        fetchActivities();
      } else {
        setHasPartner(false);
        setPartnerName("");
        setConnectedDate("");
        checkInvitations();
      }
    } catch (error) {
      console.error("Error in checkPartnerStatus:", error);
      setHasPartner(false);
      setPartnerName("");
      setConnectedDate("");
    } finally {
      setCheckingPartner(false);
    }
  }, [session?.user, fetchActivities, checkInvitations]);

  // Realtime subscription for activities
  useEffect(() => {
    if (!hasPartner) return;

    const channel = supabase
      .channel('activities-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activities',
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasPartner, fetchActivities]);

  // Realtime subscription for couple connection/disconnection
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel('couple-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'couples',
        },
        (payload) => {
          // Check if the inserted couple involves this user
          const newCouple = payload.new as { user1_id: string; user2_id: string };
          if (newCouple.user1_id === session.user.id || newCouple.user2_id === session.user.id) {
            checkPartnerStatus();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'couples',
        },
        async (payload) => {
          // Check if the deleted couple involves this user
          const deletedCouple = payload.old as { user1_id: string; user2_id: string };
          if (deletedCouple.user1_id === session.user.id || deletedCouple.user2_id === session.user.id) {
            // Get partner name before they disconnect
            const partnerId = deletedCouple.user1_id === session.user.id 
              ? deletedCouple.user2_id 
              : deletedCouple.user1_id;
            
            // Fetch partner's profile
            const { data: partnerProfile } = await supabase
              .from("profiles")
              .select("name")
              .eq("user_id", partnerId)
              .maybeSingle();
            
            const disconnectedPartnerName = partnerProfile?.name || "Your partner";
            
            toast({
              title: "Partner Disconnected",
              description: `${disconnectedPartnerName} has disconnected from you and all your data is gone. Better luck next time.`,
              variant: "destructive",
              duration: 10000,
            });
            
            // Reset state
            setHasPartner(false);
            setPartnerName("");
            setConnectedDate("");
            setActivities([]);
            setMyInvitationCode(null);
            checkInvitations();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, checkPartnerStatus, checkInvitations, toast]);

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
      // Validate invitation code via secure edge function
      const { data, error: validateError } = await supabase.functions.invoke(
        "validate-invitation-code",
        {
          body: { code: enterCode },
        }
      );

      if (validateError || !data?.success) {
        toast({
          title: "Invalid code",
          description: data?.error || "This invitation code doesn't exist or has expired.",
          variant: "destructive",
        });
        return;
      }

      const matchingInvite = data.invitation;

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
      setQuickLogOpen(false);
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
    setDialogOpen(false);
    setCustomDate("");
    setCustomTime("");
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

  const handleDisconnectPartner = async () => {
    if (!session?.user) return;

    setDisconnecting(true);

    try {
      // Get partner's ID first
      const { data: coupleData } = await supabase
        .from("couples")
        .select("*")
        .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`)
        .single();

      if (coupleData) {
        const partnerId = coupleData.user1_id === session.user.id 
          ? coupleData.user2_id 
          : coupleData.user1_id;

        // Delete all activities for both users
        await supabase
          .from("activities")
          .delete()
          .in("user_id", [session.user.id, partnerId]);

        // Delete all invitations for both users
        await supabase
          .from("couple_invitations")
          .delete()
          .or(`sender_id.eq.${session.user.id},sender_id.eq.${partnerId}`);
      }

      // Delete couple relationship (this will trigger realtime notification to partner)
      const { error: coupleError } = await supabase
        .from("couples")
        .delete()
        .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`);

      if (coupleError) throw coupleError;

      toast({
        title: "Disconnected",
        description: "You have been disconnected and all shared data has been deleted",
      });

      setHasPartner(false);
      setPartnerName("");
      setConnectedDate("");
      setActivities([]);
      setMyInvitationCode(null);
      checkInvitations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">
          <Heart className="w-12 h-12 text-primary" />
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-white p-6 shadow-soft">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Heart className="w-6 h-6" fill="white" />
            </div>
            <h1 className="text-2xl font-bold">fiftytwoormore</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/profile")}
              className="text-white hover:bg-white/20"
            >
              <User className="w-5 h-5" />
            </Button>
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
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-6 space-y-6 animate-fade-in">
        {/* Connection Section */}
        {hasPartner ? (
          <div className="bg-card p-6 rounded-xl border-2 border-primary/20 shadow-sm animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" fill="white" />
              </div>
              <div className="flex-1">
                <p className="text-lg font-semibold">
                  Doing it with {partnerName}
                </p>
                <p className="text-sm text-muted-foreground">
                  since {new Date(connectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-sm font-medium text-primary mt-1">
                  {activities.length} {activities.length === 1 ? 'activity' : 'activities'} and counting 🔥
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card p-6 rounded-xl border-2 border-primary/20 shadow-sm animate-fade-in space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" fill="white" />
              </div>
              <div>
                <h3 className="font-semibold">Connect with Your Partner</h3>
                <p className="text-sm text-muted-foreground">
                  Share your code or enter your partner's code
                </p>
              </div>
            </div>

            {/* My Invitation Code - Only show if not connected */}
            {!hasPartner && (
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
                    className="w-full"
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
            )}

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
        <div className="flex gap-2">
          <Dialog open={quickLogOpen} onOpenChange={setQuickLogOpen}>
            <DialogTrigger asChild>
              <Button
                disabled={!hasPartner}
                className="flex-1 h-16 text-lg font-semibold disabled:opacity-50"
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
                  className="w-full"
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
                  className="w-full"
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
                ? "bg-primary text-white"
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
                ? "bg-primary text-white"
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
