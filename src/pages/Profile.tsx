import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, User, Heart, Trash2, Loader2, UserX } from "lucide-react";
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
  birthday?: string;
}

interface Couple {
  id: string;
  anniversary?: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [anniversary, setAnniversary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
      
      // Store couple data
      setCouple({
        id: coupleData.id,
        anniversary: coupleData.anniversary || undefined,
      });
      setAnniversary(coupleData.anniversary || "");
      
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
          birthday: partnerProfile.birthday || undefined,
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
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          name: name.trim(),
          birthday: birthday || null
        })
        .eq("user_id", session.user.id);

      if (profileError) throw profileError;

      // Update anniversary in couples table if exists
      if (couple) {
        const { error: coupleError } = await supabase
          .from("couples")
          .update({ anniversary: anniversary || null })
          .eq("id", couple.id);

        if (coupleError) throw coupleError;
      }

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

  const handleDeleteAccount = async () => {
    if (!session?.user) return;

    setDeleting(true);

    try {
      // Get partner's ID first if exists
      const { data: coupleData } = await supabase
        .from("couples")
        .select("*")
        .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`)
        .maybeSingle();

      if (coupleData) {
        const partnerId = coupleData.user1_id === session.user.id 
          ? coupleData.user2_id 
          : coupleData.user1_id;

        // Delete all activities for both users
        await supabase
          .from("activities")
          .delete()
          .in("user_id", [session.user.id, partnerId]);

        // Delete couple relationship
        await supabase
          .from("couples")
          .delete()
          .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`);
      } else {
        // Just delete own activities if no partner
        await supabase
          .from("activities")
          .delete()
          .eq("user_id", session.user.id);
      }

      // Delete all invitations
      await supabase
        .from("couple_invitations")
        .delete()
        .eq("sender_id", session.user.id);

      // Delete profile
      await supabase
        .from("profiles")
        .delete()
        .eq("user_id", session.user.id);

      // Sign out the user
      await supabase.auth.signOut();

      toast({
        title: "Account Deleted",
        description: "All your data has been permanently deleted",
      });

      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setDeleting(false);
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
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="bg-primary text-white p-3 sm:p-4 shadow-soft">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="text-white hover:bg-white/20 h-9 w-9"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Profile</h1>
          <div className="w-9" /> {/* Spacer */}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-3 sm:p-4 space-y-3 sm:space-y-4 animate-fade-in">
        {/* Profile Card */}
        <Card className="p-3 sm:p-4 border-2 border-primary/20 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm sm:text-base truncate">Your Profile</h3>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
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
              <Label htmlFor="birthday" className="flex items-center gap-2">
                <span>🎂</span>
                <span>Birthday</span>
              </Label>
              <Input
                id="birthday"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="border-2 focus:border-primary text-sm sm:text-base"
              />
            </div>
            {partner && (
              <div className="space-y-2">
                <Label htmlFor="anniversary" className="flex items-center gap-2">
                  <span>🫶</span>
                  <span>Anniversary</span>
                </Label>
                <Input
                  id="anniversary"
                  type="date"
                  value={anniversary}
                  onChange={(e) => setAnniversary(e.target.value)}
                  className="border-2 focus:border-primary text-sm sm:text-base"
                />
              </div>
            )}
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
          <Card className="p-3 sm:p-4 border-2 border-primary/20 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm sm:text-base truncate">Connected Partner</h3>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {partner.name}
                </p>
              </div>
            </div>

            {partner.birthday && (
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <Label className="flex items-center gap-2 text-xs sm:text-sm">
                  <span>🎂</span>
                  <span>Partner's Birthday</span>
                </Label>
                <p className="text-sm font-medium mt-1">
                  {new Date(partner.birthday + 'T00:00:00').toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            )}

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

        {/* Delete Account Card */}
        <Card className="p-3 sm:p-4 border-2 border-destructive/20 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-destructive flex items-center justify-center flex-shrink-0">
              <UserX className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm sm:text-base truncate">Delete Account</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full"
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <UserX className="w-4 h-4 mr-2" />
                )}
                Forget Me
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Your Account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account and remove all your data from our servers, including:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Your profile information</li>
                    <li>All activity history</li>
                    <li>Your partner connection</li>
                    <li>All invitations</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeleteAccount}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Delete Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
