import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Users, Heart, Mail, Activity, Send } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface StatsData {
  date: string;
  profiles: number;
  invitations: number;
  couples: number;
  activities: number;
}

interface Couple {
  id: string;
  user1_name: string;
  user2_name: string;
}

type EmailType = "weekly-digest" | "midweek-nudge";

export default function SuperuserStats() {
  const [statsData, setStatsData] = useState<StatsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [selectedCouple, setSelectedCouple] = useState<string>("all");
  const [emailType, setEmailType] = useState<EmailType>("weekly-digest");
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
    fetchCouples();
    checkForNewSignups();
  }, []);

  const fetchCouples = async () => {
    try {
      // Get couples with user IDs
      const { data: couplesData, error } = await supabase
        .from('couples')
        .select('id, user1_id, user2_id');
      
      if (error) throw error;
      
      // Get all profile data (including names from profiles)
      const userIds = (couplesData || []).flatMap(c => [c.user1_id, c.user2_id]);
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);
      
      // Map profiles by user_id for quick lookup
      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, p.name || 'Unknown'])
      );
      
      // Build couples list with names
      const couplesWithNames = (couplesData || []).map(couple => ({
        id: couple.id,
        user1_name: profileMap.get(couple.user1_id) || 'Unknown',
        user2_name: profileMap.get(couple.user2_id) || 'Unknown',
      }));
      
      setCouples(couplesWithNames);
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

  const handleSendEmail = async () => {
    try {
      setSendingEmail(true);
      
      const functionName = emailType === "weekly-digest" 
        ? "send-digest-manual" 
        : "send-midweek-nudge-manual";
      
      const body = selectedCouple !== "all" ? { couple_id: selectedCouple } : undefined;
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      
      if (error) throw error;
      
      const emailLabel = emailType === "weekly-digest" ? "Weekly Digest" : "Mid-week Nudge";
      
      toast({
        title: `${emailLabel} Sent`,
        description: selectedCouple !== "all"
          ? `Successfully sent ${emailLabel.toLowerCase()} to selected couple`
          : `Successfully sent ${data?.successful || data?.sent || 0} ${emailLabel.toLowerCase()} emails`,
      });
      
      console.log("Email result:", data);
    } catch (error) {
      console.error("Error sending email:", error);
      toast({
        title: "Error",
        description: `Failed to send ${emailType === "weekly-digest" ? "digest" : "nudge"} emails`,
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
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
            Send Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Email Type</Label>
            <Select value={emailType} onValueChange={(v) => setEmailType(v as EmailType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly-digest">Weekly Digest (Saturday)</SelectItem>
                <SelectItem value="midweek-nudge">Mid-week Nudge (Wednesday)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Select Couple (optional)</Label>
            <Select value={selectedCouple} onValueChange={setSelectedCouple}>
              <SelectTrigger>
                <SelectValue placeholder="All couples" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All couples</SelectItem>
                {couples.map((couple) => (
                  <SelectItem key={couple.id} value={couple.id}>
                    {couple.user1_name} & {couple.user2_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleSendEmail}
            disabled={sendingEmail}
            className="w-full"
          >
            {sendingEmail 
              ? "Sending..." 
              : selectedCouple !== "all" 
                ? `Send ${emailType === "weekly-digest" ? "Digest" : "Nudge"} to Selected` 
                : `Send ${emailType === "weekly-digest" ? "Digest" : "Nudge"} to All`}
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