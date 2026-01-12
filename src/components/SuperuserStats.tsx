import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Users, Heart, Mail, Activity, BarChart3, TrendingUp, FlaskConical } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmailPerformance from "@/components/EmailPerformance";
import FunnelAnalytics from "@/components/FunnelAnalytics";
import TestUserManager from "@/components/TestUserManager";

interface StatsData {
  date: string;
  profiles: number;
  invitations: number;
  couples: number;
  activities: number;
}

export default function SuperuserStats() {
  const [statsData, setStatsData] = useState<StatsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [testUserIds, setTestUserIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchTestUsers().then(() => {
      fetchStats();
      checkForNewSignups();
    });
  }, []);

  const fetchTestUsers = async () => {
    const { data: testRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "test_user");
    
    setTestUserIds(new Set(testRoles?.map(r => r.user_id) || []));
  };

  const checkForNewSignups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get last check time
      const { data: lastCheck } = await supabase
        .from("superuser_last_check")
        .select("last_check_at")
        .eq("user_id", user.id)
        .maybeSingle();

      const lastCheckTime = lastCheck?.last_check_at || new Date(0).toISOString();

      // Check for new profiles (excluding test users)
      const { data: newProfilesData } = await supabase
        .from("profiles")
        .select("user_id")
        .gt("created_at", lastCheckTime);
      
      const newProfiles = newProfilesData?.filter(p => !testUserIds.has(p.user_id)).length || 0;

      // Check for new couples (excluding test users)
      const { data: newCouplesData } = await supabase
        .from("couples")
        .select("user1_id, user2_id")
        .gt("created_at", lastCheckTime);
      
      const newCouples = newCouplesData?.filter(
        c => !testUserIds.has(c.user1_id) && !testUserIds.has(c.user2_id)
      ).length || 0;

      if (newProfiles > 0 || newCouples > 0) {
        toast({
          title: "New Activity! 🎉",
          description: `${newProfiles} new user(s) and ${newCouples} new couple(s) since your last visit!`,
        });
      }

      // Update last check time
      await supabase
        .from("superuser_last_check")
        .upsert({
          user_id: user.id,
          last_check_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error("Error checking for new signups:", error);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Get fresh test user IDs
      const { data: testRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "test_user");
      
      const currentTestUserIds = new Set(testRoles?.map(r => r.user_id) || []);

      const days = 30;
      const dateArray = Array.from({ length: days }, (_, i) => {
        const date = subDays(new Date(), days - 1 - i);
        return startOfDay(date).toISOString();
      });

      const statsPromises = dateArray.map(async (date) => {
        const nextDay = startOfDay(new Date(new Date(date).getTime() + 86400000)).toISOString();

        // Fetch all data then filter out test users
        const [profilesRes, invitationsRes, couplesRes, activitiesRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("user_id")
            .lt("created_at", nextDay),
          supabase
            .from("couple_invitations")
            .select("sender_id")
            .lt("created_at", nextDay),
          supabase
            .from("couples")
            .select("user1_id, user2_id")
            .lt("created_at", nextDay),
          supabase
            .from("activities")
            .select("user_id")
            .lt("activity_date", nextDay),
        ]);

        // Filter out test users
        const profiles = profilesRes.data?.filter(p => !currentTestUserIds.has(p.user_id)).length || 0;
        const invitations = invitationsRes.data?.filter(i => !currentTestUserIds.has(i.sender_id)).length || 0;
        const couples = couplesRes.data?.filter(
          c => !currentTestUserIds.has(c.user1_id) && !currentTestUserIds.has(c.user2_id)
        ).length || 0;
        const activities = activitiesRes.data?.filter(a => !currentTestUserIds.has(a.user_id)).length || 0;

        return {
          date: format(new Date(date), "MMM dd"),
          profiles,
          invitations,
          couples,
          activities,
        };
      });

      const stats = await Promise.all(statsPromises);
      setStatsData(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast({
        title: "Error",
        description: "Failed to load superuser stats",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading superuser stats...</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="funnel" className="space-y-6">
      <TabsList>
        <TabsTrigger value="funnel" className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Funnel
        </TabsTrigger>
        <TabsTrigger value="stats" className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Stats
        </TabsTrigger>
        <TabsTrigger value="email" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Email
        </TabsTrigger>
        <TabsTrigger value="users" className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          Users
        </TabsTrigger>
      </TabsList>

      <TabsContent value="funnel">
        <FunnelAnalytics />
      </TabsContent>

      <TabsContent value="users">
        <TestUserManager />
      </TabsContent>

      <TabsContent value="stats" className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Profiles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={statsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="profiles"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Invitations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={statsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="invitations"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Couples
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={statsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="couples"
                    stroke="hsl(var(--chart-3))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={statsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="activities"
                    stroke="hsl(var(--chart-4))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="email">
        <EmailPerformance />
      </TabsContent>
    </Tabs>
  );
}