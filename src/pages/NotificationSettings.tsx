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

interface ScheduleSlot {
  day_of_week: number;
  time: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_SCHEDULE = [
  { day_of_week: 1, time: "09:00" }, // Mon 09:00
  { day_of_week: 3, time: "15:00" }, // Wed 15:00
  { day_of_week: 6, time: "10:30" }, // Sat 10:30
  { day_of_week: 0, time: "18:00" }, // Sun 18:00
];

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
  const [schedule, setSchedule] = useState<ScheduleSlot[]>(DEFAULT_SCHEDULE);
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

      // Load preferences
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

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

      // Load schedule
      const { data: scheduleData } = await supabase
        .from("notification_schedule")
        .select("*")
        .eq("user_id", user.id)
        .order("day_of_week");

      if (scheduleData && scheduleData.length > 0) {
        setSchedule(scheduleData.map(s => ({
          day_of_week: s.day_of_week,
          time: s.time,
        })));
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

    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission === "granted") {
        // Register service worker and get push token
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            import.meta.env.VITE_VAPID_PUBLIC_KEY || ""
          ),
        });

        const pushToken = JSON.stringify(subscription);
        await savePreferences({ ...preferences, push_token: pushToken });
        toast.success("Notifications enabled!");
      } else {
        toast.error("Notification permission denied");
      }
    } catch (error) {
      console.error("Error requesting permission:", error);
      toast.error("Failed to enable notifications");
    }
  };

  const savePreferences = async (newPrefs: NotificationPreferences) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user.id,
          ...newPrefs,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      setPreferences(newPrefs);
      toast.success("Preferences saved");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save preferences");
    }
  };

  const saveSchedule = async (newSchedule: ScheduleSlot[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete existing schedule
      await supabase
        .from("notification_schedule")
        .delete()
        .eq("user_id", user.id);

      // Insert new schedule
      const { error } = await supabase
        .from("notification_schedule")
        .insert(
          newSchedule.map(slot => ({
            user_id: user.id,
            day_of_week: slot.day_of_week,
            time: slot.time,
          }))
        );

      if (error) throw error;
      setSchedule(newSchedule);
      toast.success("Schedule saved");
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast.error("Failed to save schedule");
    }
  };

  const updateScheduleSlot = (index: number, field: "day_of_week" | "time", value: number | string) => {
    const newSchedule = [...schedule];
    newSchedule[index] = { ...newSchedule[index], [field]: value };
    setSchedule(newSchedule);
  };

  const addScheduleSlot = () => {
    if (schedule.length >= 7) {
      toast.error("Maximum 7 schedule slots allowed");
      return;
    }
    setSchedule([...schedule, { day_of_week: 1, time: "09:00" }]);
  };

  const removeScheduleSlot = (index: number) => {
    const newSchedule = schedule.filter((_, i) => i !== index);
    setSchedule(newSchedule);
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
          {permissionState === "granted" && (
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
          <CardDescription>Choose which types of notifications you want to receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="weekly_nudges" className="flex-1">
              <div className="font-medium">Weekly nudges</div>
              <div className="text-sm text-muted-foreground">
                Gentle reminders throughout the week
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

      {/* Schedule Card */}
      {preferences.weekly_nudges && (
        <Card>
          <CardHeader>
            <CardTitle>Weekly Schedule</CardTitle>
            <CardDescription>
              Choose when you want to receive weekly nudges
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {schedule.map((slot, index) => (
              <div key={index} className="flex items-center gap-4">
                <select
                  className="flex-1 px-3 py-2 border rounded-md"
                  value={slot.day_of_week}
                  onChange={(e) =>
                    updateScheduleSlot(index, "day_of_week", parseInt(e.target.value))
                  }
                >
                  {DAYS.map((day, i) => (
                    <option key={i} value={i}>
                      {day}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  className="flex-1 px-3 py-2 border rounded-md"
                  value={slot.time}
                  onChange={(e) => updateScheduleSlot(index, "time", e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeScheduleSlot(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" onClick={addScheduleSlot}>
                Add Slot
              </Button>
              <Button onClick={() => saveSchedule(schedule)}>Save Schedule</Button>
            </div>
          </CardContent>
        </Card>
      )}
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
