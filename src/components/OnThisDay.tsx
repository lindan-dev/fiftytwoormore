import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { format, getMonth, getDate, getYear } from "date-fns";

interface Activity {
  id: string;
  activity_date: string;
  emoji?: string;
  notes?: string;
}

interface OnThisDayProps {
  activities: Activity[];
}

const nostalgicMessages = [
  "A spark from the past.",
  "You were here before.",
  "Some things stay warm.",
  "This day remembers you.",
];

export default function OnThisDay({ activities }: OnThisDayProps) {
  const memories = useMemo(() => {
    const today = new Date();
    const todayMonth = getMonth(today);
    const todayDate = getDate(today);
    const currentYear = getYear(today);

    // Group activities by year for this calendar date
    const byYear = new Map<number, Activity[]>();
    
    activities.forEach((activity) => {
      const activityDate = new Date(activity.activity_date);
      const activityMonth = getMonth(activityDate);
      const activityDay = getDate(activityDate);
      const activityYear = getYear(activityDate);

      // Same month and day, but not current year
      if (activityMonth === todayMonth && activityDay === todayDate && activityYear !== currentYear) {
        if (!byYear.has(activityYear)) {
          byYear.set(activityYear, []);
        }
        byYear.get(activityYear)!.push(activity);
      }
    });

    // Sort by year descending and take up to 2
    const sortedYears = Array.from(byYear.entries())
      .sort((a, b) => b[0] - a[0])
      .slice(0, 2);

    return sortedYears;
  }, [activities]);

  const randomMessage = useMemo(() => {
    return nostalgicMessages[Math.floor(Math.random() * nostalgicMessages.length)];
  }, []);

  if (memories.length === 0) {
    return (
      <Card className="border-2 border-dashed border-muted-foreground/20 bg-muted/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2 text-muted-foreground">
            <Sparkles className="w-4 h-4" />
            On this day
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-sm text-muted-foreground italic">
            No memories here yet. Everything starts somewhere.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          On this day
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {memories.map(([year, yearActivities]) => (
          <div key={year} className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground min-w-[3rem]">
              {year}
            </span>
            <div className="flex items-center gap-1">
              {yearActivities.slice(0, 5).map((activity, idx) => (
                <span key={activity.id} className="text-xl" title={activity.notes || undefined}>
                  {activity.emoji || "✨"}
                </span>
              ))}
              {yearActivities.length > 5 && (
                <span className="text-xs text-muted-foreground ml-1">
                  +{yearActivities.length - 5}
                </span>
              )}
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground italic mt-2">{randomMessage}</p>
      </CardContent>
    </Card>
  );
}
