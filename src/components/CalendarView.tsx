import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Pencil, Trash2, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import EmojiSelector from "./EmojiSelector";
import LocationPicker, { LocationValue } from "./LocationPicker";
import OnThisDay from "./OnThisDay";
import { countryFlag } from "@/lib/countryFlag";
import { supabase } from "@/integrations/supabase/client";
import {
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format, 
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek
} from "date-fns";

interface Activity {
  id: string;
  activity_date: string;
  user_id: string;
  emoji?: string;
  notes?: string;
  location_label?: string | null;
  location_country?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
}

interface Profile {
  user_id: string;
  name: string;
  birthday?: string;
}

interface CalendarViewProps {
  activities: Activity[];
  currentUserId?: string;
  onDelete: (id: string) => void;
  onUpdate: (id: string, activityDate: Date, emoji: string, notes?: string, location?: LocationValue | null) => void;
}

export default function CalendarView({ activities, currentUserId, onDelete, onUpdate }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedActivities, setSelectedActivities] = useState<Activity[]>([]);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLocation, setEditLocation] = useState<LocationValue | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [anniversary, setAnniversary] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      const userIds = [...new Set(activities.map(a => a.user_id))];
      if (userIds.length === 0) return;

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
      }
    };

    fetchProfiles();
  }, [activities]);

  useEffect(() => {
    const fetchAnniversary = async () => {
      if (!currentUserId) return;
      
      const { data } = await supabase
        .from("couples")
        .select("anniversary")
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .maybeSingle();

      if (data?.anniversary) {
        setAnniversary(data.anniversary);
      }
    };

    fetchAnniversary();
  }, [currentUserId]);

  // Group activities by date
  const activitiesByDate = useMemo(() => {
    const grouped: Record<string, Activity[]> = {};
    activities.forEach(activity => {
      const dateKey = format(new Date(activity.activity_date), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(activity);
    });
    return grouped;
  }, [activities]);

  // Get calendar days
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const startWeek = startOfWeek(start, { weekStartsOn: 1 }); // Monday
    const endWeek = endOfWeek(end, { weekStartsOn: 1 });
    
    return eachDayOfInterval({ start: startWeek, end: endWeek });
  }, [currentMonth]);

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const getDayActivities = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return activitiesByDate[dateKey] || [];
  };

  const getSpecialEvent = (day: Date): { 
    isBirthday: boolean; 
    isAnniversary: boolean; 
    birthdayName?: string;
    message: string;
  } => {
    const monthDay = format(day, 'MM-dd');
    let isBirthday = false;
    let isAnniversary = false;
    let birthdayName = '';
    
    // Check for birthdays
    for (const profile of Object.values(profiles)) {
      if (profile.birthday) {
        const birthdayMonthDay = format(new Date(profile.birthday), 'MM-dd');
        if (birthdayMonthDay === monthDay) {
          isBirthday = true;
          birthdayName = profile.user_id === currentUserId ? 'you' : profile.name;
        }
      }
    }
    
    // Check for anniversary
    if (anniversary) {
      const anniversaryMonthDay = format(new Date(anniversary), 'MM-dd');
      if (anniversaryMonthDay === monthDay) {
        isAnniversary = true;
      }
    }
    
    let message = '';
    if (isBirthday && isAnniversary) {
      message = `🎂 Happy birthday ${birthdayName}! 🫶 Happy anniversary`;
    } else if (isBirthday) {
      message = `🎂 Happy birthday ${birthdayName}!`;
    } else if (isAnniversary) {
      message = '🫶 Happy anniversary';
    }
    
    return { isBirthday, isAnniversary, birthdayName, message };
  };

  // Get highlights for the month
  const monthHighlights = useMemo(() => {
    const highlights: Array<{ date: Date; type: 'birthday' | 'anniversary'; name?: string }> = [];
    
    calendarDays.forEach(day => {
      if (isSameMonth(day, currentMonth)) {
        const special = getSpecialEvent(day);
        if (special.isBirthday) {
          highlights.push({ date: day, type: 'birthday', name: special.birthdayName });
        }
        if (special.isAnniversary) {
          highlights.push({ date: day, type: 'anniversary' });
        }
      }
    });
    
    return highlights;
  }, [calendarDays, currentMonth, profiles, anniversary]);

  const handleDayClick = (day: Date) => {
    if (!isSameMonth(day, currentMonth)) return;
    const dayActivities = getDayActivities(day);
    const special = getSpecialEvent(day);
    if (dayActivities.length > 0 || special.isBirthday || special.isAnniversary) {
      setSelectedDay(day);
      setSelectedActivities(dayActivities);
    }
  };

  const handleEditClick = (activity: Activity) => {
    setEditingActivity(activity);
    const date = new Date(activity.activity_date);
    setEditDate(date.toISOString().split('T')[0]);
    setEditTime(date.toTimeString().slice(0, 5));
    setEditEmoji(activity.emoji || "");
    setEditNotes(activity.notes || "");
    setEditLocation(
      activity.location_label
        ? {
            label: activity.location_label,
            country: activity.location_country ?? null,
            lat: activity.location_lat ?? null,
            lng: activity.location_lng ?? null,
          }
        : null,
    );
  };

  const handleSaveEdit = () => {
    if (!editingActivity || !editDate || !editTime || !editEmoji) return;
    
    const combinedDateTime = new Date(`${editDate}T${editTime}`);
    onUpdate(editingActivity.id, combinedDateTime, editEmoji, editNotes, editLocation);
    setEditingActivity(null);
    setEditDate("");
    setEditTime("");
    setEditEmoji("");
    setEditNotes("");
    setEditLocation(null);
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    // Remove from selected activities
    setSelectedActivities(prev => prev.filter(a => a.id !== id));
    // Close dialog if no more activities
    if (selectedActivities.length <= 1) {
      setSelectedDay(null);
    }
  };

  return (
    <div className="space-y-4">
    <Card className="p-4 sm:p-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePreviousMonth}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl sm:text-2xl font-bold">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Highlights Section */}
      {monthHighlights.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
          <p className="text-sm font-medium text-muted-foreground mb-1">This month:</p>
          <div className="flex flex-wrap gap-2">
            {monthHighlights.map((highlight, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentMonth(highlight.date);
                  handleDayClick(highlight.date);
                }}
                className="text-sm px-2 py-1 rounded-md bg-white/50 hover:bg-white transition-colors"
              >
                {highlight.type === 'birthday' ? '🎂' : '💍'}{' '}
                {highlight.type === 'birthday' 
                  ? `Birthday ${highlight.name ? `(${highlight.name})` : ''} on ${format(highlight.date, 'MMM d')}`
                  : `Anniversary on ${format(highlight.date, 'MMM d')}`
                }
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
          <div
            key={index}
            className="text-center text-xs sm:text-sm font-semibold text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {calendarDays.map((day, index) => {
          const dayActivities = getDayActivities(day);
          const hasActivities = dayActivities.length > 0;
          const activityCount = dayActivities.length;
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isToday(day);
          const lastEmoji = hasActivities ? dayActivities[dayActivities.length - 1].emoji : null;
          const specialEvent = getSpecialEvent(day);
          const isClickable = hasActivities || specialEvent.isBirthday || specialEvent.isAnniversary;

          return (
            <button
              key={index}
              onClick={() => handleDayClick(day)}
              disabled={!isCurrentMonth || !isClickable}
              title={
                hasActivities 
                  ? `${activityCount} ${activityCount === 1 ? 'activity' : 'activities'} logged this day`
                  : specialEvent.message || undefined
              }
              className={`
                aspect-square flex flex-col items-center justify-center relative rounded-lg
                transition-all duration-200
                ${!isCurrentMonth ? 'opacity-30' : ''}
                ${isCurrentDay ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
                ${isClickable 
                  ? 'hover:scale-105 cursor-pointer' 
                  : 'cursor-default'
                }
              `}
            >
              {/* Anniversary ring (coral) */}
              {specialEvent.isAnniversary && (
                <div className="absolute inset-1 rounded-full border-[1.5px] border-[#FF6B6B]/40" />
              )}
              
              {/* Birthday ring (lavender) */}
              {specialEvent.isBirthday && (
                <div 
                  className={`absolute rounded-full border-[1.5px] border-[#D9C6F0]/50 ${
                    specialEvent.isAnniversary ? 'inset-[6px]' : 'inset-1'
                  }`} 
                />
              )}

              {lastEmoji ? (
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <span className="text-lg sm:text-2xl">
                    {lastEmoji}
                  </span>
                  {activityCount > 1 && (
                    <div className="flex gap-0.5">
                      {Array.from({ length: Math.min(activityCount, 5) }).map((_, i) => (
                        <div 
                          key={i} 
                          className="w-1 h-1 rounded-full bg-[#FF6B6B]/50"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span className={`text-sm sm:text-base ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {format(day, 'd')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Activity Details Dialog */}
      <Dialog open={selectedDay !== null && !editingActivity} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDay && format(selectedDay, 'MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {selectedDay && (getSpecialEvent(selectedDay).isBirthday || getSpecialEvent(selectedDay).isAnniversary) && (
              <Card className="p-3 border-2 border-primary/50 bg-primary/5">
                <p className="text-base font-semibold text-primary">
                  {getSpecialEvent(selectedDay).message}
                </p>
              </Card>
            )}
            {selectedActivities.map((activity) => {
              const isCurrentUser = currentUserId === activity.user_id;
              const profile = profiles[activity.user_id];
              const loggedBy = profile?.name || "Unknown";
              return (
                <Card key={activity.id} className="p-3 border-2">
                  <div className="flex items-start gap-3">
                    {activity.emoji && (
                      <span className="text-3xl flex-shrink-0">{activity.emoji}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-muted-foreground">
                        {new Date(activity.activity_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {" (by "}{isCurrentUser ? "you" : loggedBy}{")"}
                      </p>
                      {activity.notes && (
                        <p className="text-sm mt-1 italic">{activity.notes}</p>
                      )}
                      {activity.location_label && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>
                            {countryFlag(activity.location_country)} {activity.location_label}
                          </span>
                        </p>
                      )}
                    </div>
                    {isCurrentUser && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(activity)}
                          className="h-8 w-8 hover:bg-primary/10"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(activity.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Activity Dialog */}
      <Dialog open={editingActivity !== null} onOpenChange={(open) => !open && setEditingActivity(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
            <div className="space-y-2">
              <Label>Location (optional)</Label>
              <LocationPicker value={editLocation} onChange={setEditLocation} />
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
    </Card>
    
    {/* On This Day Section */}
    <OnThisDay activities={activities} />
    </div>
  );
}