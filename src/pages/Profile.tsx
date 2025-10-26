import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, User, Heart, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Profile {
  id: string;
  user_id: string;
  name: string;
  birthday?: string;
}

interface Partner {
  id: string;
  name: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        fetchPartner(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        fetchPartner(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Realtime subscription for partner disconnection
  useEffect(() => {
    if (!session?.user?.id || !partner) return;

    const channel = supabase
      .channel('couple-disconnection')
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
            
            setPartner(null);
            navigate("/");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, partner, toast, navigate]);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
    } else if (data) {
      setProfile(data);
      setName(data.name || "");
      setBirthday(data.birthday || "");
    }
  };

  const fetchPartner = async (userId: string) => {
    // Get couple relationship
    const { data: coupleData } = await supabase
      .from("couples")
      .select("*")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .single();

    if (coupleData) {
      const partnerId = coupleData.user1_id === userId ? coupleData.user2_id : coupleData.user1_id;
      
      // Get partner's profile
      const { data: partnerProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", partnerId)
        .single();

      if (partnerProfile) {
        setPartner({
          id: partnerId,
          name: partnerProfile.name || "Partner",
        });
      }
    }
  };

  const handleSave = async () => {
    if (!session?.user || !name.trim()) {
      toast({
        title: "Error",
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          name: name.trim(),
          birthday: birthday || null
        })
        .eq("user_id", session.user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
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

      setPartner(null);
      navigate("/");
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
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-white p-6 shadow-soft">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Profile</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-6 space-y-6 animate-fade-in">
        {/* Profile Card */}
        <Card className="p-6 border-2 border-primary/20 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">Your Profile</h3>
              <p className="text-sm text-muted-foreground">
                Update your personal information
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-2 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={session.user.email}
                disabled
                className="border-2 bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthday">Birthday</Label>
              <Input
                id="birthday"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="border-2 focus:border-primary"
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </Card>

        {/* Partner Card */}
        {partner && (
          <Card className="p-6 border-2 border-primary/20 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" fill="white" />
              </div>
              <div>
                <h3 className="font-semibold">Connected Partner</h3>
                <p className="text-sm text-muted-foreground">
                  {partner.name}
                </p>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Disconnect from Partner
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will disconnect you from your partner. You'll need a new invitation
                    code to reconnect. All shared activity history will remain but you won't
                    be able to add new activities until you connect again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDisconnect}>
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Profile;
