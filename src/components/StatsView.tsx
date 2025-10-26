import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Flame, Calendar, Zap } from "lucide-react";
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
} from "date-fns";

interface Activity {
  id: string;
  activity_date: string;
}

interface StatsViewProps {
  activities: Activity[];
}

type Period = "week" | "month" | "year";

export default function StatsView({ activities }: StatsViewProps) {
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
      if (count >= 3) tripleDays++;
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
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-4xl font-bold text-primary">
            {current}
          </div>
          <div className="flex items-center gap-2 text-sm">
            {getTrendIcon()}
            <span className={getTrendColor()}>
              {difference > 0 ? "+" : ""}
              {difference} ({percentChange}%)
            </span>
            <span className="text-muted-foreground">vs previous</span>
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
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
          <Icon className={`w-8 h-8 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Statistics</h2>
      
      {/* Streak and Special Days Stats */}
      <div className="grid grid-cols-2 gap-3">
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

      {/* Period-based Stats */}
      <div className="grid gap-4 mt-6">
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
    </div>
  );
}
