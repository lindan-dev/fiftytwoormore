import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Flame, Calendar, Rabbit, Moon, Sunrise, Coffee, Sun, Sunset, Stars, Activity, Shield, AlertTriangle, CheckCircle, Users, ArrowUp, ArrowDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import PeriodPicker from "@/components/PeriodPicker";
import { usePeriodStats, getDeltaMessage } from "@/hooks/usePeriodStats";
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
  format,
  endOfWeek,
  getHours,
  getDay,
} from "date-fns";

interface Activity {
  id: string;
  activity_date: string;
}

interface BenchmarkCohort {
  cohort_key: string;
  period: string;
  period_type: string;
  couple_count: number | null;
  median_monthly_count: number | null;
  median_rolling_4_weeks: number | null;
  median_consistency_score: number | null;
  median_streak_length: number | null;
  p25_monthly_count: number | null;
  p75_monthly_count: number | null;
}

interface StatsViewProps {
  activities: Activity[];
  compact?: boolean;
  benchmarkOptIn?: boolean;
  anniversary?: string | null;
  cohortData?: BenchmarkCohort | null;
}

type Period = "week" | "month" | "year";

export default function StatsView({ 
  activities, 
  compact = false,
  benchmarkOptIn = false,
  anniversary = null,
  cohortData = null
}: StatsViewProps) {
  // Period stats hook for Bunny Days and Time of Day
  const periodStats = usePeriodStats(activities);

  const calculateStreaks = useMemo(() => {
    if (activities.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const sortedActivities = [...activities].sort((a, b) => 
      new Date(a.activity_date).getTime() - new Date(b.activity_date).getTime()
    );

    // Group activities by week (Monday-Sunday)
    const uniqueWeeks = Array.from(
      new Set(sortedActivities.map(a => {
        const weekStart = startOfWeek(new Date(a.activity_date), { weekStartsOn: 1 });
        return weekStart.getTime();
      }))
    ).map(time => new Date(time)).sort((a, b) => a.getTime() - b.getTime());

    if (uniqueWeeks.length === 0) return { currentStreak: 0, longestStreak: 0 };

    // Calculate longest streak - consecutive weeks
    let longestStreak = 1;
    let currentStreakCount = 1;

    for (let i = 1; i < uniqueWeeks.length; i++) {
      const weeksDiff = Math.round(differenceInDays(uniqueWeeks[i], uniqueWeeks[i - 1]) / 7);
      
      if (weeksDiff === 1) {
        currentStreakCount++;
        longestStreak = Math.max(longestStreak, currentStreakCount);
      } else {
        currentStreakCount = 1;
      }
    }

    // Calculate current streak from this week
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    let currentStreak = 0;

    const lastActivityWeek = uniqueWeeks[uniqueWeeks.length - 1];
    const weeksFromLastActivity = Math.round(differenceInDays(currentWeekStart, lastActivityWeek) / 7);

    if (weeksFromLastActivity <= 1) {
      currentStreak = 1;
      
      for (let i = uniqueWeeks.length - 2; i >= 0; i--) {
        const weeksDiff = Math.round(differenceInDays(uniqueWeeks[i + 1], uniqueWeeks[i]) / 7);
        
        if (weeksDiff === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    return { currentStreak, longestStreak };
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

  // Rolling 4 weeks count
  const rolling4WeeksCount = useMemo(() => {
    const now = new Date();
    const fourWeeksAgo = subWeeks(now, 4);
    return activities.filter(a => 
      new Date(a.activity_date) >= fourWeeksAgo
    ).length;
  }, [activities]);

  // Consistency score (0-100)
  const consistencyScore = useMemo(() => {
    const now = new Date();
    const weekCounts = new Map<string, number>();
    
    for (let i = 0; i < 8; i++) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      weekCounts.set(weekKey, 0);
    }
    
    activities.forEach(a => {
      const activityDate = new Date(a.activity_date);
      const weekStart = startOfWeek(activityDate, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      if (weekCounts.has(weekKey)) {
        weekCounts.set(weekKey, (weekCounts.get(weekKey) || 0) + 1);
      }
    });
    
    let score = 0;
    weekCounts.forEach(count => {
      if (count >= 1) score += 12;
      if (count >= 2) score += 2;
    });
    
    return Math.min(score, 100);
  }, [activities]);

  // Streak health: 'safe' | 'watch' | 'atRisk'
  const streakHealth = useMemo(() => {
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const dayOfWeek = getDay(now);
    
    const hasLoggedThisWeek = activities.some(a => {
      const activityDate = new Date(a.activity_date);
      return activityDate >= currentWeekStart;
    });
    
    if (hasLoggedThisWeek) {
      return 'safe' as const;
    }
    
    if (dayOfWeek === 0) {
      return 'atRisk' as const;
    }
    
    if (dayOfWeek >= 4) {
      return 'watch' as const;
    }
    
    return 'safe' as const;
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
    difference,
    comparisonValue,
  }: {
    icon: any;
    title: string;
    value: number;
    color?: string;
    difference?: number;
    comparisonValue?: number;
  }) => {
    const getTrendIcon = () => {
      if (difference === undefined) return null;
      if (difference > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
      if (difference < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
      return <Minus className="w-4 h-4 text-muted-foreground" />;
    };

    const getTrendColor = () => {
      if (difference === undefined) return "text-muted-foreground";
      if (difference > 0) return "text-green-500";
      if (difference < 0) return "text-red-500";
      return "text-muted-foreground";
    };

    const percentChange = comparisonValue === 0 ? "0" : ((difference ?? 0) / (comparisonValue ?? 1) * 100).toFixed(1);

    return (
      <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-soft">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1 truncate">{title}</p>
              <p className={`text-2xl sm:text-3xl font-bold ${color}`}>{value}</p>
              {difference !== undefined && (
                <div className="flex items-center gap-1.5 text-xs mt-1 flex-wrap">
                  {getTrendIcon()}
                  <span className={getTrendColor()}>
                    {difference > 0 ? "+" : ""}
                    {difference} ({percentChange}%)
                  </span>
                  <span className="text-muted-foreground whitespace-nowrap">vs previous</span>
                </div>
              )}
            </div>
            <Icon className={`w-6 h-6 sm:w-8 sm:h-8 ${color} flex-shrink-0`} />
          </div>
        </CardContent>
      </Card>
    );
  };

  // Get comparison values for time of day
  const getTimeOfDayComparison = (key: keyof typeof periodStats.timeOfDay) => {
    const current = periodStats.timeOfDay[key];
    const comparison = periodStats.comparisonTimeOfDay[key];
    return { current, comparison, difference: current - comparison };
  };

  // Get comparison values for bunny days
  const getBunnyComparison = (type: "doubleDays" | "tripleDays") => {
    const current = periodStats.bunnyDays[type];
    const comparison = periodStats.comparisonBunnyDays[type];
    return { current, comparison, difference: current - comparison };
  };

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
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <h2 className="text-xl sm:text-2xl font-bold">Statistics</h2>
      
      {/* Period-based Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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

      {/* Consistency Section - MOVED BEFORE Best Periods */}
      <h3 className="text-lg sm:text-xl font-semibold mt-4">Consistency</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Consistency Score */}
        <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-soft">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Consistency Score</p>
                <p className="text-3xl sm:text-4xl font-bold text-primary">{consistencyScore}</p>
              </div>
              <Activity className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
            </div>
            <Progress value={consistencyScore} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Based on your last 8 weeks of activity
            </p>
          </CardContent>
        </Card>

        {/* Streak Health */}
        <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-soft">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Streak Health</p>
                <div className="flex items-center gap-2 mt-2">
                  {streakHealth === 'safe' && (
                    <>
                      <CheckCircle className="w-6 h-6 text-green-500" />
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                        Safe
                      </Badge>
                    </>
                  )}
                  {streakHealth === 'watch' && (
                    <>
                      <AlertTriangle className="w-6 h-6 text-amber-500" />
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                        Watch
                      </Badge>
                    </>
                  )}
                  {streakHealth === 'atRisk' && (
                    <>
                      <Shield className="w-6 h-6 text-red-500" />
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
                        At Risk
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl sm:text-3xl font-bold text-primary">{calculateStreaks.currentStreak}</p>
                <p className="text-xs text-muted-foreground">week streak</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {streakHealth === 'safe' && "You're on track this week!"}
              {streakHealth === 'watch' && "Weekend approaching — time to connect?"}
              {streakHealth === 'atRisk' && "Last chance to log before the week ends!"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Best Period Stats */}
      {(bestMonth || bestWeek || bestYear) && (
        <>
          <h3 className="text-lg sm:text-xl font-semibold mt-4">Best Periods</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {bestYear && (
              <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-soft">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1 truncate">Best Year</p>
                      <div className="min-h-[2.5rem] sm:min-h-[3rem]">
                        <p className="text-sm sm:text-base font-bold text-primary truncate">
                          {bestYear.year}
                        </p>
                      </div>
                      <p className="text-sm sm:text-base text-muted-foreground mt-0.5">
                        {bestYear.count} {bestYear.count === 1 ? 'activity' : 'activities'}
                      </p>
                    </div>
                    <Rabbit className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500 flex-shrink-0" />
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
                      <div className="min-h-[2.5rem] sm:min-h-[3rem]">
                        <p className="text-sm sm:text-base font-bold text-primary truncate">
                          {bestMonth.month}
                        </p>
                        <p className="text-sm sm:text-base font-bold text-primary">
                          {bestMonth.year}
                        </p>
                      </div>
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
                      <div className="min-h-[2.5rem] sm:min-h-[3rem]">
                        <p className="text-sm sm:text-base font-bold text-primary">
                          {format(bestWeek.weekStart, 'MMM d')} - {format(bestWeek.weekEnd, 'MMM d')}
                        </p>
                        <p className="text-sm sm:text-base font-bold text-primary">
                          {format(bestWeek.weekStart, 'yyyy')}
                        </p>
                      </div>
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

      {/* Even More Stats Section - Combined Bunny Days + Time of Day */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4">
        <h3 className="text-lg sm:text-xl font-semibold">Even more stats</h3>
        <PeriodPicker
          period={periodStats.period}
          comparison={periodStats.comparison}
          onPeriodChange={periodStats.setPeriod}
          onComparisonChange={periodStats.setComparison}
        />
      </div>
      
      {/* Bunny Days - Always visible */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <SimpleStatCard
          icon={Rabbit}
          title="Double Days"
          value={getBunnyComparison("doubleDays").current}
          color="text-blue-500"
          difference={getBunnyComparison("doubleDays").difference}
          comparisonValue={getBunnyComparison("doubleDays").comparison}
        />
        <SimpleStatCard
          icon={Rabbit}
          title="Triple Days"
          value={getBunnyComparison("tripleDays").current}
          color="text-purple-500"
          difference={getBunnyComparison("tripleDays").difference}
          comparisonValue={getBunnyComparison("tripleDays").comparison}
        />
      </div>

      {/* Time of Day - Always visible */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <SimpleStatCard
          icon={Sunrise}
          title="Early Bird"
          value={getTimeOfDayComparison("earlyBird").current}
          color="text-amber-500"
          difference={getTimeOfDayComparison("earlyBird").difference}
          comparisonValue={getTimeOfDayComparison("earlyBird").comparison}
        />
        <SimpleStatCard
          icon={Coffee}
          title="Lazy Morning"
          value={getTimeOfDayComparison("lazyMorning").current}
          color="text-brown-500"
          difference={getTimeOfDayComparison("lazyMorning").difference}
          comparisonValue={getTimeOfDayComparison("lazyMorning").comparison}
        />
        <SimpleStatCard
          icon={Sun}
          title="Nooner"
          value={getTimeOfDayComparison("nooner").current}
          color="text-yellow-500"
          difference={getTimeOfDayComparison("nooner").difference}
          comparisonValue={getTimeOfDayComparison("nooner").comparison}
        />
        <SimpleStatCard
          icon={Sunset}
          title="Afternoon Delight"
          value={getTimeOfDayComparison("afternoon").current}
          color="text-orange-400"
          difference={getTimeOfDayComparison("afternoon").difference}
          comparisonValue={getTimeOfDayComparison("afternoon").comparison}
        />
        <SimpleStatCard
          icon={Stars}
          title="Evening Bliss"
          value={getTimeOfDayComparison("evening").current}
          color="text-purple-500"
          difference={getTimeOfDayComparison("evening").difference}
          comparisonValue={getTimeOfDayComparison("evening").comparison}
        />
        <SimpleStatCard
          icon={Moon}
          title="Night Owl"
          value={getTimeOfDayComparison("nightOwl").current}
          color="text-indigo-500"
          difference={getTimeOfDayComparison("nightOwl").difference}
          comparisonValue={getTimeOfDayComparison("nightOwl").comparison}
        />
      </div>

      {/* Benchmarks Section - Only shown when opted in */}
      {benchmarkOptIn && (
        <>
          <h3 className="text-lg sm:text-xl font-semibold mt-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Benchmarks
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground -mt-2">
            {cohortData 
              ? `Comparing with couples together ${getCohortLabel(cohortData.cohort_key)}`
              : anniversary 
                ? `Comparing with similar couples`
                : `Set your anniversary in Profile to see cohort comparisons`
            }
          </p>
          
          {cohortData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Monthly Count Comparison */}
              <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-soft">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-1">This Month</p>
                      <p className="text-2xl sm:text-3xl font-bold text-primary">{monthStats.currentCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Cohort median</p>
                      <p className="text-lg font-semibold text-muted-foreground">
                        {cohortData.median_monthly_count?.toFixed(1) ?? '—'}
                      </p>
                    </div>
                  </div>
                  {cohortData.median_monthly_count && (
                    <div className="flex items-center gap-1 text-xs">
                      {monthStats.currentCount >= cohortData.median_monthly_count ? (
                        <>
                          <ArrowUp className="w-3 h-3 text-green-500" />
                          <span className="text-green-600">Above cohort median</span>
                        </>
                      ) : (
                        <>
                          <ArrowDown className="w-3 h-3 text-amber-500" />
                          <span className="text-amber-600">Slightly under cohort median</span>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Rolling 4 Weeks Comparison */}
              <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-soft">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-1">Last 4 Weeks</p>
                      <p className="text-2xl sm:text-3xl font-bold text-primary">{rolling4WeeksCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Cohort median</p>
                      <p className="text-lg font-semibold text-muted-foreground">
                        {cohortData.median_rolling_4_weeks?.toFixed(1) ?? '—'}
                      </p>
                    </div>
                  </div>
                  {cohortData.median_rolling_4_weeks && (
                    <div className="flex items-center gap-1 text-xs">
                      {rolling4WeeksCount >= cohortData.median_rolling_4_weeks ? (
                        <>
                          <ArrowUp className="w-3 h-3 text-green-500" />
                          <span className="text-green-600">Above cohort median</span>
                        </>
                      ) : (
                        <>
                          <ArrowDown className="w-3 h-3 text-amber-500" />
                          <span className="text-amber-600">Slightly under cohort median</span>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Consistency Score Comparison */}
              <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-soft">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-1">Consistency</p>
                      <p className="text-2xl sm:text-3xl font-bold text-primary">{consistencyScore}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Cohort median</p>
                      <p className="text-lg font-semibold text-muted-foreground">
                        {cohortData.median_consistency_score?.toFixed(0) ?? '—'}
                      </p>
                    </div>
                  </div>
                  {cohortData.median_consistency_score && (
                    <div className="flex items-center gap-1 text-xs">
                      {consistencyScore >= cohortData.median_consistency_score ? (
                        <>
                          <ArrowUp className="w-3 h-3 text-green-500" />
                          <span className="text-green-600">Above cohort median</span>
                        </>
                      ) : (
                        <>
                          <ArrowDown className="w-3 h-3 text-amber-500" />
                          <span className="text-amber-600">Slightly under cohort median</span>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Streak Comparison */}
              <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all hover:shadow-soft">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-1">Current Streak</p>
                      <p className="text-2xl sm:text-3xl font-bold text-primary">{calculateStreaks.currentStreak}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Cohort median</p>
                      <p className="text-lg font-semibold text-muted-foreground">
                        {cohortData.median_streak_length?.toFixed(1) ?? '—'}
                      </p>
                    </div>
                  </div>
                  {cohortData.median_streak_length && (
                    <div className="flex items-center gap-1 text-xs">
                      {calculateStreaks.currentStreak >= cohortData.median_streak_length ? (
                        <>
                          <ArrowUp className="w-3 h-3 text-green-500" />
                          <span className="text-green-600">Above cohort median</span>
                        </>
                      ) : (
                        <>
                          <ArrowDown className="w-3 h-3 text-amber-500" />
                          <span className="text-amber-600">Slightly under cohort median</span>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-2 border-primary/10">
              <CardContent className="p-4 sm:p-5 text-center">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {anniversary 
                    ? "Benchmark data will appear once computed. Check back soon!"
                    : "Set your anniversary date in Profile to see how you compare to similar couples."
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// Helper function to get human-readable cohort label
function getCohortLabel(cohortKey: string): string {
  const labels: Record<string, string> = {
    'rel_0-1': '0-1 years',
    'rel_1-3': '1-3 years',
    'rel_3-7': '3-7 years',
    'rel_7-15': '7-15 years',
    'rel_15+': '15+ years',
  };
  return labels[cohortKey] || cohortKey;
}
