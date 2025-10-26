import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Auth from "@/components/Auth";
import InvitationFlow from "@/components/InvitationFlow";
import { Button } from "@/components/ui/button";
import { Heart, Plus, BarChart3, List, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ActivityLog from "@/components/ActivityLog";
import StatsView from "@/components/StatsView";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Activity {
  id: string;
  user_id: string;
  activity_date: string;
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
    }
    setCheckingPartner(false);
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

  const handleLogActivity = async (activityDate?: Date) => {
    if (!session?.user) return;

    const dateToLog = activityDate || new Date();

    const { error } = await supabase.from("activities").insert([
      {
        user_id: session.user.id,
        activity_date: dateToLog.toISOString(),
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

    const combinedDateTime = new Date(`${customDate}T${customTime}`);
    handleLogActivity(combinedDateTime);
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

  if (!hasPartner) {
    return (
      <InvitationFlow
        userEmail={session.user.email || ""}
        userId={session.user.id}
        onConnected={checkPartnerStatus}
      />
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
        {/* Quick Log Button */}
        <div className="flex gap-2">
          <Button
            onClick={() => handleLogActivity()}
            className="flex-1 h-16 text-lg font-semibold bg-gradient-primary hover:opacity-90 transition-opacity shadow-glow"
          >
            <Plus className="w-6 h-6 mr-2" />
            Log Now
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-16 px-6 border-2 border-primary/30 hover:border-primary hover:bg-primary/5"
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
                <Button
                  onClick={handleCustomLog}
                  className="w-full bg-gradient-primary hover:opacity-90"
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
