import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import EmojiSelector from "./EmojiSelector";
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format, 
  isSameMonth,
  isSameDay,
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
}

interface CalendarViewProps {
  activities: Activity[];
  currentUserId?: string;
  onDelete: (id: string) => void;
  onUpdate: (id: string, activityDate: Date, emoji: string, notes?: string) => void;
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

  const handleDayClick = (day: Date) => {
    if (!isSameMonth(day, currentMonth)) return;
    const dayActivities = getDayActivities(day);
    if (dayActivities.length > 0) {
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
          const hasMultiple = dayActivities.length > 1;
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const firstEmoji = hasActivities ? dayActivities[0].emoji : null;

          return (
            <button
              key={index}
              onClick={() => handleDayClick(day)}
              disabled={!isCurrentMonth || !hasActivities}
              className={`
                aspect-square flex items-center justify-center relative rounded-lg
                transition-all duration-200
                ${!isCurrentMonth ? 'opacity-30' : ''}
                ${hasActivities 
                  ? 'hover:scale-105 cursor-pointer' 
                  : 'cursor-default'
                }
              `}
            >
              {hasActivities && firstEmoji ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* Rings for multiple activities */}
                  {dayActivities.length >= 5 && (
                    <div className="absolute inset-0 rounded-full border-2 border-primary/30" />
                  )}
                  {dayActivities.length >= 4 && (
                    <div className="absolute inset-[3px] sm:inset-[4px] rounded-full border-2 border-primary/40" />
                  )}
                  {dayActivities.length >= 3 && (
                    <div className="absolute inset-[6px] sm:inset-[8px] rounded-full border-2 border-primary/50" />
                  )}
                  {dayActivities.length >= 2 && (
                    <div className="absolute inset-[9px] sm:inset-[12px] rounded-full border-2 border-primary/60" />
                  )}
                  
                  {/* White circle background with emoji */}
                  <div className="absolute inset-[12px] sm:inset-[16px] bg-white rounded-full shadow-sm flex items-center justify-center">
                    <span className="text-lg sm:text-xl">
                      {firstEmoji}
                    </span>
                  </div>
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
            {selectedActivities.map((activity) => {
              const isCurrentUser = currentUserId === activity.user_id;
              return (
                <Card key={activity.id} className="p-3 border-2">
                  <div className="flex items-start gap-3">
                    {activity.emoji && (
                      <span className="text-3xl flex-shrink-0">{activity.emoji}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-muted-foreground">
                        {new Date(activity.activity_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {activity.notes && (
                        <p className="text-sm mt-1 italic">{activity.notes}</p>
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
    </Card>
  );
}