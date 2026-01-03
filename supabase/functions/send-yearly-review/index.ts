import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Emoji label mapping (matches EmojiSelector.tsx)
const EMOJI_LABEL_MAP: Record<string, string> = {
  '🔥': 'Fire',
  '🍑': 'Ass',
  '🍆': 'Dick',
  '👅': 'Oral',
  '💦': 'Wet',
  '🛋️': 'Sofa',
  '🛁': 'Bath',
  '🚿': 'Shower',
  '🌅': 'Morning',
  '🌙': 'Night',
  '🏨': 'Hotel',
  '🚗': 'Car',
  '✈️': 'Travel',
  '🏕️': 'Outdoor',
  '💪': 'Workout',
  '🍷': 'Wine',
  '🎬': 'Movie',
  '💐': 'Romantic',
  '🎉': 'Celebration',
  '🎂': 'Birthday',
  '💍': 'Anniversary',
  '🥰': 'Sweet',
  '😈': 'Naughty',
  '🤫': 'Secret',
  '⏰': 'Quickie',
  '🔄': 'Round 2',
};

// Emoji category mapping
const EMOJI_CATEGORY_MAP: Record<string, string> = {
  '🔥': 'SPICY_HEAT', '💦': 'SPICY_HEAT', '🍆': 'SPICY_HEAT', '🍑': 'SPICY_HEAT', '👅': 'SPICY_HEAT', '😈': 'SPICY_HEAT',
  '💐': 'ROMANTIC_SOFT', '🥰': 'ROMANTIC_SOFT', '💍': 'ROMANTIC_SOFT', '🎂': 'ROMANTIC_SOFT',
  '🤫': 'PLAYFUL_TEASE', '⏰': 'PLAYFUL_TEASE', '🔄': 'PLAYFUL_TEASE', '🎉': 'PLAYFUL_TEASE',
  '🛋️': 'LOCATION_HOME', '🛁': 'LOCATION_HOME', '🚿': 'LOCATION_HOME',
  '🏨': 'LOCATION_AWAY', '🚗': 'LOCATION_AWAY', '✈️': 'LOCATION_AWAY', '🏕️': 'LOCATION_AWAY',
  '🌅': 'TIME_MORNING', '🌙': 'TIME_NIGHT',
  '🍷': 'CONTEXT', '🎬': 'CONTEXT', '💪': 'CONTEXT',
};

const TIME_BUCKETS = {
  nightOwl: { label: 'Night Owl', range: '00:00-05:59' },
  earlyBird: { label: 'Early Bird', range: '06:00-08:59' },
  morningDelight: { label: 'Morning Delight', range: '09:00-11:59' },
  afternoonAdventure: { label: 'Afternoon Adventure', range: '12:00-16:59' },
  eveningBliss: { label: 'Evening Bliss', range: '17:00-20:59' },
  lateNight: { label: 'Late Night', range: '21:00-23:59' },
};

interface Activity {
  id: string;
  activity_date: string;
  emoji: string | null;
  notes: string | null;
}

// Get local date in user's timezone
function getLocalDate(timezone: string): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  return new Date(
    parseInt(get('year')),
    parseInt(get('month')) - 1,
    parseInt(get('day')),
    parseInt(get('hour')),
    parseInt(get('minute')),
    parseInt(get('second'))
  );
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Get year total for specific year
function getYearTotal(activities: Activity[], year: number, timezone: string): number {
  return activities.filter(a => {
    const actDate = new Date(a.activity_date);
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric' });
    const actYear = parseInt(formatter.format(actDate));
    return actYear === year;
  }).length;
}

// Get activities for a specific year
function getActivitiesForYear(activities: Activity[], year: number, timezone: string): Activity[] {
  return activities.filter(a => {
    const actDate = new Date(a.activity_date);
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric' });
    const actYear = parseInt(formatter.format(actDate));
    return actYear === year;
  });
}

// Get best month (month with most activities)
function getBestMonth(activities: Activity[], timezone: string): { month: string; count: number } | null {
  if (activities.length === 0) return null;
  
  const monthCounts: Record<string, number> = {};
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  activities.forEach(a => {
    const actDate = new Date(a.activity_date);
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, month: 'numeric' });
    const month = parseInt(formatter.format(actDate)) - 1;
    const monthName = monthNames[month];
    monthCounts[monthName] = (monthCounts[monthName] || 0) + 1;
  });
  
  const sorted = Object.entries(monthCounts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? { month: sorted[0][0], count: sorted[0][1] } : null;
}

// Get best week (week with most activities)
function getBestWeek(activities: Activity[], timezone: string): { weekStart: string; weekEnd: string; count: number } | null {
  if (activities.length === 0) return null;
  
  const weekCounts: Record<string, { count: number; dates: Date[] }> = {};
  
  activities.forEach(a => {
    const actDate = new Date(a.activity_date);
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: timezone, 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
    const localDateStr = formatter.format(actDate);
    const localDate = new Date(localDateStr);
    const week = getWeekNumber(localDate);
    const year = localDate.getFullYear();
    const key = `${year}-W${week}`;
    
    if (!weekCounts[key]) {
      weekCounts[key] = { count: 0, dates: [] };
    }
    weekCounts[key].count++;
    weekCounts[key].dates.push(localDate);
  });
  
  const sorted = Object.entries(weekCounts).sort((a, b) => b[1].count - a[1].count);
  if (sorted.length === 0) return null;
  
  const bestWeek = sorted[0][1];
  const dates = bestWeek.dates.sort((a, b) => a.getTime() - b.getTime());
  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
  return {
    weekStart: formatDate(dates[0]),
    weekEnd: formatDate(dates[dates.length - 1]),
    count: bestWeek.count,
  };
}

// Get longest streak (consecutive weeks with activity)
function getLongestStreak(activities: Activity[], timezone: string): number {
  if (activities.length === 0) return 0;
  
  const weeksWithActivity = new Set<string>();
  
  activities.forEach(a => {
    const actDate = new Date(a.activity_date);
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: timezone, 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
    const localDateStr = formatter.format(actDate);
    const localDate = new Date(localDateStr);
    const week = getWeekNumber(localDate);
    const year = localDate.getFullYear();
    weeksWithActivity.add(`${year}-${week.toString().padStart(2, '0')}`);
  });
  
  const sortedWeeks = Array.from(weeksWithActivity).sort();
  if (sortedWeeks.length === 0) return 0;
  
  let longestStreak = 1;
  let currentStreak = 1;
  
  for (let i = 1; i < sortedWeeks.length; i++) {
    const [prevYear, prevWeek] = sortedWeeks[i - 1].split('-').map(Number);
    const [currYear, currWeek] = sortedWeeks[i].split('-').map(Number);
    
    const isConsecutive = 
      (currYear === prevYear && currWeek === prevWeek + 1) ||
      (currYear === prevYear + 1 && prevWeek >= 52 && currWeek === 1);
    
    if (isConsecutive) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  
  return longestStreak;
}

// Get active weeks count
function getActiveWeeksCount(activities: Activity[], timezone: string): number {
  const weeksWithActivity = new Set<string>();
  
  activities.forEach(a => {
    const actDate = new Date(a.activity_date);
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: timezone, 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
    const localDateStr = formatter.format(actDate);
    const localDate = new Date(localDateStr);
    const week = getWeekNumber(localDate);
    const year = localDate.getFullYear();
    weeksWithActivity.add(`${year}-${week}`);
  });
  
  return weeksWithActivity.size;
}

// Get time of day breakdown
function getTimeOfDayBreakdown(activities: Activity[], timezone: string): Record<string, number> {
  const breakdown: Record<string, number> = {
    nightOwl: 0,
    earlyBird: 0,
    morningDelight: 0,
    afternoonAdventure: 0,
    eveningBliss: 0,
    lateNight: 0,
  };
  
  activities.forEach(a => {
    const actDate = new Date(a.activity_date);
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hour: '2-digit', hour12: false });
    const hour = parseInt(formatter.format(actDate));
    
    if (hour >= 0 && hour < 6) breakdown.nightOwl++;
    else if (hour >= 6 && hour < 9) breakdown.earlyBird++;
    else if (hour >= 9 && hour < 12) breakdown.morningDelight++;
    else if (hour >= 12 && hour < 17) breakdown.afternoonAdventure++;
    else if (hour >= 17 && hour < 21) breakdown.eveningBliss++;
    else breakdown.lateNight++;
  });
  
  return breakdown;
}

// Get bunny days (double and triple days)
function getBunnyDaysBreakdown(activities: Activity[], timezone: string): { doubleDays: number; tripleDays: number } {
  const dayCounts: Record<string, number> = {};
  
  activities.forEach(a => {
    const actDate = new Date(a.activity_date);
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: timezone, 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
    const dateKey = formatter.format(actDate);
    dayCounts[dateKey] = (dayCounts[dateKey] || 0) + 1;
  });
  
  let doubleDays = 0;
  let tripleDays = 0;
  
  Object.values(dayCounts).forEach(count => {
    if (count === 2) doubleDays++;
    else if (count >= 3) tripleDays++;
  });
  
  return { doubleDays, tripleDays };
}

// Get top 5 emojis (excluding default 🔥)
function getTopEmojis(activities: Activity[], limit: number = 5): Array<{ emoji: string; label: string; count: number }> {
  const emojiCounts: Record<string, number> = {};
  
  activities.forEach(a => {
    if (a.emoji && a.emoji !== '🔥') {
      emojiCounts[a.emoji] = (emojiCounts[a.emoji] || 0) + 1;
    }
  });
  
  const sorted = Object.entries(emojiCounts).sort((a, b) => b[1] - a[1]);
  
  return sorted.slice(0, limit).map(([emoji, count]) => ({
    emoji,
    label: EMOJI_LABEL_MAP[emoji] || 'Unknown',
    count,
  }));
}

// Get emoji variety with examples
function getEmojiVariety(activities: Activity[]): { count: number; examples: string[] } {
  const uniqueEmojis = new Set<string>();
  activities.forEach(a => {
    if (a.emoji) uniqueEmojis.add(a.emoji);
  });
  
  const examples = Array.from(uniqueEmojis).slice(0, 8); // Show up to 8 example emojis
  return { count: uniqueEmojis.size, examples };
}

// Get emoji time patterns
function getEmojiTimePatterns(activities: Activity[], timezone: string): Array<{ emoji: string; label: string; timeSlot: string; percentage: number }> {
  const emojiTimeData: Record<string, Record<string, number>> = {};
  
  activities.forEach(a => {
    if (!a.emoji || a.emoji === '🔥') return;
    
    const actDate = new Date(a.activity_date);
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hour: '2-digit', hour12: false });
    const hour = parseInt(formatter.format(actDate));
    
    let timeSlot: string;
    if (hour >= 0 && hour < 6) timeSlot = 'Night Owl';
    else if (hour >= 6 && hour < 9) timeSlot = 'Early Bird';
    else if (hour >= 9 && hour < 12) timeSlot = 'Morning Delight';
    else if (hour >= 12 && hour < 17) timeSlot = 'Afternoon Adventure';
    else if (hour >= 17 && hour < 21) timeSlot = 'Evening Bliss';
    else timeSlot = 'Late Night';
    
    if (!emojiTimeData[a.emoji]) emojiTimeData[a.emoji] = {};
    emojiTimeData[a.emoji][timeSlot] = (emojiTimeData[a.emoji][timeSlot] || 0) + 1;
  });
  
  const patterns: Array<{ emoji: string; label: string; timeSlot: string; percentage: number }> = [];
  
  Object.entries(emojiTimeData).forEach(([emoji, times]) => {
    const total = Object.values(times).reduce((a, b) => a + b, 0);
    if (total < 3) return; // Need at least 3 occurrences
    
    const sorted = Object.entries(times).sort((a, b) => b[1] - a[1]);
    const [topTime, topCount] = sorted[0];
    const percentage = Math.round((topCount / total) * 100);
    
    if (percentage >= 60) {
      patterns.push({
        emoji,
        label: EMOJI_LABEL_MAP[emoji] || 'Unknown',
        timeSlot: topTime,
        percentage,
      });
    }
  });
  
  return patterns.slice(0, 3); // Top 3 patterns
}

// Get emoji day patterns
function getEmojiDayPatterns(activities: Activity[], timezone: string): Array<{ emoji: string; label: string; day: string; percentage: number }> {
  const emojiDayData: Record<string, Record<string, number>> = {};
  const dayNames = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
  
  activities.forEach(a => {
    if (!a.emoji || a.emoji === '🔥') return;
    
    const actDate = new Date(a.activity_date);
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, weekday: 'long' });
    const dayOfWeek = formatter.format(actDate);
    const dayPlural = dayOfWeek + 's';
    
    if (!emojiDayData[a.emoji]) emojiDayData[a.emoji] = {};
    emojiDayData[a.emoji][dayPlural] = (emojiDayData[a.emoji][dayPlural] || 0) + 1;
  });
  
  const patterns: Array<{ emoji: string; label: string; day: string; percentage: number }> = [];
  
  Object.entries(emojiDayData).forEach(([emoji, days]) => {
    const total = Object.values(days).reduce((a, b) => a + b, 0);
    if (total < 3) return;
    
    const sorted = Object.entries(days).sort((a, b) => b[1] - a[1]);
    const [topDay, topCount] = sorted[0];
    const percentage = Math.round((topCount / total) * 100);
    
    if (percentage >= 50) {
      patterns.push({
        emoji,
        label: EMOJI_LABEL_MAP[emoji] || 'Unknown',
        day: topDay,
        percentage,
      });
    }
  });
  
  return patterns.slice(0, 3);
}

// Get category breakdown
function getCategoryBreakdown(activities: Activity[]): Record<string, number> {
  const breakdown: Record<string, number> = {};
  
  activities.forEach(a => {
    const category = a.emoji ? (EMOJI_CATEGORY_MAP[a.emoji] || 'OTHER') : 'OTHER';
    breakdown[category] = (breakdown[category] || 0) + 1;
  });
  
  return breakdown;
}

// Get location adventures
function getLocationAdventures(activities: Activity[]): { count: number; topLocation: string | null } {
  const awayActivities = activities.filter(a => {
    const category = a.emoji ? EMOJI_CATEGORY_MAP[a.emoji] : null;
    return category === 'LOCATION_AWAY';
  });
  
  // Try to find most common away emoji
  const emojiCounts: Record<string, number> = {};
  awayActivities.forEach(a => {
    if (a.emoji) emojiCounts[a.emoji] = (emojiCounts[a.emoji] || 0) + 1;
  });
  
  const sorted = Object.entries(emojiCounts).sort((a, b) => b[1] - a[1]);
  const topLocation = sorted.length > 0 ? EMOJI_LABEL_MAP[sorted[0][0]] || null : null;
  
  return { count: awayActivities.length, topLocation };
}

// Get dominant time of day
function getDominantTimeOfDay(breakdown: Record<string, number>): { slot: string; label: string; percentage: number } {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (total === 0) return { slot: 'eveningBliss', label: 'Evening Bliss', percentage: 0 };
  
  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const [slot, count] = sorted[0];
  const percentage = Math.round((count / total) * 100);
  
  return { slot, label: TIME_BUCKETS[slot as keyof typeof TIME_BUCKETS]?.label || slot, percentage };
}

// Generate signature move copy
function getSignatureMoveCopy(emoji: string, category: string): string {
  const copies: Record<string, string[]> = {
    'LOCATION_HOME': [
      "Home is where the heart is... and apparently the action too.",
      "Why go out when in is so good?",
    ],
    'LOCATION_AWAY': [
      "You two clearly enjoy an adventure.",
      "Home? Never heard of it.",
    ],
    'SPICY_HEAT': [
      "You don't do vanilla, do you?",
      "Bringing the heat all year long.",
    ],
    'ROMANTIC_SOFT': [
      "Soft, sweet, and very much in love.",
      "Romance isn't dead. You're proof.",
    ],
    'PLAYFUL_TEASE': [
      "A little tease goes a long way.",
      "Keeping things interesting, clearly.",
    ],
  };
  
  const options = copies[category] || ["Clearly a favorite."];
  return options[Math.floor(Math.random() * options.length)];
}

// Generate variety score copy
function getVarietyScoreCopy(count: number): string {
  if (count <= 3) return "Creatures of habit. Nothing wrong with that.";
  if (count <= 7) return "A healthy mix of favorites and experiments.";
  if (count <= 12) return "Variety is clearly your spice.";
  return "Adventurers. Every emoji tells a story.";
}

// Generate year-over-year comparison copy
function getYoYCopy(current: number, previous: number): string {
  const diff = current - previous;
  const percentChange = previous > 0 ? Math.round((diff / previous) * 100) : 0;
  
  if (diff > 0) {
    if (percentChange >= 50) return `Up ${diff} from last year. Major glow-up.`;
    if (percentChange >= 20) return `${diff} more than last year. You're on a roll.`;
    return `Up ${diff} from ${previous} last year. Steady growth.`;
  } else if (diff < 0) {
    const absDiff = Math.abs(diff);
    if (percentChange <= -30) return `${absDiff} fewer than last year. Quality over quantity, right?`;
    return `Down ${absDiff} from last year. Life happens.`;
  }
  return `Same as last year. Consistency is your thing.`;
}

function getStreakYoYCopy(current: number, previous: number): string {
  const diff = current - previous;
  if (diff > 0) return `Longest streak up ${diff} weeks from last year!`;
  if (diff < 0) return `Streak was ${Math.abs(diff)} weeks longer last year.`;
  return `Same longest streak as last year.`;
}

// Generate plain text email
function getPlainText(data: {
  year: number;
  yearTotal: number;
  bestMonth: { month: string; count: number } | null;
  bestWeek: { weekStart: string; weekEnd: string; count: number } | null;
  longestStreak: number;
  activeWeeks: number;
  dominantTime: { label: string; percentage: number };
  bunnyDays: { doubleDays: number; tripleDays: number };
  topEmojis: Array<{ emoji: string; label: string; count: number }>;
  emojiVariety: { count: number; examples: string[] };
  emojiTimePatterns: Array<{ emoji: string; label: string; timeSlot: string; percentage: number }>;
  emojiDayPatterns: Array<{ emoji: string; label: string; day: string; percentage: number }>;
  locationAdventures: { count: number; topLocation: string | null };
  // Year-over-year comparison (optional)
  previousYear?: {
    year: number;
    yearTotal: number;
    longestStreak: number;
    activeWeeks: number;
    emojiVariety: number;
    bunnyDays: { doubleDays: number; tripleDays: number };
  };
}): string {
  const lines: string[] = [
    `Your ${data.year}, Wrapped`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `THE BIG NUMBER`,
    `${data.yearTotal} moments together`,
  ];
  
  // Add year-over-year comparison if available
  if (data.previousYear && data.previousYear.yearTotal > 0) {
    lines.push(getYoYCopy(data.yearTotal, data.previousYear.yearTotal));
  } else {
    lines.push(
      data.yearTotal >= 52 
        ? `You hit the goal! That's once a week, every week.`
        : `That's ${Math.round((data.yearTotal / 52) * 100)}% of the way to 52.`
    );
  }
  lines.push('');
  
  // Top 5 emojis section
  if (data.topEmojis.length > 0) {
    lines.push(`YOUR FAVOURITE MOVES`);
    data.topEmojis.forEach((e, i) => {
      const prefix = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      lines.push(`${prefix} ${e.emoji} - ${e.count} times`);
    });
    if (data.topEmojis.length > 0) {
      const topEmoji = data.topEmojis[0];
      lines.push(getSignatureMoveCopy(topEmoji.emoji, EMOJI_CATEGORY_MAP[topEmoji.emoji] || 'OTHER'));
    }
    lines.push('');
  }
  
  // Emoji variety with examples
  if (data.emojiVariety.count > 1) {
    lines.push(`EMOJI VARIETY`);
    lines.push(`${data.emojiVariety.count} different flavors`);
    if (data.emojiVariety.examples.length > 0) {
      lines.push(`Your palette: ${data.emojiVariety.examples.join(' ')}`);
    }
    lines.push(getVarietyScoreCopy(data.emojiVariety.count));
    lines.push('');
  }
  
  if (data.emojiTimePatterns.length > 0) {
    lines.push(`PATTERNS WE NOTICED`);
    data.emojiTimePatterns.forEach(p => {
      lines.push(`${p.emoji} ${p.label} is an ${p.timeSlot} thing for you`);
    });
    lines.push('');
  }
  
  if (data.emojiDayPatterns.length > 0) {
    data.emojiDayPatterns.forEach(p => {
      lines.push(`${p.emoji} mostly happens on ${p.day}... coincidence?`);
    });
    lines.push('');
  }
  
  if (data.bestMonth) {
    lines.push(
      `BEST MONTH`,
      `${data.bestMonth.month} - ${data.bestMonth.count} moments`,
      ''
    );
  }
  
  if (data.bestWeek) {
    lines.push(
      `BEST WEEK`,
      `${data.bestWeek.weekStart} - ${data.bestWeek.weekEnd}: ${data.bestWeek.count} moments`,
      ''
    );
  }
  
  lines.push(
    `TIME OF DAY`,
    `You're ${data.dominantTime.label} people (${data.dominantTime.percentage}%)`,
    ''
  );
  
  const totalBunny = data.bunnyDays.doubleDays + data.bunnyDays.tripleDays;
  if (totalBunny > 0) {
    lines.push(
      `BUNNY DAYS`,
      `${totalBunny} days you just couldn't get enough`,
      data.bunnyDays.doubleDays > 0 ? `${data.bunnyDays.doubleDays} double days` : '',
      data.bunnyDays.tripleDays > 0 ? `${data.bunnyDays.tripleDays} triple days (!)` : '',
      ''
    );
  }
  
  if (data.locationAdventures.count > 0) {
    lines.push(
      `ADVENTURES`,
      `${data.locationAdventures.count} moments away from home`,
      data.locationAdventures.topLocation ? `Favorite: ${data.locationAdventures.topLocation}` : '',
      ''
    );
  }
  
  lines.push(`CONSISTENCY`);
  lines.push(`Longest streak: ${data.longestStreak} weeks in a row`);
  
  // Add YoY streak comparison if available
  if (data.previousYear && data.previousYear.longestStreak > 0) {
    lines.push(getStreakYoYCopy(data.longestStreak, data.previousYear.longestStreak));
  }
  
  lines.push(`Active weeks: ${data.activeWeeks} out of 52`);
  
  // Add YoY active weeks comparison if available
  if (data.previousYear && data.previousYear.activeWeeks > 0) {
    const activeWeeksDiff = data.activeWeeks - data.previousYear.activeWeeks;
    if (activeWeeksDiff > 0) {
      lines.push(`${activeWeeksDiff} more active weeks than ${data.previousYear.year}.`);
    } else if (activeWeeksDiff < 0) {
      lines.push(`${Math.abs(activeWeeksDiff)} fewer active weeks than ${data.previousYear.year}.`);
    }
  }
  
  lines.push(
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `Here's to ${data.year + 1}. Keep going.`,
    '',
    'fiftytwoormore',
  );
  
  return lines.filter(l => l !== undefined).join('\n');
}

// Generate HTML email
function getHtml(text: string, trackingParams?: { messageId: string; userId: string }): string {
  const baseUrl = Deno.env.get("SUPABASE_URL") || "";
  let ctaLink = "https://fiftytwoormore.com";
  
  if (trackingParams) {
    const params = new URLSearchParams({
      mid: trackingParams.messageId,
      uid: trackingParams.userId,
      type: 'yearly-review',
    });
    ctaLink = `${baseUrl}/functions/v1/email-click-tracker?${params.toString()}`;
  }
  
  const htmlContent = text
    .split('\n')
    .map(line => {
      if (line.startsWith('━')) {
        return '<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">';
      }
      if (line.match(/^[A-Z\s]+$/) && line.length > 3) {
        return `<h3 style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 8px 0;">${line}</h3>`;
      }
      if (line.includes('Your') && line.includes('Wrapped')) {
        return `<h1 style="font-size: 28px; color: #1a1a1a; margin: 0 0 24px 0;">${line}</h1>`;
      }
      if (line.match(/^\d+ moments? together$/)) {
        return `<p style="font-size: 36px; font-weight: bold; color: #1a1a1a; margin: 0 0 8px 0;">${line}</p>`;
      }
      if (line === '') {
        return '<br>';
      }
      return `<p style="color: #333; font-size: 16px; line-height: 1.6; margin: 4px 0;">${line}</p>`;
    })
    .join('');
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background-color: #ffffff;">
  ${htmlContent}
  <div style="margin-top: 32px; text-align: center;">
    <a href="${ctaLink}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500;">Start ${new Date().getFullYear()} strong →</a>
  </div>
</body>
</html>`;
}

// Subject line options
const SUBJECT_LINES = [
  (year: number, total: number) => `Your ${year}, wrapped`,
  (year: number, total: number) => `${total} moments. One beautiful year.`,
  (year: number, total: number) => `${year}: Your year in review`,
  (year: number, total: number) => `What ${total} moments taught us about you two`,
];

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const reviewYear = body.year || new Date().getFullYear() - 1;
    const testMode = body.testMode || false;
    const testEmail = body.testEmail;
    const sendToAll = body.sendToAll || false;

    console.log(`Starting yearly review for ${reviewYear}, testMode: ${testMode}, sendToAll: ${sendToAll}`);

    // Get all couples with their profiles
    const { data: couples, error: couplesError } = await supabase
      .from('couples')
      .select(`
        id,
        user1_id,
        user2_id
      `);

    if (couplesError) {
      console.error('Error fetching couples:', couplesError);
      throw couplesError;
    }

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const couple of couples || []) {
      try {
        // Get profiles for both users
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, name, email_digest_enabled, timezone')
          .in('user_id', [couple.user1_id, couple.user2_id]);

        if (profilesError || !profiles || profiles.length < 2) {
          console.log(`Skipping couple ${couple.id}: missing profiles`);
          continue;
        }

        // Get emails from auth
        const userIds = [couple.user1_id, couple.user2_id];
        const emails: string[] = [];
        
        for (const userId of userIds) {
          const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
          if (!userError && user?.email) {
            emails.push(user.email);
          }
        }

        if (emails.length === 0) {
          console.log(`Skipping couple ${couple.id}: no emails found`);
          continue;
        }

        // Test mode filtering
        if (testMode && testEmail && !emails.includes(testEmail)) {
          continue;
        }

        if (!testMode && !sendToAll) {
          console.log('Dry run - would send to:', emails);
          results.push(...emails.map(e => ({ email: e, success: true, error: 'dry run' })));
          continue;
        }

        const timezone = profiles[0].timezone || 'Europe/Stockholm';

        // Get all activities for this couple
        const { data: activities, error: activitiesError } = await supabase
          .from('activities')
          .select('id, activity_date, emoji, notes')
          .in('user_id', userIds)
          .order('activity_date', { ascending: false });

        if (activitiesError) {
          console.error(`Error fetching activities for couple ${couple.id}:`, activitiesError);
          continue;
        }

        // Filter to review year
        const yearActivities = getActivitiesForYear(activities || [], reviewYear, timezone);
        
        if (yearActivities.length === 0) {
          console.log(`Skipping couple ${couple.id}: no activities in ${reviewYear}`);
          continue;
        }

        // Calculate all statistics for current year
        const yearTotal = yearActivities.length;
        const bestMonth = getBestMonth(yearActivities, timezone);
        const bestWeek = getBestWeek(yearActivities, timezone);
        const longestStreak = getLongestStreak(yearActivities, timezone);
        const activeWeeks = getActiveWeeksCount(yearActivities, timezone);
        const timeBreakdown = getTimeOfDayBreakdown(yearActivities, timezone);
        const dominantTime = getDominantTimeOfDay(timeBreakdown);
        const bunnyDays = getBunnyDaysBreakdown(yearActivities, timezone);
        const topEmojis = getTopEmojis(yearActivities, 5);
        const emojiVariety = getEmojiVariety(yearActivities);
        const emojiTimePatterns = getEmojiTimePatterns(yearActivities, timezone);
        const emojiDayPatterns = getEmojiDayPatterns(yearActivities, timezone);
        const locationAdventures = getLocationAdventures(yearActivities);

        // Calculate previous year stats for year-over-year comparison
        const previousYearActivities = getActivitiesForYear(activities || [], reviewYear - 1, timezone);
        let previousYear: {
          year: number;
          yearTotal: number;
          longestStreak: number;
          activeWeeks: number;
          emojiVariety: number;
          bunnyDays: { doubleDays: number; tripleDays: number };
        } | undefined;

        if (previousYearActivities.length > 0) {
          console.log(`Couple ${couple.id} has ${previousYearActivities.length} activities in ${reviewYear - 1} - including YoY comparison`);
          previousYear = {
            year: reviewYear - 1,
            yearTotal: previousYearActivities.length,
            longestStreak: getLongestStreak(previousYearActivities, timezone),
            activeWeeks: getActiveWeeksCount(previousYearActivities, timezone),
            emojiVariety: getEmojiVariety(previousYearActivities).count,
            bunnyDays: getBunnyDaysBreakdown(previousYearActivities, timezone),
          };
        }

        const data = {
          year: reviewYear,
          yearTotal,
          bestMonth,
          bestWeek,
          longestStreak,
          activeWeeks,
          dominantTime,
          bunnyDays,
          topEmojis,
          emojiVariety,
          emojiTimePatterns,
          emojiDayPatterns,
          locationAdventures,
          previousYear,
        };

        const plainText = getPlainText(data);
        const subjectFn = SUBJECT_LINES[Math.floor(Math.random() * SUBJECT_LINES.length)];
        const subject = subjectFn(reviewYear, yearTotal);

        // Send to each user
        for (const email of emails) {
          const userId = userIds[emails.indexOf(email)] || userIds[0];
          const messageId = crypto.randomUUID();
          
          const html = getHtml(plainText, { messageId, userId });

          try {
            const emailResponse = await resend.emails.send({
              from: "fiftytwoormore <digest@updates.lindaninc.com>",
              to: [email],
              subject,
              html,
              text: plainText,
            });

            console.log(`Sent yearly review to ${email}:`, emailResponse);

            // Log to email_digest_log
            await supabase.from('email_digest_log').insert({
              user_id: userId,
              type: 'yearly-review',
              year: reviewYear,
              week_number: 1,
              subject,
              message_id: messageId,
              resend_message_id: emailResponse.data?.id,
            });

            results.push({ email, success: true });
          } catch (sendError: any) {
            console.error(`Failed to send to ${email}:`, sendError);
            results.push({ email, success: false, error: sendError.message });
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 600));
        }
      } catch (coupleError: any) {
        console.error(`Error processing couple ${couple.id}:`, coupleError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        year: reviewYear,
        results,
        sent: results.filter(r => r.success && r.error !== 'dry run').length,
        failed: results.filter(r => !r.success).length,
        dryRun: results.filter(r => r.error === 'dry run').length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-yearly-review:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
