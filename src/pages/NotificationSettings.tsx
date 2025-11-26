import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface NotificationPreferences {
  weekly_nudges: boolean;
  streak_celebrations: boolean;
  milestones: boolean;
  monthly_recap: boolean;
  comeback_boosts: boolean;
  push_token: string | null;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function NotificationSettings() {
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    weekly_nudges: false,
    streak_celebrations: true,
    milestones: true,
    monthly_recap: false,
    comeback_boosts: true,
    push_token: null,
  });
  const [loading, setLoading] = useState(true);
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");

  useEffect(() => {
    loadPreferences();
    checkPermission();
  }, []);

  const checkPermission = () => {
    if ("Notification" in window) {
      setPermissionState(Notification.permission);
    }
  };

  const loadPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load current user's preferences
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (prefs) {
        setPreferences({
          weekly_nudges: prefs.weekly_nudges,
          streak_celebrations: prefs.streak_celebrations,
          milestones: prefs.milestones,
          monthly_recap: prefs.monthly_recap,
          comeback_boosts: prefs.comeback_boosts,
          push_token: prefs.push_token,
        });
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("This browser doesn't support notifications");
      return;
    }

    if (!("serviceWorker" in navigator)) {
      toast.error("Service workers are not supported in this browser");
      return;
    }

    try {
      console.log("Requesting notification permission...");
      const permission = await Notification.requestPermission();
      console.log("Permission result:", permission);
      setPermissionState(permission);

      if (permission === "granted") {
        console.log("Permission granted, registering service worker...");
        
        // Check if VAPID key exists
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          console.error("VAPID public key not found");
          toast.error("Push notifications not configured. Please contact support.");
          return;
        }

        // Register service worker and get push token
        const registration = await navigator.serviceWorker.ready;
        console.log("Service worker ready:", registration);
        
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
        console.log("Push subscription created:", subscription);

        const pushToken = JSON.stringify(subscription);
        console.log("Saving push token...");
        await savePreferences({ ...preferences, push_token: pushToken });
        toast.success("Notifications enabled!");
      } else {
        toast.error("Notification permission denied");
      }
    } catch (error) {
      console.error("Error requesting permission:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to enable notifications: ${errorMessage}`);
    }
  };

  const savePreferences = async (newPrefs: NotificationPreferences) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Get partner's user_id
      const { data: partnerId } = await supabase.rpc('get_partner_id', {
        user_id: user.id
      });

      // Prepare preferences update (excluding push_token which is user-specific)
      const sharedPrefs = {
        weekly_nudges: newPrefs.weekly_nudges,
        streak_celebrations: newPrefs.streak_celebrations,
        milestones: newPrefs.milestones,
        monthly_recap: newPrefs.monthly_recap,
        comeback_boosts: newPrefs.comeback_boosts,
      };

      // Update current user's preferences (with their push_token)
      const { error: userError } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user.id,
          ...sharedPrefs,
          push_token: newPrefs.push_token,
          timezone,
        }, {
          onConflict: 'user_id'
        });

      if (userError) throw userError;

      // If partner exists, update their preferences too (keeping their push_token)
      if (partnerId) {
        const { data: partnerPrefs } = await supabase
          .from("notification_preferences")
          .select("push_token, timezone")
          .eq("user_id", partnerId)
          .maybeSingle();

        await supabase
          .from("notification_preferences")
          .upsert({
            user_id: partnerId,
            ...sharedPrefs,
            push_token: partnerPrefs?.push_token || null,
            timezone: partnerPrefs?.timezone || timezone,
          }, {
            onConflict: 'user_id'
          });
      }

      setPreferences(newPrefs);
      toast.success(partnerId 
        ? "Preferences saved for both partners" 
        : "Preferences saved"
      );
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save preferences");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <p>Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => navigate("/profile")}>
          ← Back
        </Button>
        <h1 className="text-3xl font-bold">Notification Settings</h1>
      </div>

      {/* Permission Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {permissionState === "granted" ? <Bell /> : <BellOff />}
            Push Notifications
          </CardTitle>
          <CardDescription>
            {permissionState === "granted"
              ? "Notifications are enabled. You'll receive gentle reminders."
              : "Enable notifications to get gentle, slightly flirty reminders to keep your streak alive."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {permissionState === "default" && (
            <Button onClick={requestNotificationPermission}>
              Yes, remind us
            </Button>
          )}
          {permissionState === "denied" && (
            <p className="text-sm text-muted-foreground">
              Notifications are blocked. Please enable them in your browser settings.
            </p>
          )}
          {permissionState === "granted" && !preferences.push_token && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Browser permission granted but push token not saved. Click to re-register.
              </p>
              <Button onClick={requestNotificationPermission}>
                Re-enable notifications
              </Button>
            </div>
          )}
          {permissionState === "granted" && preferences.push_token && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notifications enabled
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preferences Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            These settings apply to both you and your partner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="weekly_nudges" className="flex-1">
              <div className="font-medium">Weekly nudges</div>
              <div className="text-sm text-muted-foreground">
                Gentle reminders at 8pm your local time
              </div>
            </Label>
            <Switch
              id="weekly_nudges"
              checked={preferences.weekly_nudges}
              onCheckedChange={(checked) =>
                savePreferences({ ...preferences, weekly_nudges: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="streak_celebrations" className="flex-1">
              <div className="font-medium">Streak celebrations</div>
              <div className="text-sm text-muted-foreground">
                Celebrate after logging each activity
              </div>
            </Label>
            <Switch
              id="streak_celebrations"
              checked={preferences.streak_celebrations}
              onCheckedChange={(checked) =>
                savePreferences({ ...preferences, streak_celebrations: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="milestones" className="flex-1">
              <div className="font-medium">Milestones</div>
              <div className="text-sm text-muted-foreground">
                Celebrate streak milestones (5, 10, 15 weeks...)
              </div>
            </Label>
            <Switch
              id="milestones"
              checked={preferences.milestones}
              onCheckedChange={(checked) =>
                savePreferences({ ...preferences, milestones: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="monthly_recap" className="flex-1">
              <div className="font-medium">Monthly recap</div>
              <div className="text-sm text-muted-foreground">
                Playful summary at the start of each month
              </div>
            </Label>
            <Switch
              id="monthly_recap"
              checked={preferences.monthly_recap}
              onCheckedChange={(checked) =>
                savePreferences({ ...preferences, monthly_recap: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="comeback_boosts" className="flex-1">
              <div className="font-medium">Comeback boosts</div>
              <div className="text-sm text-muted-foreground">
                Encouragement after missing a week
              </div>
            </Label>
            <Switch
              id="comeback_boosts"
              checked={preferences.comeback_boosts}
              onCheckedChange={(checked) =>
                savePreferences({ ...preferences, comeback_boosts: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
