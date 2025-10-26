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
  notes?: string;
}

interface Profile {
  user_id: string;
  name: string;
  birthday?: string;
}

interface ActivityLogProps {
  activities: Activity[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, activityDate: Date, emoji: string, notes?: string) => void;
  currentUserId?: string;
}

export default function ActivityLog({ activities, onDelete, onUpdate, currentUserId }: ActivityLogProps) {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editNotes, setEditNotes] = useState("");

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
    setEditNotes(activity.notes || "");
  };

  const handleSaveEdit = () => {
    if (!editingActivity || !editDate || !editTime || !editEmoji) return;
    
    const combinedDateTime = new Date(`${editDate}T${editTime}`);
    onUpdate(editingActivity.id, combinedDateTime, editEmoji, editNotes);
    setEditingActivity(null);
    setEditDate("");
    setEditTime("");
    setEditEmoji("");
    setEditNotes("");
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
      <Card className="p-4 sm:p-6 text-center border-2 border-dashed border-primary/20">
        <p className="text-sm sm:text-base text-muted-foreground">No activities logged yet. Start tracking your moments together!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      {activities.map((activity, index) => {
        const isCurrentUser = currentUserId === activity.user_id;
        const profile = profiles[activity.user_id];
        const loggedBy = profile?.name || "Unknown";
        const specialDate = getSpecialDateBadge(activity.activity_date);
        
        return (
          <Card
            key={activity.id}
            className={`p-2.5 sm:p-3 flex items-center justify-between border-2 transition-all hover:shadow-soft animate-slide-up ${
              specialDate 
                ? "border-primary/40 bg-gradient-to-r from-primary/5 to-transparent" 
                : "border-primary/10 hover:border-primary/30"
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
              {activity.emoji && (
                <span className="text-2xl sm:text-3xl flex-shrink-0">{activity.emoji}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm sm:text-base truncate">
                  {new Date(activity.activity_date).toLocaleDateString()}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {new Date(activity.activity_date).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false 
                  })}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground truncate">
                    Logged by {isCurrentUser ? "you" : loggedBy}
                  </p>
                </div>
                {activity.notes && (
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 italic">
                    {activity.notes}
                  </p>
                )}
                {specialDate && (
                  <div className={`mt-1.5 inline-block px-1.5 py-0.5 rounded-full text-xs font-semibold border ${specialDate.color}`}>
                    {specialDate.label}
                  </div>
                )}
              </div>
            </div>
            {isCurrentUser && (
              <div className="flex gap-0.5 flex-shrink-0">
                <Dialog open={editingActivity?.id === activity.id} onOpenChange={(open) => !open && setEditingActivity(null)}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(activity)}
                      className="hover:bg-primary/10 h-8 w-8 sm:h-9 sm:w-9"
                    >
                      <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
                      <div className="space-y-2">
                        <Label htmlFor="edit-notes">Notes (optional)</Label>
                        <Input
                          id="edit-notes"
                          type="text"
                          placeholder="Add a note..."
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          maxLength={200}
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
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 sm:h-9 sm:w-9"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
