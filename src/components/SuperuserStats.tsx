import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Users, Heart, Mail, Activity, Bell, Loader2 } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

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
  const [testEmail, setTestEmail] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
    checkForNewSignups();
  }, []);

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

  const handleTestNotification = async () => {
    if (!testEmail) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-notification', {
        body: { 
          targetEmail: testEmail,
          message: testMessage || undefined,
          type: 'test'
        }
      });

      console.log('Test notification response:', data, error);

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        toast({
          title: "Test Failed",
          description: `${data.error}: ${data.details || ''}`,
          variant: "destructive",
        });
        if (data.diagnostics) {
          console.log('Diagnostics:', data.diagnostics);
        }
      } else {
        toast({
          title: "Test Notification Sent",
          description: data?.message || "Notification sent successfully",
        });
        setTestDialogOpen(false);
        setTestEmail("");
        setTestMessage("");
      }
    } catch (error: any) {
      console.error("Error sending test notification:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send test notification",
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
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
      {/* Test Notification Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Testing
          </CardTitle>
          <CardDescription>
            Send test notifications to users (bypasses all fallback rules)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Bell className="w-4 h-4 mr-2" />
                Send Test Notification
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Test Notification</DialogTitle>
                <DialogDescription>
                  Send a push notification to any user for testing purposes.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="testEmail">User Email</Label>
                  <Input
                    id="testEmail"
                    type="email"
                    placeholder="user@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="testMessage">Custom Message (optional)</Label>
                  <Input
                    id="testMessage"
                    placeholder="Leave empty for default test message"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleTestNotification} 
                  disabled={sendingTest}
                  className="w-full"
                >
                  {sendingTest ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4 mr-2" />
                      Send Test
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
