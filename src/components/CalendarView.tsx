import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  onDayClick?: (date: Date, activities: Activity[]) => void;
}

export default function CalendarView({ activities, onDayClick }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

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
    if (onDayClick && dayActivities.length > 0) {
      onDayClick(day, dayActivities);
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
                  {/* White circle background */}
                  <div className="absolute inset-1 sm:inset-2 bg-white rounded-full shadow-sm" />
                  
                  {/* Emoji */}
                  <span className="relative text-xl sm:text-2xl z-10">
                    {firstEmoji}
                  </span>
                  
                  {/* Multiple activities indicator dot */}
                  {hasMultiple && (
                    <div className="absolute top-1 right-1 sm:top-2 sm:right-2 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-white rounded-full border-2 border-background z-20" />
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
    </Card>
  );
}