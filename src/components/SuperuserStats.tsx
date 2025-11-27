import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Users, Heart, Mail, Activity, Send } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StatsData {
  date: string;
  profiles: number;
  invitations: number;
  couples: number;
  activities: number;
}

interface Couple {
  id: string;
  user1_email: string;
  user2_email: string;
}

export default function SuperuserStats() {
  const [statsData, setStatsData] = useState<StatsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [selectedCouple, setSelectedCouple] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
    fetchCouples();
    checkForNewSignups();
  }, []);

  const fetchCouples = async () => {
    try {
      const { data: couplesData, error } = await supabase
        .from('couples')
        .select('id, user1_id, user2_id');
      
      if (error) throw error;
      
      // Get emails for each couple
      const couplesWithEmails = await Promise.all(
        (couplesData || []).map(async (couple) => {
          const [user1, user2] = await Promise.all([
            supabase.auth.admin.getUserById(couple.user1_id),
            supabase.auth.admin.getUserById(couple.user2_id),
          ]);
          
          return {
            id: couple.id,
            user1_email: user1.data.user?.email || 'Unknown',
            user2_email: user2.data.user?.email || 'Unknown',
          };
        })
      );
      
      setCouples(couplesWithEmails);
    } catch (error) {
      console.error("Error fetching couples:", error);
    }
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

      // Check for new profiles
      const { count: newProfiles } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gt("created_at", lastCheckTime);

      // Check for new couples
      const { count: newCouples } = await supabase
        .from("couples")
        .select("*", { count: "exact", head: true })
        .gt("created_at", lastCheckTime);

      if ((newProfiles || 0) > 0 || (newCouples || 0) > 0) {
        toast({
          title: "New Activity! 🎉",
          description: `${newProfiles || 0} new user(s) and ${newCouples || 0} new couple(s) since your last visit!`,
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
      const days = 30;
      const dateArray = Array.from({ length: days }, (_, i) => {
        const date = subDays(new Date(), days - 1 - i);
        return startOfDay(date).toISOString();
      });

      const statsPromises = dateArray.map(async (date) => {
        const nextDay = startOfDay(new Date(new Date(date).getTime() + 86400000)).toISOString();

        const [profiles, invitations, couples, activities] = await Promise.all([
          supabase
            .from("profiles")
            .select("id", { count: "exact" })
            .lt("created_at", nextDay),
          supabase
            .from("couple_invitations")
            .select("id", { count: "exact" })
            .lt("created_at", nextDay),
          supabase
            .from("couples")
            .select("id", { count: "exact" })
            .lt("created_at", nextDay),
          supabase
            .from("activities")
            .select("id", { count: "exact" })
            .lt("activity_date", nextDay),
        ]);

        return {
          date: format(new Date(date), "MMM dd"),
          profiles: profiles.count || 0,
          invitations: invitations.count || 0,
          couples: couples.count || 0,
          activities: activities.count || 0,
        };
      });

      const stats = await Promise.all(statsPromises);
      console.log("Stats data:", stats);
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

  const handleSendDigest = async () => {
    try {
      setSendingDigest(true);
      
      const body = selectedCouple ? { couple_id: selectedCouple } : undefined;
      const { data, error } = await supabase.functions.invoke("send-digest-manual", { body });
      
      if (error) throw error;
      
      toast({
        title: "Digest Sent",
        description: selectedCouple 
          ? `Successfully sent digest to selected couple`
          : `Successfully sent ${data?.sent || 0} digest emails`,
      });
      
      console.log("Digest result:", data);
    } catch (error) {
      console.error("Error sending digest:", error);
      toast({
        title: "Error",
        description: "Failed to send digest emails",
        variant: "destructive",
      });
    } finally {
      setSendingDigest(false);
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Weekly Digest Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Couple (optional)</label>
            <Select value={selectedCouple} onValueChange={setSelectedCouple}>
              <SelectTrigger>
                <SelectValue placeholder="All couples" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All couples</SelectItem>
                {couples.map((couple) => (
                  <SelectItem key={couple.id} value={couple.id}>
                    {couple.user1_email} & {couple.user2_email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleSendDigest}
            disabled={sendingDigest}
            className="w-full"
          >
            {sendingDigest ? "Sending..." : selectedCouple ? "Send to Selected Couple" : "Send to All"}
          </Button>
        </CardContent>
      </Card>

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
    </div>
  );
}