import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NotificationOnboardingProps {
  onComplete: () => void;
}

export default function NotificationOnboarding({ onComplete }: NotificationOnboardingProps) {
  const [isRequesting, setIsRequesting] = useState(false);

  const handleEnableNotifications = async () => {
    if (!("Notification" in window)) {
      toast.error("This browser doesn't support notifications");
      onComplete();
      return;
    }

    setIsRequesting(true);

    try {
      const permission = await Notification.requestPermission();

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

        // Save to database
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("notification_preferences").upsert({
            user_id: user.id,
            push_token: pushToken,
            weekly_nudges: false,
            streak_celebrations: true,
            milestones: true,
            monthly_recap: false,
            comeback_boosts: true,
            quiet_hours_start: "21:00",
            quiet_hours_end: "08:00",
          });
        }

        toast.success("Notifications enabled!");
      }
    } catch (error) {
      console.error("Error enabling notifications:", error);
      toast.error("Failed to enable notifications");
    } finally {
      setIsRequesting(false);
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Bell className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-center">Stay Connected</CardTitle>
          <CardDescription className="text-center">
            Want gentle, slightly flirty reminders to keep your streak alive?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            onClick={handleEnableNotifications}
            disabled={isRequesting}
          >
            {isRequesting ? "Setting up..." : "Yes, remind us"}
          </Button>
          <Button variant="outline" className="w-full" onClick={handleSkip}>
            Not now
          </Button>
          
          {/* iOS Note */}
          {/iPad|iPhone|iPod/.test(navigator.userAgent) && (
            <p className="text-xs text-center text-muted-foreground">
              💡 On iOS, notifications require adding this app to your home screen first
            </p>
          )}
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
