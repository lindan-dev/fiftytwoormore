import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to check if user is superuser
async function isSuperuser(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "superuser")
    .maybeSingle();
  return !!data;
}

// Get date range based on range param
function getDateRange(range: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  
  switch (range) {
    case "7d":
      start.setDate(end.getDate() - 7);
      break;
    case "30d":
      start.setDate(end.getDate() - 30);
      break;
    case "90d":
      start.setDate(end.getDate() - 90);
      break;
    default:
      start.setDate(end.getDate() - 30);
  }
  
  return { start, end };
}

// Summary endpoint
async function getSummary(supabase: any, range: string, emailType?: string, variant?: string) {
  const { start } = getDateRange(range);
  
  let query = supabase
    .from("email_events")
    .select("type, variant_key, event")
    .gte("event_at", start.toISOString());
  
  if (emailType && emailType !== "all") {
    query = query.eq("type", emailType);
  }
  
  if (variant && variant !== "all") {
    query = query.eq("variant_key", variant);
  }
  
  const { data: events, error } = await query;
  
  if (error) throw error;
  
  // Aggregate by type and variant
  const aggregated: Record<string, Record<string, number>> = {};
  
  for (const event of events || []) {
    const key = `${event.type}|${event.variant_key || "none"}`;
    if (!aggregated[key]) {
      aggregated[key] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 };
    }
    aggregated[key][event.event]++;
  }
  
  // Calculate totals
  const totals = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 };
  const breakdown: any[] = [];
  
  for (const [key, counts] of Object.entries(aggregated)) {
    const [type, variantKey] = key.split("|");
    
    totals.sent += counts.sent || 0;
    totals.delivered += counts.delivered || 0;
    totals.opened += counts.opened || 0;
    totals.clicked += counts.clicked || 0;
    totals.bounced += counts.bounced || 0;
    totals.complained += counts.complained || 0;
    
    const delivered = counts.delivered || 0;
    breakdown.push({
      type,
      variantKey: variantKey === "none" ? null : variantKey,
      sent: counts.sent || 0,
      delivered,
      opened: counts.opened || 0,
      clicked: counts.clicked || 0,
      bounced: counts.bounced || 0,
      complained: counts.complained || 0,
      deliveryRate: counts.sent > 0 ? delivered / counts.sent : 0,
      openRate: delivered > 0 ? (counts.opened || 0) / delivered : 0,
      clickRate: delivered > 0 ? (counts.clicked || 0) / delivered : 0,
      complaintRate: delivered > 0 ? (counts.complained || 0) / delivered : 0
    });
  }
  
  // Sort by clickRate desc
  breakdown.sort((a, b) => b.clickRate - a.clickRate);
  
  const delivered = totals.delivered || 0;
  return {
    totals: {
      ...totals,
      deliveryRate: totals.sent > 0 ? delivered / totals.sent : 0,
      openRate: delivered > 0 ? totals.opened / delivered : 0,
      clickRate: delivered > 0 ? totals.clicked / delivered : 0,
      complaintRate: delivered > 0 ? totals.complained / delivered : 0
    },
    breakdown
  };
}

// Timeseries endpoint
async function getTimeseries(supabase: any, range: string, groupBy: string, emailType?: string) {
  const { start } = getDateRange(range);
  
  let query = supabase
    .from("email_events")
    .select("event_at, event, type")
    .gte("event_at", start.toISOString())
    .order("event_at", { ascending: true });
  
  if (emailType && emailType !== "all") {
    query = query.eq("type", emailType);
  }
  
  const { data: events, error } = await query;
  
  if (error) throw error;
  
  // Group by time bucket
  const buckets: Record<string, Record<string, number>> = {};
  
  for (const event of events || []) {
    const date = new Date(event.event_at);
    let bucketKey: string;
    
    if (groupBy === "week") {
      // Get start of week (Monday)
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date);
      monday.setDate(diff);
      bucketKey = monday.toISOString().split("T")[0];
    } else {
      bucketKey = date.toISOString().split("T")[0];
    }
    
    if (!buckets[bucketKey]) {
      buckets[bucketKey] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 };
    }
    buckets[bucketKey][event.event]++;
  }
  
  // Convert to array
  return Object.entries(buckets)
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Recent emails endpoint
async function getRecent(supabase: any, limit: number) {
  const { data: logs, error } = await supabase
    .from("email_digest_log")
    .select("user_id, sent_at, type, variant_key, subject, message_id")
    .order("sent_at", { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  
  // Get events for these messages
  const messageIds = (logs || []).map((l: any) => l.message_id).filter(Boolean);
  
  let eventsMap: Record<string, Set<string>> = {};
  
  if (messageIds.length > 0) {
    const { data: events } = await supabase
      .from("email_events")
      .select("message_id, event")
      .in("message_id", messageIds);
    
    for (const event of events || []) {
      if (!eventsMap[event.message_id]) {
        eventsMap[event.message_id] = new Set();
      }
      eventsMap[event.message_id].add(event.event);
    }
  }
  
  return (logs || []).map((log: any) => {
    const events = eventsMap[log.message_id] || new Set();
    
    // Determine status priority: complained > bounced > delivered > sent
    let status = "sent";
    if (events.has("complained")) status = "complained";
    else if (events.has("bounced")) status = "bounced";
    else if (events.has("delivered")) status = "delivered";
    
    return {
      sentAt: log.sent_at,
      userId: log.user_id ? `${log.user_id.slice(0, 8)}...` : "unknown",
      type: log.type,
      variantKey: log.variant_key,
      subject: log.subject,
      messageId: log.message_id,
      status,
      opened: events.has("opened"),
      clicked: events.has("clicked")
    };
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify admin access via Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    // Check superuser role
    const isAdmin = await isSuperuser(supabase, user.id);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden - Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "summary";
    const range = url.searchParams.get("range") || "30d";
    const emailType = url.searchParams.get("type") || "all";
    const variant = url.searchParams.get("variant") || "all";
    const groupBy = url.searchParams.get("groupBy") || (range === "90d" ? "week" : "day");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    
    let result;
    
    switch (action) {
      case "summary":
        result = await getSummary(supabase, range, emailType, variant);
        break;
      case "timeseries":
        result = await getTimeseries(supabase, range, groupBy, emailType);
        break;
      case "recent":
        result = await getRecent(supabase, limit);
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    }
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
    
  } catch (error) {
    console.error("Error in email-metrics:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );
  }
};

serve(handler);
