/**
 * Shared statistics calculation functions for use across all Edge Functions.
 * 
 * CRITICAL: All calculations are timezone-aware. Activity dates must be 
 * converted to the user's local timezone before determining which week/day 
 * they belong to.
 */

/**
 * Get the current local date/time in a specific timezone.
 * Returns a Date object representing the local time (but stored as local values).
 */
export function getLocalDate(timezone: string): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '2024');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  
  return new Date(year, month, day, hour, minute);
}

/**
 * Convert a UTC date to the user's local timezone.
 * This is CRITICAL for determining which week/day an activity belongs to.
 */
export function toLocalDate(utcDate: Date | string, timezone: string): Date {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '2024');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  
  return new Date(year, month, day, hour, minute);
}

/**
 * Get ISO week number (1-53) from a Date.
 * Week 1 is the week containing the first Thursday of the year.
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Get the Monday of the current week in the user's timezone.
 */
export function getMondayOfWeek(timezone: string): Date {
  const local = getLocalDate(timezone);
  const day = local.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(local);
  monday.setDate(local.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Get the Monday of a specific week for a given date (in local timezone).
 */
export function getMondayOfWeekForDate(localDate: Date): Date {
  const day = localDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(localDate);
  monday.setDate(localDate.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

interface Activity {
  activity_date: string;
  [key: string]: any;
}

/**
 * Count activities within the current week (Monday 00:00 to now) in user's timezone.
 * 
 * IMPORTANT: This compares the local date of each activity to the local week boundaries.
 */
export function countLogsThisWeek(activities: Activity[], timezone: string): number {
  const monday = getMondayOfWeek(timezone);
  const localNow = getLocalDate(timezone);
  
  return activities.filter(activity => {
    const activityLocal = toLocalDate(activity.activity_date, timezone);
    return activityLocal >= monday && activityLocal <= localNow;
  }).length;
}

/**
 * Count activities within the previous week (Monday to Sunday) in user's timezone.
 */
export function countLogsPreviousWeek(activities: Activity[], timezone: string): number {
  const monday = getMondayOfWeek(timezone);
  const previousMonday = new Date(monday);
  previousMonday.setDate(monday.getDate() - 7);
  
  return activities.filter(activity => {
    const activityLocal = toLocalDate(activity.activity_date, timezone);
    return activityLocal >= previousMonday && activityLocal < monday;
  }).length;
}

/**
 * Get year-to-date total in user's timezone.
 */
export function countYearTotal(activities: Activity[], timezone: string): number {
  const localNow = getLocalDate(timezone);
  const yearStart = new Date(localNow.getFullYear(), 0, 1, 0, 0, 0, 0);
  
  return activities.filter(activity => {
    const activityLocal = toLocalDate(activity.activity_date, timezone);
    return activityLocal >= yearStart && activityLocal <= localNow;
  }).length;
}

/**
 * Calculate the current streak (consecutive weeks with at least one activity).
 * 
 * The streak uses ISO weeks (Monday-Sunday). If the current week has no activity yet,
 * it's considered "in progress" and doesn't break the streak.
 * 
 * TIMEZONE-AWARE: Activities are converted to local time to determine which week
 * they belong to before counting.
 */
export function calculateStreakWeeks(activities: Activity[], timezone: string): number {
  if (activities.length === 0) return 0;
  
  const localNow = getLocalDate(timezone);
  
  // Convert all activity dates to local timezone and group by ISO week
  const weekSet = new Set<string>();
  activities.forEach(activity => {
    const localDate = toLocalDate(activity.activity_date, timezone);
    const year = localDate.getFullYear();
    const week = getWeekNumber(localDate);
    weekSet.add(`${year}-W${week.toString().padStart(2, '0')}`);
  });
  
  let checkYear = localNow.getFullYear();
  let checkWeek = getWeekNumber(localNow);
  let streak = 0;
  
  // Check if current week has activity - if so, count it
  const currentWeekKey = `${checkYear}-W${checkWeek.toString().padStart(2, '0')}`;
  if (weekSet.has(currentWeekKey)) {
    streak = 1;
  }
  
  // Move to previous week to start counting backwards
  checkWeek--;
  if (checkWeek < 1) {
    checkYear--;
    // Get the last week number of the previous year
    checkWeek = getWeekNumber(new Date(checkYear, 11, 28));
  }
  
  // Count consecutive weeks backwards from previous week
  for (let i = 0; i < 104; i++) { // Check up to 2 years back
    const weekKey = `${checkYear}-W${checkWeek.toString().padStart(2, '0')}`;
    if (weekSet.has(weekKey)) {
      streak++;
    } else {
      break;
    }
    
    // Move to previous week
    checkWeek--;
    if (checkWeek < 1) {
      checkYear--;
      checkWeek = getWeekNumber(new Date(checkYear, 11, 28));
    }
  }
  
  return streak;
}

/**
 * Get a human-readable relative time for the last log.
 */
export function getLastLogRelative(activities: Activity[], timezone: string): string {
  if (activities.length === 0) return "None yet";
  
  // Find most recent activity
  const sorted = [...activities].sort((a, b) => 
    new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime()
  );
  
  const lastActivity = sorted[0];
  const lastLogLocal = toLocalDate(lastActivity.activity_date, timezone);
  const localNow = getLocalDate(timezone);
  
  // Check if same ISO week
  const lastLogWeek = getWeekNumber(lastLogLocal);
  const lastLogYear = lastLogLocal.getFullYear();
  const currentWeek = getWeekNumber(localNow);
  const currentYear = localNow.getFullYear();
  
  const diffMs = localNow.getTime() - lastLogLocal.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 24) return "Last night";
  
  // Check if same ISO week (Monday-Sunday)
  if (lastLogYear === currentYear && lastLogWeek === currentWeek) {
    return "Earlier this week";
  }
  
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 14) return "Last week";
  return `${diffDays} days ago`;
}

/**
 * Calculate consistency score (0-100) based on last 8 weeks.
 * +12 points per week with at least one log
 * +2 bonus points per week with 2+ logs
 * Capped at 100
 */
export function calculateConsistencyScore(activities: Activity[], timezone: string): number {
  const localNow = getLocalDate(timezone);
  const currentWeek = getWeekNumber(localNow);
  const currentYear = localNow.getFullYear();
  
  // Group activities by week (last 8 weeks)
  const weekCounts = new Map<string, number>();
  
  activities.forEach(activity => {
    const localDate = toLocalDate(activity.activity_date, timezone);
    const year = localDate.getFullYear();
    const week = getWeekNumber(localDate);
    const weekKey = `${year}-W${week.toString().padStart(2, '0')}`;
    weekCounts.set(weekKey, (weekCounts.get(weekKey) || 0) + 1);
  });
  
  // Check last 8 weeks
  let score = 0;
  let checkYear = currentYear;
  let checkWeek = currentWeek;
  
  for (let i = 0; i < 8; i++) {
    const weekKey = `${checkYear}-W${checkWeek.toString().padStart(2, '0')}`;
    const count = weekCounts.get(weekKey) || 0;
    
    if (count >= 1) score += 12;
    if (count >= 2) score += 2;
    
    // Move to previous week
    checkWeek--;
    if (checkWeek < 1) {
      checkYear--;
      checkWeek = getWeekNumber(new Date(checkYear, 11, 28));
    }
  }
  
  return Math.min(score, 100);
}

/**
 * Get activities for a specific year in user's timezone.
 */
export function getActivitiesForYear(activities: Activity[], year: number, timezone: string): Activity[] {
  const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  
  return activities.filter(activity => {
    const localDate = toLocalDate(activity.activity_date, timezone);
    return localDate >= yearStart && localDate <= yearEnd;
  });
}
