import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getCohortKey(anniversaryDate: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - anniversaryDate.getTime();
  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  
  if (diffYears < 1) return "0-1y";
  if (diffYears < 3) return "1-3y";
  if (diffYears < 5) return "3-5y";
  if (diffYears < 10) return "5-10y";
  return "10y+";
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

interface CoupleStats {
  cohortKey: string;
  monthlyCount: number;
  rolling4Weeks: number;
  consistencyScore: number;
  streakLength: number;
}

async function computeCoupleStats(
  supabase: any,
  coupleId: string,
  user1Id: string,
  user2Id: string,
  anniversary: string
): Promise<CoupleStats | null> {
  const userIds = [user1Id, user2Id];
  const cohortKey = getCohortKey(new Date(anniversary));
  
  // Get all activities for this couple
  const { data: activities, error } = await supabase
    .from("activities")
    .select("activity_date")
    .in("user_id", userIds)
    .order("activity_date", { ascending: false });
  
  if (error || !activities || activities.length === 0) {
    return null;
  }
  
  const now = new Date();
  
  // Monthly count (last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthlyCount = activities.filter(
    (a: any) => new Date(a.activity_date) >= thirtyDaysAgo
  ).length;
  
  // Rolling 4 weeks count
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const rolling4Weeks = activities.filter(
    (a: any) => new Date(a.activity_date) >= fourWeeksAgo
  ).length;
  
  // Consistency score: weeks with activity out of last 12 weeks
  const weekSet = new Set<string>();
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);
  activities
    .filter((a: any) => new Date(a.activity_date) >= twelveWeeksAgo)
    .forEach((a: any) => {
      const date = new Date(a.activity_date);
      const year = date.getFullYear();
      const week = getWeekNumber(date);
      weekSet.add(`${year}-W${week}`);
    });
  const consistencyScore = (weekSet.size / 12) * 100;
  
  // Streak length (consecutive weeks with activity from current week backwards)
  const allWeekSet = new Set<string>();
  activities.forEach((a: any) => {
    const date = new Date(a.activity_date);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    allWeekSet.add(`${year}-W${week}`);
  });
  
  let checkYear = now.getFullYear();
  let checkWeek = getWeekNumber(now);
  let streakLength = 0;
  
  // Check current week
  if (allWeekSet.has(`${checkYear}-W${checkWeek}`)) {
    streakLength = 1;
  }
  
  // Go backwards
  checkWeek--;
  if (checkWeek < 1) {
    checkYear--;
    checkWeek = getWeekNumber(new Date(checkYear, 11, 31));
  }
  
  for (let i = 0; i < 52; i++) {
    const weekKey = `${checkYear}-W${checkWeek}`;
    if (allWeekSet.has(weekKey)) {
      streakLength++;
    } else {
      break;
    }
    checkWeek--;
    if (checkWeek < 1) {
      checkYear--;
      checkWeek = getWeekNumber(new Date(checkYear, 11, 31));
    }
  }
  
  return {
    cohortKey,
    monthlyCount,
    rolling4Weeks,
    consistencyScore,
    streakLength,
  };
}

function getCurrentPeriod(): { periodType: string; period: string } {
  const now = new Date();
  const year = now.getFullYear();
  const week = getWeekNumber(now);
  return {
    periodType: "weekly",
    period: `${year}-W${week.toString().padStart(2, "0")}`,
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting benchmark cohorts computation...");
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get all couples with benchmark_opt_in = true and anniversary set
    const { data: couples, error: couplesError } = await supabase
      .from("couples")
      .select(`
        id,
        user1_id,
        user2_id,
        anniversary
      `)
      .not("anniversary", "is", null);
    
    if (couplesError) {
      console.error("Error fetching couples:", couplesError);
      throw couplesError;
    }
    
    console.log(`Found ${couples?.length || 0} couples with anniversary set`);
    
    // Filter to only opted-in couples
    const optedInCouples: any[] = [];
    for (const couple of couples || []) {
      // Check if either user has opted in
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, benchmark_opt_in")
        .in("user_id", [couple.user1_id, couple.user2_id]);
      
      const hasOptIn = profiles?.some((p: any) => p.benchmark_opt_in === true);
      if (hasOptIn) {
        optedInCouples.push(couple);
      }
    }
    
    console.log(`${optedInCouples.length} couples have opted into benchmarks`);
    
    // Compute stats for each opted-in couple
    const allStats: CoupleStats[] = [];
    for (const couple of optedInCouples) {
      const stats = await computeCoupleStats(
        supabase,
        couple.id,
        couple.user1_id,
        couple.user2_id,
        couple.anniversary
      );
      if (stats) {
        allStats.push(stats);
      }
    }
    
    console.log(`Computed stats for ${allStats.length} couples`);
    
    // Group by cohort
    const cohortGroups: Record<string, CoupleStats[]> = {};
    for (const stats of allStats) {
      if (!cohortGroups[stats.cohortKey]) {
        cohortGroups[stats.cohortKey] = [];
      }
      cohortGroups[stats.cohortKey].push(stats);
    }
    
    // Compute aggregate stats per cohort
    const { periodType, period } = getCurrentPeriod();
    const cohortRecords: any[] = [];
    
    for (const [cohortKey, stats] of Object.entries(cohortGroups)) {
      const monthlyCounts = stats.map((s) => s.monthlyCount);
      const rolling4WeeksCounts = stats.map((s) => s.rolling4Weeks);
      const consistencyScores = stats.map((s) => s.consistencyScore);
      const streakLengths = stats.map((s) => s.streakLength);
      
      cohortRecords.push({
        cohort_key: cohortKey,
        period_type: periodType,
        period: period,
        couple_count: stats.length,
        median_monthly_count: median(monthlyCounts),
        median_rolling_4_weeks: median(rolling4WeeksCounts),
        median_consistency_score: median(consistencyScores),
        median_streak_length: median(streakLengths),
        p25_monthly_count: percentile(monthlyCounts, 25),
        p75_monthly_count: percentile(monthlyCounts, 75),
        computed_at: new Date().toISOString(),
      });
    }
    
    console.log(`Generated ${cohortRecords.length} cohort records`);
    
    // Upsert cohort records
    if (cohortRecords.length > 0) {
      const { error: upsertError } = await supabase
        .from("benchmark_cohorts")
        .upsert(cohortRecords, {
          onConflict: "cohort_key,period_type,period",
        });
      
      if (upsertError) {
        console.error("Error upserting cohort records:", upsertError);
        throw upsertError;
      }
      
      console.log("Successfully upserted cohort records");
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        couplesProcessed: optedInCouples.length,
        cohortsUpdated: cohortRecords.length,
        cohorts: cohortRecords.map((c) => ({
          cohortKey: c.cohort_key,
          coupleCount: c.couple_count,
          medianMonthly: c.median_monthly_count,
        })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in compute-benchmark-cohorts:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
