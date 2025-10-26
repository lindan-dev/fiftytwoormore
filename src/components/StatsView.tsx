import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Flame, Calendar, Zap, Moon, Sunrise, Coffee, Sun, Sunset, Stars } from "lucide-react";
import {
  startOfWeek,
  startOfMonth,
  startOfYear,
  subWeeks,
  subMonths,
  subYears,
  isWithinInterval,
  startOfDay,
  differenceInDays,
  isSameDay,
  format,
  endOfWeek,
  getHours,
} from "date-fns";

interface Activity {
  id: string;
  activity_date: string;
}

interface StatsViewProps {
  activities: Activity[];
  compact?: boolean;
}

type Period = "week" | "month" | "year";

export default function StatsView({ activities, compact = false }: StatsViewProps) {
  const calculateStreaks = useMemo(() => {
    if (activities.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const sortedActivities = [...activities].sort((a, b) => 
      new Date(a.activity_date).getTime() - new Date(b.activity_date).getTime()
    );

    const uniqueDays = Array.from(
      new Set(sortedActivities.map(a => startOfDay(new Date(a.activity_date)).getTime()))
    ).map(time => new Date(time));

    let longestStreak = 1;
    let currentStreakCount = 1;

    for (let i = 1; i < uniqueDays.length; i++) {
      const daysDiff = differenceInDays(uniqueDays[i], uniqueDays[i - 1]);
      
      if (daysDiff === 1) {
        currentStreakCount++;
        longestStreak = Math.max(longestStreak, currentStreakCount);
      } else {
        currentStreakCount = 1;
      }
    }

    // Calculate current streak from today
    const today = startOfDay(new Date());
    let currentStreak = 0;
    
    for (let i = uniqueDays.length - 1; i >= 0; i--) {
      const daysDiff = differenceInDays(today, uniqueDays[i]);
      
      if (daysDiff === currentStreak) {
        currentStreak++;
      } else {
        break;
      }
    }

    return { currentStreak, longestStreak };
  }, [activities]);

  const calculateMultipleDays = useMemo(() => {
    const dayActivityCounts = new Map<string, number>();

    activities.forEach(activity => {
      const dayKey = startOfDay(new Date(activity.activity_date)).toISOString();
      dayActivityCounts.set(dayKey, (dayActivityCounts.get(dayKey) || 0) + 1);
    });

    let doubleDays = 0;
    let tripleDays = 0;

    dayActivityCounts.forEach(count => {
      if (count === 2) doubleDays++;
      else if (count >= 3) tripleDays++;
    });

    return { doubleDays, tripleDays };
  }, [activities]);

  const calculateStats = (period: Period) => {
    const now = new Date();
    let currentStart: Date;
    let previousStart: Date;
    let previousEnd: Date;

    switch (period) {
      case "week":
        currentStart = startOfWeek(now, { weekStartsOn: 1 });
        previousStart = subWeeks(currentStart, 1);
        previousEnd = currentStart;
        break;
      case "month":
        currentStart = startOfMonth(now);
        previousStart = subMonths(currentStart, 1);
        previousEnd = currentStart;
        break;
      case "year":
        currentStart = startOfYear(now);
        previousStart = subYears(currentStart, 1);
        previousEnd = currentStart;
        break;
    }

    const currentCount = activities.filter((activity) =>
      isWithinInterval(new Date(activity.activity_date), { start: currentStart, end: now })
    ).length;

    const previousCount = activities.filter((activity) =>
      isWithinInterval(new Date(activity.activity_date), { start: previousStart, end: previousEnd })
    ).length;

    const difference = currentCount - previousCount;
    const percentChange = previousCount === 0 ? "0" : ((difference / previousCount) * 100).toFixed(1);

    return {
      currentCount,
      previousCount,
      difference,
      percentChange,
    };
  };

  const weekStats = useMemo(() => calculateStats("week"), [activities]);
  const monthStats = useMemo(() => calculateStats("month"), [activities]);
  const yearStats = useMemo(() => calculateStats("year"), [activities]);

  const bestMonth = useMemo(() => {
    if (activities.length === 0) return null;

    const monthCounts = new Map<string, { count: number; month: string; year: number }>();

    activities.forEach(activity => {
      const date = new Date(activity.activity_date);
      const monthKey = format(date, 'yyyy-MM');
      const month = format(date, 'MMMM');
      const year = date.getFullYear();

      if (!monthCounts.has(monthKey)) {
        monthCounts.set(monthKey, { count: 0, month, year });
      }
      const entry = monthCounts.get(monthKey)!;
      entry.count++;
    });

    let best = { count: 0, month: '', year: 0 };
    monthCounts.forEach(entry => {
      if (entry.count > best.count) {
        best = entry;
      }
    });

    return best.count > 0 ? best : null;
  }, [activities]);

  const bestWeek = useMemo(() => {
    if (activities.length === 0) return null;

    const weekCounts = new Map<string, { count: number; weekStart: Date; weekEnd: Date }>();

    activities.forEach(activity => {
      const date = new Date(activity.activity_date);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');

      if (!weekCounts.has(weekKey)) {
        weekCounts.set(weekKey, { count: 0, weekStart, weekEnd });
      }
      const entry = weekCounts.get(weekKey)!;
      entry.count++;
    });

    let best = { count: 0, weekStart: new Date(), weekEnd: new Date() };
    weekCounts.forEach(entry => {
      if (entry.count > best.count) {
        best = entry;
      }
    });

    return best.count > 0 ? best : null;
  }, [activities]);

  const bestYear = useMemo(() => {
    if (activities.length === 0) return null;

    const yearCounts = new Map<number, number>();

    activities.forEach(activity => {
      const year = new Date(activity.activity_date).getFullYear();
      yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    });

    let best = { count: 0, year: 0 };
    yearCounts.forEach((count, year) => {
      if (count > best.count) {
        best = { count, year };
      }
    });

    return best.count > 0 ? best : null;
  }, [activities]);

  const timeOfDayStats = useMemo(() => {
    const stats = {
      nightOwl: 0,      // 10pm - 4am (22-4)
      earlyBird: 0,     // 4am - 8am
      lazyMorning: 0,   // 8am - 12pm
      nooner: 0,        // 12pm - 3pm
      afternoon: 0,     // 3pm - 6pm (15-18)
      evening: 0,       // 6pm - 10pm (18-22)
    };

    activities.forEach(activity => {
      const hour = getHours(new Date(activity.activity_date));

      if (hour >= 22 || hour < 4) {
        stats.nightOwl++;
      } else if (hour >= 4 && hour < 8) {
        stats.earlyBird++;
      } else if (hour >= 8 && hour < 12) {
        stats.lazyMorning++;
      } else if (hour >= 12 && hour < 15) {
        stats.nooner++;
      } else if (hour >= 15 && hour < 18) {
        stats.afternoon++;
      } else if (hour >= 18 && hour < 22) {
        stats.evening++;
      }
    });

    return stats;
  }, [activities]);

  const StatCard = ({
    title,
    current,
    difference,
    percentChange,
  }: {
    title: string;
    current: number;
    difference: number;
    percentChange: string;
  }) => {
    const getTrendIcon = () => {
      if (difference > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
      if (difference < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
      return <Minus className="w-4 h-4 text-muted-foreground" />;
    };

    const getTrendColor = () => {
      if (difference > 0) return "text-green-500";
      if (difference < 0) return "text-red-500";
      return "text-muted-foreground";
    };

    return (
      <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-soft">
        <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
          <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 sm:space-y-2 p-3 pt-0 sm:p-6 sm:pt-0">
          <div className="text-3xl sm:text-4xl font-bold text-primary">
            {current}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-wrap">
            {getTrendIcon()}
            <span className={getTrendColor()}>
              {difference > 0 ? "+" : ""}
              {difference} ({percentChange}%)
            </span>
            <span className="text-muted-foreground whitespace-nowrap">vs previous</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  const SimpleStatCard = ({
    icon: Icon,
    title,
    value,
    color = "text-primary",
  }: {
    icon: any;
    title: string;
    value: number;
    color?: string;
  }) => (
    <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-soft">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1 truncate">{title}</p>
            <p className={`text-2xl sm:text-3xl font-bold ${color}`}>{value}</p>
          </div>
          <Icon className={`w-6 h-6 sm:w-8 sm:h-8 ${color} flex-shrink-0`} />
        </div>
      </CardContent>
    </Card>
  );

  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <SimpleStatCard
          icon={Flame}
          title="Current Streak"
          value={calculateStreaks.currentStreak}
          color="text-orange-500"
        />
        <SimpleStatCard
          icon={Calendar}
          title="Longest Streak"
          value={calculateStreaks.longestStreak}
          color="text-primary"
        />
        <SimpleStatCard
          icon={Zap}
          title="Double Days"
          value={calculateMultipleDays.doubleDays}
          color="text-blue-500"
        />
        <SimpleStatCard
          icon={Zap}
          title="Triple Days"
          value={calculateMultipleDays.tripleDays}
          color="text-purple-500"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <h2 className="text-xl sm:text-2xl font-bold">Statistics</h2>
      
      {/* Period-based Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          title="This Week"
          current={weekStats.currentCount}
          difference={weekStats.difference}
          percentChange={weekStats.percentChange}
        />
        <StatCard
          title="This Month"
          current={monthStats.currentCount}
          difference={monthStats.difference}
          percentChange={monthStats.percentChange}
        />
        <StatCard
          title="This Year"
          current={yearStats.currentCount}
          difference={yearStats.difference}
          percentChange={yearStats.percentChange}
        />
      </div>

      {/* Best Period Stats */}
      {(bestMonth || bestWeek || bestYear) && (
        <>
          <h3 className="text-lg sm:text-xl font-semibold mt-4">Best Periods</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {bestYear && (
              <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-soft">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1 truncate">Best Year</p>
                      <p className="text-sm sm:text-base font-bold text-primary truncate">
                        {bestYear.year}
                      </p>
                      <p className="text-sm sm:text-base text-muted-foreground mt-0.5">
                        {bestYear.count} {bestYear.count === 1 ? 'activity' : 'activities'}
                      </p>
                    </div>
                    <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            )}
            {bestMonth && (
              <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-soft">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1 truncate">Best Month</p>
                      <p className="text-sm sm:text-base font-bold text-primary truncate">
                        {bestMonth.month} {bestMonth.year}
                      </p>
                      <p className="text-sm sm:text-base text-muted-foreground mt-0.5">
                        {bestMonth.count} {bestMonth.count === 1 ? 'activity' : 'activities'}
                      </p>
                    </div>
                    <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-primary flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            )}
            {bestWeek && (
              <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-soft">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1 truncate">Best Week</p>
                      <p className="text-sm sm:text-base font-bold text-primary">
                        {format(bestWeek.weekStart, 'MMM d')} - {format(bestWeek.weekEnd, 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm sm:text-base text-muted-foreground mt-0.5">
                        {bestWeek.count} {bestWeek.count === 1 ? 'activity' : 'activities'}
                      </p>
                    </div>
                    <Flame className="w-8 h-8 sm:w-10 sm:h-10 text-orange-500 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Time of Day Stats */}
      <h3 className="text-lg sm:text-xl font-semibold mt-4">Time of Day</h3>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <SimpleStatCard
          icon={Sunrise}
          title="Early Bird"
          value={timeOfDayStats.earlyBird}
          color="text-amber-500"
        />
        <SimpleStatCard
          icon={Coffee}
          title="Lazy Morning"
          value={timeOfDayStats.lazyMorning}
          color="text-brown-500"
        />
        <SimpleStatCard
          icon={Sun}
          title="Nooner"
          value={timeOfDayStats.nooner}
          color="text-yellow-500"
        />
        <SimpleStatCard
          icon={Sunset}
          title="Afternoon Delight"
          value={timeOfDayStats.afternoon}
          color="text-orange-400"
        />
        <SimpleStatCard
          icon={Stars}
          title="Evening Bliss"
          value={timeOfDayStats.evening}
          color="text-purple-500"
        />
        <SimpleStatCard
          icon={Moon}
          title="Night Owl"
          value={timeOfDayStats.nightOwl}
          color="text-indigo-500"
        />
      </div>
    </div>
  );
}
