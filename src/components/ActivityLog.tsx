import { Trash2, User, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import EmojiSelector from "./EmojiSelector";

interface Activity {
  id: string;
  activity_date: string;
  user_id: string;
  emoji?: string;
}

interface Profile {
  user_id: string;
  name: string;
  birthday?: string;
}

interface ActivityLogProps {
  activities: Activity[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, activityDate: Date, emoji: string) => void;
  currentUserId?: string;
}

export default function ActivityLog({ activities, onDelete, onUpdate, currentUserId }: ActivityLogProps) {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editEmoji, setEditEmoji] = useState("");

  useEffect(() => {
    const fetchProfiles = async () => {
      // Get unique user IDs from activities
      const userIds = [...new Set(activities.map(a => a.user_id))];
      
      if (userIds.length === 0) return;

      // Also fetch current user's partner profile
      if (currentUserId) {
        const { data: coupleData } = await supabase
          .from("couples")
          .select("user1_id, user2_id")
          .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
          .maybeSingle();

        if (coupleData) {
          const partnerId = coupleData.user1_id === currentUserId 
            ? coupleData.user2_id 
            : coupleData.user1_id;
          
          // Add partner to userIds if not already there
          if (!userIds.includes(partnerId)) {
            userIds.push(partnerId);
          }
          
          // Add current user if not already there
          if (!userIds.includes(currentUserId)) {
            userIds.push(currentUserId);
          }
        }
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, birthday")
        .in("user_id", userIds);

      if (data && !error) {
        const profileMap: Record<string, Profile> = {};
        data.forEach((profile: Profile) => {
          profileMap[profile.user_id] = profile;
        });
        setProfiles(profileMap);
        console.log('Loaded profiles:', profileMap);
      }
    };

    fetchProfiles();
  }, [activities, currentUserId]);

  const handleEditClick = (activity: Activity) => {
    setEditingActivity(activity);
    const date = new Date(activity.activity_date);
    setEditDate(date.toISOString().split('T')[0]);
    setEditTime(date.toTimeString().slice(0, 5));
    setEditEmoji(activity.emoji || "");
  };

  const handleSaveEdit = () => {
    if (!editingActivity || !editDate || !editTime || !editEmoji) return;
    
    const combinedDateTime = new Date(`${editDate}T${editTime}`);
    onUpdate(editingActivity.id, combinedDateTime, editEmoji);
    setEditingActivity(null);
    setEditDate("");
    setEditTime("");
    setEditEmoji("");
  };

  const getSpecialDateBadge = (activityDate: string) => {
    const date = new Date(activityDate);
    const activityMonth = date.getMonth() + 1; // 0-indexed
    const activityDay = date.getDate();

    // Check for birthday - check ALL profiles
    for (const profile of Object.values(profiles)) {
      if (profile?.birthday) {
        // Parse birthday as UTC to avoid timezone issues
        const [year, month, day] = profile.birthday.split('-').map(Number);
        
        if (month === activityMonth && day === activityDay) {
          return { label: "🎂 Birthday", color: "bg-pink-500/20 text-pink-700 border-pink-500/50" };
        }
      }
    }

    // Check for Christmas (Dec 24)
    if (activityMonth === 12 && activityDay === 24) {
      return { label: "🎄 Christmas", color: "bg-green-500/20 text-green-700 border-green-500/50" };
    }

    // Check for New Year's Eve (Dec 31)
    if (activityMonth === 12 && activityDay === 31) {
      return { label: "🎉 New Year's", color: "bg-purple-500/20 text-purple-700 border-purple-500/50" };
    }

    // Check for Leap Day (Feb 29)
    if (activityMonth === 2 && activityDay === 29) {
      return { label: "🐸 Leap Day", color: "bg-blue-500/20 text-blue-700 border-blue-500/50" };
    }

    return null;
  };

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
        const profile = profiles[activity.user_id];
        const loggedBy = profile?.name || "Unknown";
        const specialDate = getSpecialDateBadge(activity.activity_date);
        
        return (
          <Card
            key={activity.id}
            className={`p-4 flex items-center justify-between border-2 transition-all hover:shadow-soft animate-slide-up ${
              specialDate 
                ? "border-primary/40 bg-gradient-to-r from-primary/5 to-transparent" 
                : "border-primary/10 hover:border-primary/30"
            }`}
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
                {specialDate && (
                  <div className={`mt-2 inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${specialDate.color}`}>
                    {specialDate.label}
                  </div>
                )}
              </div>
            </div>
            {isCurrentUser && (
              <div className="flex gap-1">
                <Dialog open={editingActivity?.id === activity.id} onOpenChange={(open) => !open && setEditingActivity(null)}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(activity)}
                      className="hover:bg-primary/10"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Activity</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-date">Date</Label>
                        <Input
                          id="edit-date"
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          max={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-time">Time</Label>
                        <Input
                          id="edit-time"
                          type="time"
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Emoji</Label>
                        <EmojiSelector
                          selectedEmoji={editEmoji}
                          onSelect={setEditEmoji}
                        />
                      </div>
                      <Button 
                        onClick={handleSaveEdit} 
                        className="w-full"
                        disabled={!editDate || !editTime || !editEmoji}
                      >
                        Save Changes
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(activity.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
