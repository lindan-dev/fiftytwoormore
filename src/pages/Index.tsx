import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Auth from "@/components/Auth";
import Onboarding from "@/components/Onboarding";
import EmojiSelector from "@/components/EmojiSelector";
import { Button } from "@/components/ui/button";
import { Heart, Plus, BarChart3, List, LogOut, Copy, Loader2, User, Download, X, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ActivityLog from "@/components/ActivityLog";
import CalendarView from "@/components/CalendarView";
import StatsView from "@/components/StatsView";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { startOfYear, endOfYear, differenceInWeeks, parseISO } from "date-fns";

interface Activity {
  id: string;
  user_id: string;
  activity_date: string;
  created_at: string;
  emoji?: string;
  notes?: string;
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
  const [selectedNotes, setSelectedNotes] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [enterCode, setEnterCode] = useState("");
  const [sendingInvitation, setSendingInvitation] = useState(false);
  const [myInvitationCode, setMyInvitationCode] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStartSlide, setOnboardingStartSlide] = useState(0);
  const [isJoiningViaInvite, setIsJoiningViaInvite] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding") === "true";

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);

      // Show onboarding for first-time visitors without a session
      if (!session && !hasSeenOnboarding) {
        setShowOnboarding(true);
        setOnboardingStartSlide(0);
      }
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

  // Check if app should show install prompt
  useEffect(() => {
    // Only show on mobile devices
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Check if already installed
    const isInstalled = window.matchMedia("(display-mode: standalone)").matches;

    // Check if user dismissed the prompt
    const isDismissed = localStorage.getItem("installPromptDismissed") === "true";

    if (isMobile && !isInstalled && !isDismissed) {
      setShowInstallPrompt(true);
    }

    // Capture the beforeinstallprompt event
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
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
    const { data, error } = await supabase.from("activities").select("*").order("activity_date", { ascending: false });

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
      .channel("activities-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activities",
        },
        () => {
          fetchActivities();
        },
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
      .channel("couple-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "couples",
        },
        (payload) => {
          // Check if the inserted couple involves this user
          const newCouple = payload.new as { user1_id: string; user2_id: string };
          if (newCouple.user1_id === session.user.id || newCouple.user2_id === session.user.id) {
            checkPartnerStatus();
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "couples",
        },
        async (payload) => {
          // Check if the deleted couple involves this user
          const deletedCouple = payload.old as { user1_id: string; user2_id: string };
          if (deletedCouple.user1_id === session.user.id || deletedCouple.user2_id === session.user.id) {
            // Get partner name before they disconnect
            const partnerId =
              deletedCouple.user1_id === session.user.id ? deletedCouple.user2_id : deletedCouple.user1_id;

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
        },
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
      const { data, error: validateError } = await supabase.functions.invoke("validate-invitation-code", {
        body: { code: enterCode },
      });

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

      // Create couple relationship with ordered IDs (user1_id must be < user2_id)
      const ids = [matchingInvite.sender_id, session.user.id].sort();
      const { error: coupleError } = await supabase.from("couples").insert([
        {
          user1_id: ids[0],
          user2_id: ids[1],
        },
      ]);

      if (coupleError) throw coupleError;

      toast({
        title: "Connected!",
        description: "You and your partner are now connected.",
      });

      // Mark as joining via invite for onboarding
      setIsJoiningViaInvite(true);

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

  const handleOnboardingComplete = () => {
    localStorage.setItem("hasSeenOnboarding", "true");
    setShowOnboarding(false);
    setIsJoiningViaInvite(false);
  };

  const handleShowOnboarding = () => {
    setShowOnboarding(true);
    setOnboardingStartSlide(0);
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

  const handleLogActivity = async (activityDate?: Date, emoji?: string, notes?: string) => {
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
        notes: notes || null,
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
      setSelectedNotes("");
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
    handleLogActivity(combinedDateTime, selectedEmoji, selectedNotes);
    setDialogOpen(false);
    setCustomDate("");
    setCustomTime("");
    setSelectedNotes("");
  };

  const handleUpdateActivity = async (id: string, activityDate: Date, emoji: string, notes?: string) => {
    const { error } = await supabase
      .from("activities")
      .update({
        activity_date: activityDate.toISOString(),
        emoji: emoji,
        notes: notes || null,
      })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update activity",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Activity updated",
      });
      fetchActivities();
    }
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
    try {
      // Get current session to check if it exists
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession) {
        // No active session - just clear local state
        console.log("No active session found, clearing local state");
        setSession(null);
        setActivities([]);
        setHasPartner(false);
        setPartnerName("");
        toast({
          title: "Signed out",
          description: "You have been signed out.",
        });
        return;
      }

      // Attempt server-side logout
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Sign out error:", error);

        // If error is "session_not_found", treat it as success
        // The session is already invalid on the server
        if (error.message?.includes("session") || error.message?.includes("Session")) {
          console.log("Session already invalid on server, clearing local state");
          // Force clear the session locally
          setSession(null);
          setActivities([]);
          setHasPartner(false);
          setPartnerName("");

          // Clear any stale data from localStorage
          localStorage.removeItem("supabase.auth.token");

          toast({
            title: "Signed out",
            description: "You have been signed out.",
          });
          return;
        }

        // For other errors, show error message
        toast({
          title: "Error",
          description: "Failed to sign out. Please try again.",
          variant: "destructive",
        });
      } else {
        // Successful logout
        toast({
          title: "Signed out",
          description: "You have been signed out.",
        });
      }
    } catch (error) {
      console.error("Sign out error:", error);

      // On any error, force clear local session
      setSession(null);
      setActivities([]);
      setHasPartner(false);
      setPartnerName("");

      toast({
        title: "Signed out",
        description: "You have been signed out.",
      });
    }
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
        const partnerId = coupleData.user1_id === session.user.id ? coupleData.user2_id : coupleData.user1_id;

        // Delete all activities for both users
        await supabase.from("activities").delete().in("user_id", [session.user.id, partnerId]);

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

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        setShowInstallPrompt(false);
      }

      setDeferredPrompt(null);
    } else {
      navigate("/install");
    }
  };

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    localStorage.setItem("installPromptDismissed", "true");
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

  // Show onboarding for first-time visitors or invited users
  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} startSlide={onboardingStartSlide} />;
  }

  if (!session) {
    return <Auth />;
  }

  // Show onboarding for new partners (last 2 slides only)
  if (isJoiningViaInvite && !localStorage.getItem("hasSeenOnboarding")) {
    return <Onboarding onComplete={handleOnboardingComplete} startSlide={3} />;
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
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="bg-primary text-white p-3 sm:p-4 shadow-soft">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm flex-shrink-0">
              <Heart className="w-4 h-4 sm:w-6 sm:h-6" fill="white" />
            </div>
            <h1 className="text-lg sm:text-2xl font-bold truncate">fiftytwoormore</h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShowOnboarding}
              className="text-white hover:bg-white/20 h-8 w-8 sm:h-9 sm:w-9"
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/profile")}
              className="text-white hover:bg-white/20 h-8 w-8 sm:h-9 sm:w-9"
            >
              <User className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="text-white hover:bg-white/20 h-8 w-8 sm:h-9 sm:w-9"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-3 sm:p-4 space-y-3 sm:space-y-4 animate-fade-in">
        {/* Install Prompt Banner */}
        {showInstallPrompt && (
          <div className="bg-card p-3 sm:p-4 rounded-xl border-2 border-primary/20 shadow-sm">
            <div className="flex items-start sm:items-center gap-3">
              <Download className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0 mt-0.5 sm:mt-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base leading-tight font-medium">
                  Install app for offline access & better experience
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button size="default" onClick={handleInstallClick} className="text-sm sm:text-base px-4 sm:px-6">
                  Install
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={dismissInstallPrompt}
                  className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* Connection Section */}
        {hasPartner ? (
          <>
            <div className="bg-card p-3 sm:p-4 rounded-xl border-2 border-primary/20 shadow-sm animate-fade-in">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base leading-tight">
                    Doing it with <span className="font-semibold">{partnerName}</span> since{" "}
                    {activities.length > 0
                      ? new Date(activities[activities.length - 1].activity_date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : new Date(connectedDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {activities.length} {activities.length === 1 ? "activity" : "activities"} and counting 🔥
                  </p>
                </div>
              </div>
            </div>
            {activities.length > 0 && (
              <>
                <StatsView activities={activities} compact={true} />
                {/* Year Goal Tracker */}
                {(() => {
                  const now = new Date();
                  const yearStart = startOfYear(now);
                  const yearEnd = endOfYear(now);

                  const yearActivities = activities.filter((activity) => {
                    const activityDate = parseISO(activity.activity_date);
                    return activityDate >= yearStart && activityDate <= yearEnd;
                  });

                  const yearCount = yearActivities.length;
                  const weeksLeft = Math.max(0, differenceInWeeks(yearEnd, now));

                  // Calculate which goal tier we're on (52, 104, 156, etc.)
                  const currentGoal = Math.ceil(yearCount / 52) * 52;
                  const previousGoal = currentGoal - 52;
                  const progressInCurrentTier = yearCount - previousGoal;
                  const progressPercentage = (progressInCurrentTier / 52) * 100;
                  const multiplier = Math.floor(yearCount / 52) + 1;
                  const completedTiers = Math.floor(yearCount / 52);

                  return (
                    <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-3 sm:p-4 rounded-xl border-2 border-primary/20 shadow-sm space-y-2">
                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="font-medium">
                          {yearCount}/{currentGoal} this year
                        </span>
                        <div className="flex items-center gap-1.5">
                          {Array.from({ length: completedTiers }).map((_, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-primary/30 text-primary-foreground/80 font-bold text-xs rounded-full line-through"
                            >
                              x{i + 1}
                            </span>
                          ))}
                          <span className="px-2 py-0.5 bg-primary text-primary-foreground font-bold text-xs rounded-full animate-pulse">
                            x{multiplier}
                          </span>
                        </div>
                      </div>
                      <Progress value={progressPercentage} className="h-3" />
                      <p className="text-xs sm:text-sm text-center text-muted-foreground">
                        {yearCount < 52
                          ? `${52 - yearCount} more to reach your goal with ${weeksLeft} ${weeksLeft === 1 ? "week" : "weeks"} left!`
                          : `Crushing it! ${yearCount - previousGoal} of 52 towards ${currentGoal} 🔥`}
                      </p>
                    </div>
                  );
                })()}
              </>
            )}
          </>
        ) : (
          <div className="bg-card p-3 sm:p-4 rounded-xl border-2 border-primary/20 shadow-sm animate-fade-in space-y-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm sm:text-base truncate">Connect with Your Partner</h3>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  Share your code or enter partner's code
                </p>
              </div>
            </div>

            {/* My Invitation Code - Only show if not connected */}
            {!hasPartner && (
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-semibold">Your Invitation Code</Label>
                {myInvitationCode ? (
                  <div className="flex gap-2">
                    <div className="flex-1 bg-primary/5 border-2 border-primary/20 rounded-lg p-3 flex items-center justify-center">
                      <code className="text-xl sm:text-2xl font-bold tracking-wider text-primary">
                        {myInvitationCode}
                      </code>
                    </div>
                    <Button
                      onClick={copyInvitationCode}
                      variant="outline"
                      size="icon"
                      className="h-auto border-2 w-11 sm:w-12 flex-shrink-0"
                    >
                      <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                    </Button>
                  </div>
                ) : (
                  <Button onClick={generateInvitationCode} disabled={sendingInvitation} className="w-full">
                    {sendingInvitation ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate Code"}
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
            <div className="space-y-2">
              <Label htmlFor="enter-code" className="text-xs sm:text-sm font-semibold">
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
                  {sendingInvitation ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
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
                className="flex-1 h-12 sm:h-14 text-sm sm:text-base font-semibold disabled:opacity-50"
              >
                <Plus className="w-5 h-5 sm:w-6 sm:h-6 mr-1.5 sm:mr-2" />
                Log Now
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Choose an Activity</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <EmojiSelector onSelect={setSelectedEmoji} selectedEmoji={selectedEmoji} />
                <div className="space-y-2">
                  <Label htmlFor="quick-notes">Notes (optional)</Label>
                  <Input
                    id="quick-notes"
                    type="text"
                    placeholder="Add a note..."
                    value={selectedNotes}
                    onChange={(e) => setSelectedNotes(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <Button
                  onClick={() => handleLogActivity(undefined, selectedEmoji, selectedNotes)}
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
                className="h-12 sm:h-14 px-4 sm:px-6 border-2 border-primary/30 hover:border-primary hover:bg-primary/5 disabled:opacity-50 text-sm sm:text-base"
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
                  <Input id="date" type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input id="time" type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Activity Type</Label>
                  <EmojiSelector onSelect={setSelectedEmoji} selectedEmoji={selectedEmoji} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-notes">Notes (optional)</Label>
                  <Input
                    id="custom-notes"
                    type="text"
                    placeholder="Add a note..."
                    value={selectedNotes}
                    onChange={(e) => setSelectedNotes(e.target.value)}
                    maxLength={200}
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
        <div className="flex gap-1 sm:gap-2 bg-card p-1 rounded-xl border-2 border-primary/10">
          <Button
            variant={view === "log" ? "default" : "ghost"}
            className={`flex-1 text-sm sm:text-base ${view === "log" ? "bg-primary text-white" : "hover:bg-primary/5"}`}
            onClick={() => setView("log")}
          >
            <List className="w-4 h-4 mr-1.5 sm:mr-2" />
            Log
          </Button>
          <Button
            variant={view === "stats" ? "default" : "ghost"}
            className={`flex-1 text-sm sm:text-base ${
              view === "stats" ? "bg-primary text-white" : "hover:bg-primary/5"
            }`}
            onClick={() => setView("stats")}
          >
            <BarChart3 className="w-4 h-4 mr-1.5 sm:mr-2" />
            Stats
          </Button>
        </div>

        {/* Content Area */}
        {view === "log" ? (
          <CalendarView
            activities={activities}
            currentUserId={session.user.id}
            onDelete={handleDeleteActivity}
            onUpdate={handleUpdateActivity}
          />
        ) : (
          <StatsView activities={activities} compact={false} />
        )}

        {/* Support Link */}
        <div className="text-center mt-6 pb-4">
          <a
            href="https://buy.stripe.com/14AbJ34zR6ofcci1fJ5EY00"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
          >
            <Heart className="w-4 h-4 fill-current" />
            Support our project - cheaper than therapy
          </a>
        </div>

        {/* Copyright Footer */}
        <div className="text-center py-4 border-t border-border/50 mt-4">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Lindan AB. All rights reserved.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Contact:{" "}
            <a href="mailto:fiftytwoormore@lindaninc.com" className="hover:text-primary transition-colors underline">
              fiftytwoormore@lindaninc.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
