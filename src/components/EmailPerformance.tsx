import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Mail, CheckCircle, MousePointer, AlertTriangle, Eye, Send, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const tooltips = {
  sent: "Total emails sent through the system. Logged when the send request is made to Resend.",
  delivered: "Emails that successfully reached the recipient's inbox, confirmed by the email provider.",
  deliveryRate: "Percentage of sent emails that were delivered. A healthy rate is typically above 95%.",
  openRate: "Percentage of delivered emails that were opened. Note: may be underreported due to email client privacy settings.",
  clickRate: "Percentage of delivered emails where the user clicked the CTA link to open the app.",
  bounced: "Emails that couldn't be delivered due to invalid addresses, full inboxes, or server issues. High bounce rates hurt sender reputation.",
  complaints: "Users who marked the email as spam. Keep this below 0.1% to avoid domain blacklisting."
};

interface StatCardProps {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  tooltip: string;
  valueClassName?: string;
}

const StatCard = ({ icon, label, value, tooltip, valueClassName }: StatCardProps) => (
  <Card>
    <CardContent className="pt-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {icon}
        <span>{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 cursor-help opacity-50 hover:opacity-100 transition-opacity" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className={`text-2xl font-bold ${valueClassName || ""}`}>{value}</div>
    </CardContent>
  </Card>
);
interface Summary {
  totals: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    complaintRate: number;
  };
  breakdown: Array<{
    type: string;
    variantKey: string | null;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
  }>;
}

interface RecentEmail {
  sentAt: string;
  userId: string;
  type: string;
  variantKey: string | null;
  subject: string;
  messageId: string;
  status: string;
  opened: boolean;
  clicked: boolean;
}

interface Couple {
  id: string;
  user1_name: string;
  user2_name: string;
}

type SendEmailType = "weekly-digest" | "midweek-nudge";

export default function EmailPerformance() {
  const [range, setRange] = useState("30d");
  const [emailType, setEmailType] = useState("all");
  const [variant, setVariant] = useState("all");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<RecentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [selectedCouple, setSelectedCouple] = useState<string>("all");
  const [sendEmailType, setSendEmailType] = useState<SendEmailType>("weekly-digest");
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const headers = { Authorization: `Bearer ${session.access_token}` };

      // Fetch summary
      const summaryRes = await fetch(
        `https://uuijigmwkpmakltymkqe.supabase.co/functions/v1/email-metrics?action=summary&range=${range}&type=${emailType}&variant=${variant}`,
        { headers }
      );
      if (!summaryRes.ok) throw new Error("Failed to fetch summary");
      const summaryData = await summaryRes.json();
      setSummary(summaryData);

      // Fetch recent
      const recentRes = await fetch(
        `https://uuijigmwkpmakltymkqe.supabase.co/functions/v1/email-metrics?action=recent&limit=50`,
        { headers }
      );
      if (!recentRes.ok) throw new Error("Failed to fetch recent");
      const recentData = await recentRes.json();
      setRecent(recentData);

    } catch (error) {
      console.error("Error fetching email metrics:", error);
      toast({
        title: "Error",
        description: "Failed to load email metrics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchCouples();
  }, [range, emailType, variant]);

  const fetchCouples = async () => {
    try {
      const { data: couplesData, error } = await supabase
        .from('couples')
        .select('id, user1_id, user2_id');
      
      if (error) throw error;
      
      const userIds = (couplesData || []).flatMap(c => [c.user1_id, c.user2_id]);
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);
      
      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, p.name || 'Unknown'])
      );
      
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

  const handleSendEmail = async () => {
    try {
      setSendingEmail(true);
      
      const functionName = sendEmailType === "weekly-digest" 
        ? "send-digest-manual" 
        : "send-midweek-nudge-manual";
      
      const body = selectedCouple !== "all" ? { couple_id: selectedCouple } : undefined;
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      
      if (error) throw error;
      
      const emailLabel = sendEmailType === "weekly-digest" ? "Weekly Digest" : "Mid-week Nudge";
      
      toast({
        title: `${emailLabel} Sent`,
        description: selectedCouple !== "all"
          ? `Successfully sent ${emailLabel.toLowerCase()} to selected couple`
          : `Successfully sent ${data?.successful || data?.sent || 0} ${emailLabel.toLowerCase()} emails`,
      });
      
      console.log("Email result:", data);
      fetchData(); // Refresh the data after sending
    } catch (error) {
      console.error("Error sending email:", error);
      toast({
        title: "Error",
        description: `Failed to send ${sendEmailType === "weekly-digest" ? "digest" : "nudge"} emails`,
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const formatPercent = (val: number) => `${(val * 100).toFixed(1)}%`;
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600">Delivered</Badge>;
      case "bounced":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600">Bounced</Badge>;
      case "complained":
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-600">Complained</Badge>;
      default:
        return <Badge variant="outline">Sent</Badge>;
    }
  };

  if (loading && !summary) {
    return <div className="p-4 text-muted-foreground">Loading email metrics...</div>;
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Send Email Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="mb-2 block">Email Type</Label>
                <Select value={sendEmailType} onValueChange={(v) => setSendEmailType(v as SendEmailType)}>
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
              <div className="flex items-end">
                <Button 
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="w-full"
                >
                  {sendingEmail 
                    ? "Sending..." 
                    : selectedCouple !== "all" 
                      ? `Send ${sendEmailType === "weekly-digest" ? "Digest" : "Nudge"} to Selected` 
                      : `Send ${sendEmailType === "weekly-digest" ? "Digest" : "Nudge"} to All`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Header Controls */}
        <div className="flex flex-wrap gap-4 items-center">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={emailType} onValueChange={setEmailType}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="digest">Weekly Digest</SelectItem>
              <SelectItem value="digest-nystart">Nystart Digest</SelectItem>
              <SelectItem value="midweek-nudge">Midweek Nudge</SelectItem>
            </SelectContent>
          </Select>

          {emailType === "midweek-nudge" && (
            <Select value={variant} onValueChange={setVariant}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="B">B</SelectItem>
                <SelectItem value="C">C</SelectItem>
                <SelectItem value="D">D</SelectItem>
                <SelectItem value="E">E</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Button onClick={fetchData} variant="outline" size="icon" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* KPI Tiles */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <StatCard 
              icon={<Mail className="h-4 w-4" />}
              label="Sent"
              value={summary.totals.sent}
              tooltip={tooltips.sent}
            />
            <StatCard 
              icon={<CheckCircle className="h-4 w-4" />}
              label="Delivered"
              value={summary.totals.delivered}
              tooltip={tooltips.delivered}
            />
            <StatCard 
              label="Delivery Rate"
              value={formatPercent(summary.totals.deliveryRate)}
              tooltip={tooltips.deliveryRate}
            />
            <StatCard 
              icon={<Eye className="h-4 w-4" />}
              label="Open Rate"
              value={formatPercent(summary.totals.openRate)}
              tooltip={tooltips.openRate}
            />
            <StatCard 
              icon={<MousePointer className="h-4 w-4" />}
              label="Click Rate"
              value={formatPercent(summary.totals.clickRate)}
              tooltip={tooltips.clickRate}
            />
            <StatCard 
              label="Bounced"
              value={summary.totals.bounced}
              tooltip={tooltips.bounced}
              valueClassName="text-red-600"
            />
            <StatCard 
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Complaints"
              value={summary.totals.complained}
              tooltip={tooltips.complaints}
              valueClassName="text-orange-600"
            />
          </div>
        )}

      {/* Breakdown Table */}
      {summary && summary.breakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance by Type & Variant</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                  <TableHead className="text-right">Clicked</TableHead>
                  <TableHead className="text-right">Click Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.breakdown.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.variantKey || "-"}</TableCell>
                    <TableCell className="text-right">{row.sent}</TableCell>
                    <TableCell className="text-right">{row.delivered}</TableCell>
                    <TableCell className="text-right">{row.opened}</TableCell>
                    <TableCell className="text-right">{row.clicked}</TableCell>
                    <TableCell className="text-right font-medium">{formatPercent(row.clickRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Emails (Last 50)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Clicked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((email, i) => (
                <TableRow key={i}>
                  <TableCell>{formatDate(email.sentAt)}</TableCell>
                  <TableCell>{email.type}</TableCell>
                  <TableCell>{email.variantKey || "-"}</TableCell>
                  <TableCell>{getStatusBadge(email.status)}</TableCell>
                  <TableCell>{email.opened ? "✓" : "-"}</TableCell>
                  <TableCell>{email.clicked ? "✓" : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
