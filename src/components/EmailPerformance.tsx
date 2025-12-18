import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Mail, CheckCircle, MousePointer, AlertTriangle, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

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

export default function EmailPerformance() {
  const [range, setRange] = useState("30d");
  const [emailType, setEmailType] = useState("all");
  const [variant, setVariant] = useState("all");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<RecentEmail[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, [range, emailType, variant]);

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
    <div className="space-y-6">
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
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Mail className="h-4 w-4" /> Sent
              </div>
              <div className="text-2xl font-bold">{summary.totals.sent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <CheckCircle className="h-4 w-4" /> Delivered
              </div>
              <div className="text-2xl font-bold">{summary.totals.delivered}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-muted-foreground text-sm">Delivery Rate</div>
              <div className="text-2xl font-bold">{formatPercent(summary.totals.deliveryRate)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Eye className="h-4 w-4" /> Open Rate
              </div>
              <div className="text-2xl font-bold">{formatPercent(summary.totals.openRate)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <MousePointer className="h-4 w-4" /> Click Rate
              </div>
              <div className="text-2xl font-bold">{formatPercent(summary.totals.clickRate)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-muted-foreground text-sm">Bounced</div>
              <div className="text-2xl font-bold text-red-600">{summary.totals.bounced}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <AlertTriangle className="h-4 w-4" /> Complaints
              </div>
              <div className="text-2xl font-bold text-orange-600">{summary.totals.complained}</div>
            </CardContent>
          </Card>
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
  );
}
