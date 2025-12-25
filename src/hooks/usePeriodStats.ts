import { useMemo, useState } from "react";
import {
  startOfMonth,
  startOfYear,
  subWeeks,
  subMonths,
  subYears,
  isWithinInterval,
  getHours,
} from "date-fns";
import type { PeriodOption, ComparisonOption } from "@/components/PeriodPicker";

interface Activity {
  id: string;
  activity_date: string;
}

interface PeriodBounds {
  start: Date;
  end: Date;
}

function getPeriodBounds(period: PeriodOption, referenceDate: Date = new Date()): PeriodBounds {
  const now = referenceDate;
  
  switch (period) {
    case "this-month":
      return { start: startOfMonth(now), end: now };
    case "last-8-weeks":
      return { start: subWeeks(now, 8), end: now };
    case "this-year":
      return { start: startOfYear(now), end: now };
    case "all-time":
      return { start: new Date(0), end: now };
  }
}

function getComparisonBounds(
  period: PeriodOption,
  comparison: ComparisonOption,
  allActivities: Activity[]
): PeriodBounds {
  const now = new Date();
  
  if (comparison === "all-time-average") {
    // Return full history for averaging
    return { start: new Date(0), end: now };
  }
  
  if (comparison === "same-period-last-year") {
    const lastYearNow = subYears(now, 1);
    return getPeriodBounds(period, lastYearNow);
  }
  
  // Previous period
  switch (period) {
    case "this-month":
      return { start: subMonths(startOfMonth(now), 1), end: startOfMonth(now) };
    case "last-8-weeks":
      return { start: subWeeks(now, 16), end: subWeeks(now, 8) };
    case "this-year":
      return { start: subYears(startOfYear(now), 1), end: startOfYear(now) };
    case "all-time":
      // No meaningful "previous" for all-time
      return { start: new Date(0), end: now };
  }
}

function filterActivities(activities: Activity[], bounds: PeriodBounds): Activity[] {
  return activities.filter((a) =>
    isWithinInterval(new Date(a.activity_date), { start: bounds.start, end: bounds.end })
  );
}

function calculateTimeOfDay(activities: Activity[]) {
  const stats = {
    nightOwl: 0,
    earlyBird: 0,
    lazyMorning: 0,
    nooner: 0,
    afternoon: 0,
    evening: 0,
  };

  activities.forEach((activity) => {
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
}

function calculateBunnyDays(activities: Activity[]) {
  const dayActivityCounts = new Map<string, number>();

  activities.forEach((activity) => {
    const dayKey = new Date(activity.activity_date).toISOString().split('T')[0];
    dayActivityCounts.set(dayKey, (dayActivityCounts.get(dayKey) || 0) + 1);
  });

  let doubleDays = 0;
  let tripleDays = 0;

  dayActivityCounts.forEach((count) => {
    if (count === 2) doubleDays++;
    else if (count >= 3) tripleDays++;
  });

  return { doubleDays, tripleDays };
}

export type TimeOfDayStats = ReturnType<typeof calculateTimeOfDay>;
export type BunnyDaysStats = ReturnType<typeof calculateBunnyDays>;

export interface PeriodStatsResult {
  period: PeriodOption;
  comparison: ComparisonOption;
  setPeriod: (p: PeriodOption) => void;
  setComparison: (c: ComparisonOption) => void;
  
  // Current period stats
  timeOfDay: TimeOfDayStats;
  bunnyDays: BunnyDaysStats;
  
  // Comparison stats
  comparisonTimeOfDay: TimeOfDayStats;
  comparisonBunnyDays: BunnyDaysStats;
  
  // Deltas
  bunnyDaysDelta: { doubleDays: number; tripleDays: number };
  dominantTimeOfDay: string | null;
  dominantTimeOfDayDelta: { label: string; diff: number; pct: number } | null;
}

const timeOfDayLabels: Record<keyof TimeOfDayStats, string> = {
  nightOwl: "Night Owl",
  earlyBird: "Early Bird",
  lazyMorning: "Lazy Morning",
  nooner: "Nooner",
  afternoon: "Afternoon Delight",
  evening: "Evening Bliss",
};

export function usePeriodStats(activities: Activity[]): PeriodStatsResult {
  const [period, setPeriod] = useState<PeriodOption>("last-8-weeks");
  const [comparison, setComparison] = useState<ComparisonOption>("previous-period");

  const result = useMemo(() => {
    const currentBounds = getPeriodBounds(period);
    const comparisonBounds = getComparisonBounds(period, comparison, activities);

    const currentActivities = filterActivities(activities, currentBounds);
    const comparisonActivities = filterActivities(activities, comparisonBounds);

    const timeOfDay = calculateTimeOfDay(currentActivities);
    const bunnyDays = calculateBunnyDays(currentActivities);
    
    const comparisonTimeOfDay = calculateTimeOfDay(comparisonActivities);
    const comparisonBunnyDays = calculateBunnyDays(comparisonActivities);

    // Calculate deltas
    const bunnyDaysDelta = {
      doubleDays: bunnyDays.doubleDays - comparisonBunnyDays.doubleDays,
      tripleDays: bunnyDays.tripleDays - comparisonBunnyDays.tripleDays,
    };

    // Find dominant time of day
    const todEntries = Object.entries(timeOfDay) as [keyof TimeOfDayStats, number][];
    const sortedTod = todEntries.sort((a, b) => b[1] - a[1]);
    const dominant = sortedTod[0];
    const dominantTimeOfDay = dominant[1] > 0 ? timeOfDayLabels[dominant[0]] : null;

    // Calculate dominant ToD delta
    let dominantTimeOfDayDelta: { label: string; diff: number; pct: number } | null = null;
    if (dominant[1] > 0 && dominantTimeOfDay) {
      const compValue = comparisonTimeOfDay[dominant[0]];
      const diff = dominant[1] - compValue;
      const pct = compValue > 0 ? Math.round((diff / compValue) * 100) : 0;
      if (diff !== 0) {
        dominantTimeOfDayDelta = { label: dominantTimeOfDay, diff, pct };
      }
    }

    return {
      timeOfDay,
      bunnyDays,
      comparisonTimeOfDay,
      comparisonBunnyDays,
      bunnyDaysDelta,
      dominantTimeOfDay,
      dominantTimeOfDayDelta,
    };
  }, [activities, period, comparison]);

  return {
    period,
    comparison,
    setPeriod,
    setComparison,
    ...result,
  };
}

export function getDeltaMessage(
  label: string,
  diff: number,
  isCount: boolean = false
): string {
  if (diff === 0) return "";
  
  const direction = diff > 0 ? "More" : "Fewer";
  const value = isCount ? `${diff > 0 ? "+" : ""}${diff}` : `${diff > 0 ? "+" : ""}${diff}%`;
  
  return `${direction} ${label} than last period (${value})`;
}
