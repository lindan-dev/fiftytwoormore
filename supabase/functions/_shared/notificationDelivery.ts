export const TOKEN_MAX_AGE_DAYS = 60;
export interface TokenRow { id: string; user_id: string; token: string; updated_at: string }
export interface DeliveryLog { user_id: string; delivery_scope: string }
export type Outcome = "push_ok" | "push_failed" | "no_token";
export interface PushOutcome { user_id: string; outcome: Outcome; accepted: number; attempted: number }
export interface Decision { channel: "push" | "email" | "none"; reason: string }

export function recipientIds(members: string[], requested?: string): string[] {
  if (requested && !members.includes(requested)) throw new Error("Recipient must belong to the selected couple");
  return requested ? [requested] : members;
}

export function inDeliveryWindow(type: "weekly-digest" | "midweek-nudge", localDate: Date): boolean {
  return localDate.getDay() === (type === "midweek-nudge" ? 3 : 6) && localDate.getHours() === 10;
}

export function recentTokens(rows: TokenRow[], now = new Date()): TokenRow[] {
  const cutoff = now.getTime() - TOKEN_MAX_AGE_DAYS * 86400000;
  return rows.filter(row => Date.parse(row.updated_at) >= cutoff);
}

export const DEMO_EMAILS = ["demo1@fiftytwoormore.com", "demo2@fiftytwoormore.com"];
export type TestAccountLookup = { ok: true; ids: Set<string> } | { ok: false };

// Test/demo accounts never receive scheduled nudges or digests. Lookup errors are never "not a test account".
export async function loadTestAccounts(
  fetchTestRoleIds: () => Promise<{ data: Array<{ user_id: string }> | null; error: unknown }>,
  fetchUsers: () => Promise<{ data: Array<{ id: string; email?: string | null }> | null; error: unknown }>,
): Promise<TestAccountLookup> {
  try {
    const roles = await fetchTestRoleIds();
    if (roles.error || !roles.data) return { ok: false };
    const users = await fetchUsers();
    if (users.error || !users.data) return { ok: false };
    const ids = new Set(roles.data.map(row => row.user_id));
    for (const user of users.data) if (user.email && DEMO_EMAILS.includes(user.email.toLowerCase())) ids.add(user.id);
    return { ok: true, ids };
  } catch {
    return { ok: false };
  }
}

// First per-person rule; force does not bypass it. Returns null when the person may continue to normal checks.
export function testAccountGate(userId: string, lookup: TestAccountLookup): Decision | null {
  if (!lookup.ok) return { channel: "none", reason: "test_account_lookup_failed" };
  return lookup.ids.has(userId) ? { channel: "none", reason: "test_account" } : null;
}

export function chooseDelivery(userId: string, tokens: TokenRow[], logs: DeliveryLog[], activityNeeded = true, now = new Date()): Decision {
  if (logs.some(log => log.delivery_scope === "couple" || log.user_id === userId)) {
    return { channel: "none", reason: "already_sent_this_week" };
  }
  if (!activityNeeded) return { channel: "none", reason: "no_activity_needed" };
  const mine = tokens.filter(row => row.user_id === userId);
  if (recentTokens(mine, now).length) return { channel: "push", reason: "recent_token" };
  return { channel: "email", reason: mine.length ? "stale_token" : "no_token" };
}

export function overrideAllowed(caller: string, force: boolean, dryRun: boolean): boolean {
  return !(force || dryRun) || caller === "superuser" || caller === "cron";
}

// Email is never attempted when any token received an OK ticket.
export async function deliverPerson(
  decision: Decision,
  dryRun: boolean,
  push: () => Promise<PushOutcome>,
  email: () => Promise<boolean>,
  record: (channel: "push" | "email-fallback", outcome: Outcome, reason: string) => Promise<void>,
): Promise<Decision> {
  if (dryRun || decision.channel === "none") return decision;
  let outcome: Outcome = "no_token";
  if (decision.channel === "push") {
    const result = await push();
    outcome = result.outcome;
    if (result.accepted > 0) {
      await record("push", "push_ok", "recent_token");
      return { channel: "push", reason: "recent_token" };
    }
  }
  const reason = outcome === "push_failed" ? "all_push_attempts_failed" : decision.reason;
  if (!await email()) return { channel: "none", reason: "email_failed" };
  await record("email-fallback", outcome, reason);
  return { channel: "email", reason };
}

interface ExpoTicket { status?: string; details?: { error?: string } }

// Tickets are positionally matched to the exact batch sent to Expo.
// No raw Expo response (which may include token values) is returned or logged.
export async function sendExpoTickets(
  rows: TokenRow[], userIds: string[], title: string, body: string,
  data: Record<string, unknown> | undefined,
  deleteDeadToken: (row: TokenRow) => Promise<void>,
  request: typeof fetch = fetch,
): Promise<PushOutcome[]> {
  const results = new Map<string, PushOutcome>(userIds.map(user_id => [user_id, { user_id, outcome: "no_token", accepted: 0, attempted: 0 }]));
  for (let offset = 0; offset < rows.length; offset += 100) {
    const batch = rows.slice(offset, offset + 100);
    for (const row of batch) {
      const result = results.get(row.user_id);
      if (result) { result.attempted++; result.outcome = "push_failed"; }
    }
    let tickets: ExpoTicket[] = [];
    try {
      const response = await request("https://exp.host/--/api/v2/push/send", {
        method: "POST", signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch.map(row => ({ to: row.token, title, body, data, sound: "default" }))),
      });
      if (response.ok) {
        const json = await response.json();
        tickets = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];
      }
    } catch {
      // Network/invalid response: no accepted tickets; never expose raw error data.
    }
    for (let i = 0; i < batch.length; i++) {
      const row = batch[i];
      const ticket = tickets[i];
      const result = results.get(row.user_id);
      if (ticket?.status === "ok" && result) result.accepted++;
      if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        await deleteDeadToken(row);
      }
    }
  }
  return [...results.values()].map(result => ({ ...result, outcome: result.accepted > 0 ? "push_ok" : result.attempted > 0 ? "push_failed" : "no_token" }));
}