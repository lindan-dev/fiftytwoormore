// Pure logic for the admin daily digest: funnel counts, median timings and the email
// body. No imports and no I/O, so it can be unit-tested outside Deno.
// Contains stage names and timestamps only, never activity content.

export interface FunnelRow {
  user_id: string;
  email: string | null;
  name: string | null;
  created_at: string;
  email_confirmed_at: string | null;
  onboarded_at: string | null;
  invite_created_at: string | null;
  connected_at: string | null;
  first_activity_at: string | null;
  last_activity_at: string | null;
  activity_count: number;
  active_week2: boolean;
  has_push_token: boolean;
  stage: string;
  stage_rank: number;
}

export interface StuckRow {
  user_id: string;
  email: string | null;
  name: string | null;
  rule: string;
  since: string;
}

export const STAGES: { key: string; label: string; reached: (r: FunnelRow) => boolean }[] = [
  { key: "created", label: "Account created", reached: () => true },
  { key: "confirmed", label: "Email confirmed", reached: (r) => !!r.email_confirmed_at },
  {
    key: "onboarded",
    label: "Opened the app",
    // Connecting or logging implies the app was opened (covers users from before onboarding was tracked).
    reached: (r) => !!(r.onboarded_at || r.connected_at || r.first_activity_at),
  },
  { key: "connected", label: "Connected with partner", reached: (r) => !!r.connected_at },
  { key: "first_activity", label: "Logged a first moment", reached: (r) => !!r.first_activity_at },
  { key: "active_week2", label: "Still active a week later", reached: (r) => r.active_week2 },
];

export const RULE_LABELS: Record<string, string> = {
  unconfirmed_24h: "Created an account but never confirmed their email (24h+)",
  not_connected_3d: "Confirmed, but no partner connected (3 days+)",
  no_activity_7d: "Connected, but no activity since (7 days+)",
  lapsed_14d: "Went quiet: no activity for 14 days+",
};

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function displayName(r: { name: string | null; email: string | null }): string {
  if (r.name && r.email) return `${r.name} (${r.email})`;
  return r.name || r.email || "unknown user";
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function fmtDuration(hours: number | null): string {
  if (hours === null) return "n/a";
  if (hours < 1) return "under 1 h";
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} d`;
}

function pct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}

export function computeFunnel(rows: FunnelRow[]) {
  return STAGES.map((s) => {
    const users = rows.filter(s.reached).length;
    return { key: s.key, label: s.label, users, pct: pct(users, rows.length) };
  });
}

function hoursBetween(from: string, to: string): number {
  return Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / HOUR);
}

export function computeTimings(rows: FunnelRow[]) {
  const col = (pick: (r: FunnelRow) => string | null) =>
    rows.flatMap((r) => {
      const t = pick(r);
      return t ? [hoursBetween(r.created_at, t)] : [];
    });
  return {
    confirm: median(col((r) => r.email_confirmed_at)),
    connect: median(col((r) => r.connected_at)),
    firstActivity: median(col((r) => r.first_activity_at)),
  };
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function ageDays(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);
}

export interface DigestInput {
  rows: FunnelRow[];
  newAlerts: StuckRow[];
  stuckTotal: number;
  now: Date;
}

export function buildDigest({ rows, newAlerts, stuckTotal, now }: DigestInput) {
  const since24 = now.getTime() - DAY;
  const since7 = now.getTime() - 7 * DAY;
  const newToday = rows.filter((r) => new Date(r.created_at).getTime() >= since24);
  const last7 = rows.filter((r) => new Date(r.created_at).getTime() >= since7);
  const allFunnel = computeFunnel(rows);
  const weekFunnel = computeFunnel(last7);
  const timings = computeTimings(rows);

  const stageLabel = (key: string) => STAGES.find((s) => s.key === key)?.label ?? key;
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  const byRule = new Map<string, StuckRow[]>();
  for (const a of newAlerts) byRule.set(a.rule, [...(byRule.get(a.rule) ?? []), a]);

  const subject =
    `fiftytwoormore daily: ${newToday.length} new, ` +
    (newAlerts.length ? `${newAlerts.length} need attention` : "nobody newly stuck");

  // ------------------------------------------------------------------ text
  const t: string[] = [];
  t.push(`fiftytwoormore daily, ${dateStr}`, "");
  t.push(`Users: ${rows.length} total, ${newToday.length} new in 24h, ${last7.length} new in 7 days`, "");
  t.push("FUNNEL (all time | last 7 days)");
  allFunnel.forEach((s, i) => {
    t.push(`  ${s.label}: ${s.users} (${s.pct}%) | ${weekFunnel[i].users} (${weekFunnel[i].pct}%)`);
  });
  t.push("", "TYPICAL TIME (median)");
  t.push(`  Account to confirmed email: ${fmtDuration(timings.confirm)}`);
  t.push(`  Account to connected partner: ${fmtDuration(timings.connect)}`);
  t.push(`  Account to first moment: ${fmtDuration(timings.firstActivity)}`, "");
  t.push("NEW IN THE LAST 24H");
  if (newToday.length) newToday.forEach((r) => t.push(`  ${displayName(r)}: ${stageLabel(r.stage)}`));
  else t.push("  Nobody");
  t.push("", `NEWLY NEED ATTENTION (${newAlerts.length}, ${stuckTotal} match a rule in total)`);
  if (newAlerts.length) {
    for (const [rule, list] of byRule) {
      t.push(`  ${RULE_LABELS[rule] ?? rule}`);
      list.forEach((a) => t.push(`    ${displayName(a)}: since ${shortDate(a.since)} (${ageDays(a.since, now)} d)`));
    }
  } else t.push("  Nobody newly stuck");
  t.push("", "Stage names and timestamps only. No activity content.");
  const text = t.join("\n");

  // ------------------------------------------------------------------ html
  const td = "padding:6px 10px;border-bottom:1px solid #E0D9D1;";
  const th = "padding:6px 10px;text-align:left;color:#7E6B67;font-weight:600;border-bottom:2px solid #E0D9D1;";
  const h2 = "margin:28px 0 8px;font-size:16px;color:#2C2221;";
  const funnelRows = allFunnel
    .map(
      (s, i) =>
        `<tr><td style="${td}">${escapeHtml(s.label)}</td>` +
        `<td style="${td}text-align:right;">${s.users} <span style="color:#7E6B67;">(${s.pct}%)</span></td>` +
        `<td style="${td}text-align:right;">${weekFunnel[i].users} <span style="color:#7E6B67;">(${weekFunnel[i].pct}%)</span></td></tr>`,
    )
    .join("");
  const newRows = newToday.length
    ? newToday
        .map((r) => `<li>${escapeHtml(displayName(r))}: <span style="color:#7E6B67;">${escapeHtml(stageLabel(r.stage))}</span></li>`)
        .join("")
    : `<li style="color:#7E6B67;">Nobody</li>`;
  const alertBlocks = newAlerts.length
    ? [...byRule]
        .map(
          ([rule, list]) =>
            `<p style="margin:12px 0 4px;font-weight:600;">${escapeHtml(RULE_LABELS[rule] ?? rule)}</p><ul style="margin:0;padding-left:20px;">` +
            list
              .map(
                (a) =>
                  `<li>${escapeHtml(displayName(a))} <span style="color:#7E6B67;">since ${shortDate(a.since)} (${ageDays(a.since, now)} d)</span></li>`,
              )
              .join("") +
            `</ul>`,
        )
        .join("")
    : `<p style="color:#7E6B67;">Nobody newly stuck.</p>`;

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#2C2221;line-height:1.45;">` +
    `<div style="background:#ED765E;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0;">` +
    `<div style="font-size:20px;font-weight:700;">fiftytwoormore daily</div><div style="opacity:.9;">${escapeHtml(dateStr)}</div></div>` +
    `<div style="background:#F2EBE3;padding:18px 22px;border-radius:0 0 12px 12px;">` +
    `<p style="margin:0 0 4px;"><b>${rows.length}</b> users total &middot; <b>${newToday.length}</b> new in 24h &middot; <b>${last7.length}</b> new in 7 days</p>` +
    `<h2 style="${h2}">Funnel</h2>` +
    `<table style="border-collapse:collapse;width:100%;background:#fff;border-radius:8px;"><tr><th style="${th}">Stage</th><th style="${th}text-align:right;">All time</th><th style="${th}text-align:right;">Last 7 days</th></tr>${funnelRows}</table>` +
    `<h2 style="${h2}">Typical time (median)</h2>` +
    `<p style="margin:0;">Account to confirmed email: <b>${fmtDuration(timings.confirm)}</b><br>Account to connected partner: <b>${fmtDuration(timings.connect)}</b><br>Account to first moment: <b>${fmtDuration(timings.firstActivity)}</b></p>` +
    `<h2 style="${h2}">New in the last 24 hours</h2><ul style="margin:0;padding-left:20px;">${newRows}</ul>` +
    `<h2 style="${h2}">Newly need attention <span style="color:#7E6B67;font-weight:400;">(${newAlerts.length}; ${stuckTotal} match a rule in total)</span></h2>${alertBlocks}` +
    `<p style="margin:26px 0 0;font-size:12px;color:#7E6B67;">Stage names and timestamps only. No activity content.</p>` +
    `</div></div>`;

  return { subject, text, html };
}

