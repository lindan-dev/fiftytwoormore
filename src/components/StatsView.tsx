import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  startOfWeek,
  startOfMonth,
  startOfYear,
  subWeeks,
  subMonths,
  subYears,
  isWithinInterval,
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

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Statistics</h2>
      <div className="grid gap-4">
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
