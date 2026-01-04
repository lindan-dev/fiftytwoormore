import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Home, Share2, Sparkles, Flame, Calendar, Trophy, Rabbit, MapPin, Sunrise, Coffee, Sun, Sunset, Stars, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, getWeek } from "date-fns";

interface Activity {
  id: string;
  activity_date: string;
  emoji: string | null;
  notes: string | null;
}

const TIME_BUCKETS: Record<string, { label: string; range: string; Icon: React.ComponentType<{ className?: string }>; statement: string }> = {
  nightOwl: { label: 'Night Owl', range: '00:00-05:59', Icon: Moon, statement: "The night is yours. Don't fight it." },
  earlyBird: { label: 'Early Bird', range: '06:00-08:59', Icon: Sunrise, statement: "Early mornings are your thing. Embrace it." },
  morningDelight: { label: 'Lazy Morning', range: '09:00-11:59', Icon: Coffee, statement: "Lazy mornings work for you. Keep it cozy." },
  afternoonAdventure: { label: 'Afternoon Delight', range: '12:00-16:59', Icon: Sunset, statement: "Afternoon delight is real. Own it." },
  eveningBliss: { label: 'Evening Bliss', range: '17:00-20:59', Icon: Stars, statement: "Evenings are your time. Make them count." },
  lateNight: { label: 'Late Night', range: '21:00-23:59', Icon: Moon, statement: "Late nights are your thing. Don't apologize." },
};

// Get week number from date
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export default function YearInReview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const yearParam = searchParams.get('year');
  const reviewYear = yearParam ? parseInt(yearParam) : new Date().getFullYear() - 1;
  
  const [session, setSession] = useState<Session | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [partnerName, setPartnerName] = useState<string>("your partner");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate('/');
      }
    });
  }, [navigate]);

  // Fetch activities and partner info
  useEffect(() => {
    async function fetchData() {
      if (!session?.user?.id) return;
      
      setLoading(true);
      
      // Get partner ID
      const { data: partnerId } = await supabase.rpc("get_partner_id", { user_id: session.user.id });
      
      // Fetch partner's name
      if (partnerId) {
        const { data: partnerProfile } = await supabase
          .from("profiles")
          .select("name")
          .eq("user_id", partnerId)
          .maybeSingle();
        
        if (partnerProfile?.name) {
          setPartnerName(partnerProfile.name);
        }
      }
      
      // Fetch activities
      const userIds = partnerId ? [session.user.id, partnerId] : [session.user.id];
      const { data } = await supabase
        .from("activities")
        .select("*")
        .in("user_id", userIds)
        .order("activity_date", { ascending: false });
      
      setActivities(data || []);
      setLoading(false);
    }
    
    fetchData();
  }, [session?.user?.id]);

  // Filter activities for the review year
  const yearActivities = useMemo(() => {
    return activities.filter(a => {
      const year = new Date(a.activity_date).getFullYear();
      return year === reviewYear;
    });
  }, [activities, reviewYear]);

  // Calculate stats
  const stats = useMemo(() => {
    if (yearActivities.length === 0) return null;

    // Total moments
    const total = yearActivities.length;

    // Best month
    const monthCounts: Record<string, number> = {};
    yearActivities.forEach(a => {
      const month = format(new Date(a.activity_date), 'MMMM');
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    const sortedMonths = Object.entries(monthCounts).sort((a, b) => b[1] - a[1]);
    const bestMonth = sortedMonths[0] ? { name: sortedMonths[0][0], count: sortedMonths[0][1] } : null;

    // Best week
    const weekCounts: Record<string, { count: number; start: Date; end: Date }> = {};
    yearActivities.forEach(a => {
      const date = new Date(a.activity_date);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      const key = format(weekStart, 'yyyy-MM-dd');
      if (!weekCounts[key]) {
        weekCounts[key] = { count: 0, start: weekStart, end: weekEnd };
      }
      weekCounts[key].count++;
    });
    const sortedWeeks = Object.entries(weekCounts).sort((a, b) => b[1].count - a[1].count);
    const bestWeek = sortedWeeks[0] ? {
      range: `${format(sortedWeeks[0][1].start, 'MMM d')} - ${format(sortedWeeks[0][1].end, 'MMM d')}`,
      count: sortedWeeks[0][1].count
    } : null;

    // Longest streak (consecutive weeks)
    const weeksWithActivity = new Set<string>();
    yearActivities.forEach(a => {
      const date = new Date(a.activity_date);
      const week = getWeekNumber(date);
      const year = date.getFullYear();
      weeksWithActivity.add(`${year}-${week.toString().padStart(2, '0')}`);
    });
    const sortedWeekKeys = Array.from(weeksWithActivity).sort();
    let longestStreak = 1;
    let currentStreak = 1;
    for (let i = 1; i < sortedWeekKeys.length; i++) {
      const [prevYear, prevWeek] = sortedWeekKeys[i - 1].split('-').map(Number);
      const [currYear, currWeek] = sortedWeekKeys[i].split('-').map(Number);
      const isConsecutive = (currYear === prevYear && currWeek === prevWeek + 1) ||
        (currYear === prevYear + 1 && prevWeek >= 52 && currWeek === 1);
      if (isConsecutive) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    // Active weeks
    const activeWeeks = weeksWithActivity.size;

    // Time of day breakdown
    const timeOfDay: Record<string, number> = {
      nightOwl: 0, earlyBird: 0, morningDelight: 0,
      afternoonAdventure: 0, eveningBliss: 0, lateNight: 0
    };
    yearActivities.forEach(a => {
      const hour = new Date(a.activity_date).getHours();
      if (hour >= 0 && hour < 6) timeOfDay.nightOwl++;
      else if (hour >= 6 && hour < 9) timeOfDay.earlyBird++;
      else if (hour >= 9 && hour < 12) timeOfDay.morningDelight++;
      else if (hour >= 12 && hour < 17) timeOfDay.afternoonAdventure++;
      else if (hour >= 17 && hour < 21) timeOfDay.eveningBliss++;
      else timeOfDay.lateNight++;
    });
    const timeOfDayRanking = Object.entries(timeOfDay)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({
        key,
        label: TIME_BUCKETS[key]?.label || key,
        count,
        percentage: Math.round((count / total) * 100)
      }));

    // Top emojis
    const emojiCounts: Record<string, number> = {};
    yearActivities.forEach(a => {
      if (a.emoji) {
        emojiCounts[a.emoji] = (emojiCounts[a.emoji] || 0) + 1;
      }
    });
    const topEmojis = Object.entries(emojiCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emoji, count]) => ({ emoji, count, percentage: Math.round((count / total) * 100) }));

    // Emoji variety
    const emojiVariety = Object.keys(emojiCounts).length;

    // Bunny days
    const dayCounts: Record<string, number> = {};
    yearActivities.forEach(a => {
      const dateKey = format(new Date(a.activity_date), 'yyyy-MM-dd');
      dayCounts[dateKey] = (dayCounts[dateKey] || 0) + 1;
    });
    let doubleDays = 0;
    let tripleDays = 0;
    Object.values(dayCounts).forEach(count => {
      if (count === 2) doubleDays++;
      else if (count >= 3) tripleDays++;
    });

    // YoY comparison
    const prevYearActivities = activities.filter(a => 
      new Date(a.activity_date).getFullYear() === reviewYear - 1
    );
    const yoyChange = prevYearActivities.length > 0 
      ? total - prevYearActivities.length 
      : null;

    return {
      total,
      bestMonth,
      bestWeek,
      longestStreak,
      activeWeeks,
      timeOfDayRanking,
      topEmojis,
      emojiVariety,
      doubleDays,
      tripleDays,
      yoyChange,
      hasPreviousYear: prevYearActivities.length > 0
    };
  }, [yearActivities, activities, reviewYear]);

  const slides = useMemo(() => {
    if (!stats) return [];

    const slideList = [
      // Intro slide
      {
        id: 'intro',
        bg: 'bg-gradient-to-br from-primary via-primary/80 to-accent',
        content: (
          <div className="text-center space-y-6 animate-fade-in">
            <Sparkles className="w-16 h-16 mx-auto text-primary-foreground/80" />
            <h1 className="text-5xl sm:text-7xl font-bold text-primary-foreground">
              {reviewYear}
            </h1>
            <p className="text-xl sm:text-2xl text-primary-foreground/90">
              Your Year in Review
            </p>
            <p className="text-lg text-primary-foreground/70">
              with {partnerName}
            </p>
          </div>
        )
      },
      // Total moments
      {
        id: 'total',
        bg: 'bg-gradient-to-br from-orange-500 via-red-500 to-pink-500',
        content: (
          <div className="text-center space-y-6">
            <Flame className="w-16 h-16 mx-auto text-white/80 animate-pulse" />
            <p className="text-xl text-white/80">You shared</p>
            <h2 className="text-7xl sm:text-9xl font-bold text-white">
              {stats.total}
            </h2>
            <p className="text-2xl text-white/90">
              intimate moments in {reviewYear}
            </p>
            {stats.yoyChange !== null && (
              <p className="text-lg text-white/70">
                {stats.yoyChange > 0 ? `Up ${stats.yoyChange}` : stats.yoyChange < 0 ? `Down ${Math.abs(stats.yoyChange)}` : 'Same as'} from last year
              </p>
            )}
          </div>
        )
      },
      // Best month
      stats.bestMonth && {
        id: 'best-month',
        bg: 'bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500',
        content: (
          <div className="text-center space-y-6">
            <Calendar className="w-16 h-16 mx-auto text-white/80" />
            <p className="text-xl text-white/80">Your hottest month was</p>
            <h2 className="text-5xl sm:text-7xl font-bold text-white">
              {stats.bestMonth.name}
            </h2>
            <p className="text-2xl text-white/90">
              with {stats.bestMonth.count} moments
            </p>
          </div>
        )
      },
      // Longest streak
      {
        id: 'streak',
        bg: 'bg-gradient-to-br from-amber-500 via-orange-500 to-red-500',
        content: (
          <div className="text-center space-y-6">
            <Trophy className="w-16 h-16 mx-auto text-white/80" />
            <p className="text-xl text-white/80">Your longest streak was</p>
            <h2 className="text-7xl sm:text-9xl font-bold text-white">
              {stats.longestStreak}
            </h2>
            <p className="text-2xl text-white/90">
              consecutive weeks
            </p>
            <p className="text-lg text-white/70">
              That's {stats.activeWeeks} active weeks total
            </p>
          </div>
        )
      },
      // Time of day
      stats.timeOfDayRanking.length > 0 && {
        id: 'time-of-day',
        bg: 'bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500',
        content: (() => {
          const TopIcon = TIME_BUCKETS[stats.timeOfDayRanking[0].key]?.Icon || Moon;
          return (
            <div className="text-center space-y-6">
              <TopIcon className="w-16 h-16 mx-auto text-white/80" />
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                {TIME_BUCKETS[stats.timeOfDayRanking[0].key]?.statement || `${stats.timeOfDayRanking[0].label} is your time.`}
              </h2>
              <div className="space-y-3 max-w-xs mx-auto">
                {stats.timeOfDayRanking.slice(1).map((slot, i) => {
                  const SlotIcon = TIME_BUCKETS[slot.key]?.Icon || Moon;
                  return (
                    <div key={slot.key} className="flex items-center gap-3 text-white/80">
                      <span className="text-2xl">{i + 2}.</span>
                      <SlotIcon className="w-5 h-5" />
                      <span className="text-lg flex-1 text-left">{slot.label}</span>
                      <span className="text-sm opacity-70">{slot.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()
      },
      // Top emojis
      stats.topEmojis.length > 0 && {
        id: 'emojis',
        bg: 'bg-gradient-to-br from-pink-500 via-rose-500 to-red-500',
        content: (
          <div className="text-center space-y-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              {stats.topEmojis[0].emoji} is your signature move
            </h2>
            <div className="space-y-3 max-w-xs mx-auto mt-8">
              {stats.topEmojis.slice(1).map((item, i) => (
                <div key={item.emoji} className="flex items-center gap-4 text-white/80">
                  <span className="text-2xl w-6 text-right">{i + 2}.</span>
                  <span className="text-3xl">{item.emoji}</span>
                  <span className="text-sm opacity-70">{item.count}</span>
                </div>
              ))}
            </div>
            <p className="text-lg text-white/70 mt-6">
              {stats.emojiVariety} different vibes explored
            </p>
          </div>
        )
      },
      // Bunny days
      (stats.doubleDays > 0 || stats.tripleDays > 0) && {
        id: 'bunny-days',
        bg: 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500',
        content: (
          <div className="text-center space-y-6">
            <Rabbit className="w-16 h-16 mx-auto text-white/80" />
            <p className="text-xl text-white/80">Some days were extra special</p>
            {stats.tripleDays > 0 && (
              <div>
                <h2 className="text-6xl sm:text-7xl font-bold text-white">
                  {stats.tripleDays}
                </h2>
                <p className="text-xl text-white/90">triple days 🐰🐰🐰</p>
              </div>
            )}
            {stats.doubleDays > 0 && (
              <div className={stats.tripleDays > 0 ? "mt-4" : ""}>
                <h2 className={stats.tripleDays > 0 ? "text-5xl font-bold text-white" : "text-6xl sm:text-7xl font-bold text-white"}>
                  {stats.doubleDays}
                </h2>
                <p className="text-xl text-white/90">double days 🐰🐰</p>
              </div>
            )}
          </div>
        )
      },
      // Outro
      {
        id: 'outro',
        bg: 'bg-gradient-to-br from-primary via-primary/80 to-accent',
        content: (
          <div className="text-center space-y-6">
            <div className="text-6xl">❤️</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground">
              Here's to another year
            </h2>
            <p className="text-xl text-primary-foreground/80">
              of love, laughter and most importantly, {partnerName}
            </p>
            <p className="text-5xl font-bold text-primary-foreground mt-8">
              {reviewYear + 1}
            </p>
          </div>
        )
      }
    ].filter(Boolean) as { id: string; bg: string; content: JSX.Element }[];

    return slideList;
  }, [stats, reviewYear, partnerName]);

  const goToSlide = (index: number) => {
    if (isAnimating || index < 0 || index >= slides.length) return;
    setIsAnimating(true);
    setCurrentSlide(index);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const nextSlide = () => goToSlide(currentSlide + 1);
  const prevSlide = () => goToSlide(currentSlide - 1);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      else if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, slides.length, isAnimating]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Sparkles className="w-12 h-12 mx-auto text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading your year...</p>
        </div>
      </div>
    );
  }

  if (!stats || yearActivities.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-bold">No moments found</h2>
            <p className="text-muted-foreground">
              You don't have any logged moments in {reviewYear} to review.
            </p>
            <Button onClick={() => navigate('/')}>
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Slides */}
      <div 
        className={cn(
          "min-h-screen flex items-center justify-center p-6 transition-all duration-500",
          slides[currentSlide]?.bg
        )}
      >
        <div className={cn(
          "max-w-lg w-full transition-opacity duration-300",
          isAnimating ? "opacity-0" : "opacity-100"
        )}>
          {slides[currentSlide]?.content}
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-4">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                i === currentSlide 
                  ? "bg-white w-6" 
                  : "bg-white/40 hover:bg-white/60"
              )}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="text-white hover:bg-white/20 disabled:opacity-30"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-white hover:bg-white/20"
          >
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={nextSlide}
            disabled={currentSlide === slides.length - 1}
            className="text-white hover:bg-white/20 disabled:opacity-30"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Tap zones for mobile */}
      <div 
        className="fixed left-0 top-0 w-1/3 h-full z-10 cursor-pointer"
        onClick={prevSlide}
      />
      <div 
        className="fixed right-0 top-0 w-1/3 h-full z-10 cursor-pointer"
        onClick={nextSlide}
      />
    </div>
  );
}
