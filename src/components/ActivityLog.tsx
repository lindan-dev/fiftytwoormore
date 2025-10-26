import { Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

interface Activity {
  id: string;
  activity_date: string;
  user_id: string;
  emoji?: string;
}

interface Profile {
  user_id: string;
  name: string;
}

interface ActivityLogProps {
  activities: Activity[];
  onDelete: (id: string) => void;
  currentUserId?: string;
}

export default function ActivityLog({ activities, onDelete, currentUserId }: ActivityLogProps) {
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchProfiles = async () => {
      // Get unique user IDs from activities
      const userIds = [...new Set(activities.map(a => a.user_id))];
      
      if (userIds.length === 0) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);

      if (data && !error) {
        const profileMap: Record<string, string> = {};
        data.forEach((profile: Profile) => {
          profileMap[profile.user_id] = profile.name;
        });
        setProfiles(profileMap);
      }
    };

    fetchProfiles();
  }, [activities]);
  if (activities.length === 0) {
    return (
      <Card className="p-8 text-center border-2 border-dashed border-primary/20">
        <p className="text-muted-foreground">No activities logged yet. Start tracking your moments together!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => {
        const isCurrentUser = currentUserId === activity.user_id;
        const loggedBy = profiles[activity.user_id] || "Unknown";
        
        return (
          <Card
            key={activity.id}
            className="p-4 flex items-center justify-between border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-soft animate-slide-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-3">
              {activity.emoji && (
                <span className="text-3xl">{activity.emoji}</span>
              )}
              <div>
                <p className="font-semibold text-lg">
                  {new Date(activity.activity_date).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(activity.activity_date).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Logged by {isCurrentUser ? "you" : loggedBy}
                  </p>
                </div>
              </div>
            </div>
            {isCurrentUser && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(activity.id)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
