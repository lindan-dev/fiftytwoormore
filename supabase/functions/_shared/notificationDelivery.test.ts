import { describe, expect, test } from "bun:test";
import { chooseDelivery, deliverPerson, overrideAllowed, recentTokens, sendExpoTickets, recipientIds, inDeliveryWindow, loadTestAccounts, testAccountGate, type TokenRow } from "./notificationDelivery.ts";

const now = new Date("2026-11-25T09:00:00Z");
const token = (id: string, user_id = "person-a", days = 1): TokenRow => ({
  id, user_id, token: `fake-${id}`, updated_at: new Date(now.getTime() - days * 86400000).toISOString(),
});
const response = (tickets: unknown[]) => async () => new Response(JSON.stringify({ data: tickets }), { status: 200 });

describe("Independent notification delivery", () => {
  test("digest remains Saturday 10:00 in the couple's local time", () => {
    expect(inDeliveryWindow("weekly-digest", new Date(2026, 10, 28, 10))).toBe(true);
    expect(inDeliveryWindow("weekly-digest", new Date(2026, 10, 28, 9))).toBe(false);
    expect(inDeliveryWindow("weekly-digest", new Date(2026, 10, 25, 10))).toBe(false);
  });
  test("nudge remains Wednesday 10:00 in the couple's local time", () => {
    expect(inDeliveryWindow("midweek-nudge", new Date(2026, 10, 25, 10))).toBe(true);
    expect(inDeliveryWindow("midweek-nudge", new Date(2026, 10, 25, 11))).toBe(false);
    expect(inDeliveryWindow("midweek-nudge", new Date(2026, 10, 28, 10))).toBe(false);
  });
  test("manual fallback targets exactly the requested partner", () => {
    expect(recipientIds(["person-a", "person-b"], "person-b")).toEqual(["person-b"]);
  });
  test("manual email without a recipient still targets both partners", () => {
    expect(recipientIds(["person-a", "person-b"])).toEqual(["person-a", "person-b"]);
  });
  test("manual fallback cannot target someone outside the couple", () => {
    expect(() => recipientIds(["person-a", "person-b"], "outsider")).toThrow("Recipient must belong");
  });
  test("a person with four tokens uses push, not a single-row lookup", () => {
    expect(chooseDelivery("person-a", [token("1"), token("2"), token("3"), token("4")], [], true, now)).toEqual({ channel: "push", reason: "recent_token" });
  });
  test("the exact 60-day boundary is recent; older tokens are excluded", () => {
    expect(recentTokens([token("boundary", "person-a", 60), token("older", "person-a", 60.01)], now).map(t => t.id)).toEqual(["boundary"]);
  });
  test("no tokens means email for that person only", () => {
    expect(chooseDelivery("person-b", [token("1", "person-a")], [], true, now)).toEqual({ channel: "email", reason: "no_token" });
    expect(chooseDelivery("person-a", [token("1", "person-a")], [], true, now).channel).toBe("push");
  });
  test("only stale tokens mean email with a stale_token reason", () => {
    expect(chooseDelivery("person-a", [token("old", "person-a", 61)], [], true, now)).toEqual({ channel: "email", reason: "stale_token" });
  });
  test("new person logs suppress only the recipient", () => {
    const logs = [{ user_id: "person-a", delivery_scope: "person" }];
    expect(chooseDelivery("person-a", [], logs, true, now).reason).toBe("already_sent_this_week");
    expect(chooseDelivery("person-b", [], logs, true, now).channel).toBe("email");
  });
  test("legacy couple logs suppress both recipients without changing old rows", () => {
    const logs = [{ user_id: "person-a", delivery_scope: "couple" }];
    expect(chooseDelivery("person-b", [], logs, true, now).reason).toBe("already_sent_this_week");
  });
  test("a week with activity needs no midweek nudge", () => {
    expect(chooseDelivery("person-a", [token("1")], [], false, now)).toEqual({ channel: "none", reason: "no_activity_needed" });
  });
  test("force and dry_run are only allowed for superusers or a valid cron caller", () => {
    expect(overrideAllowed("superuser", true, true)).toBe(true);
    expect(overrideAllowed("cron", true, true)).toBe(true);
    expect(overrideAllowed("service-role", true, true)).toBe(false);
    expect(overrideAllowed("user", false, true)).toBe(false);
  });
  test("dry run sends nothing and records nothing for either channel", async () => {
    let sideEffects = 0;
    const forbidden = async (): Promise<never> => { sideEffects++; throw new Error("Unexpected side effect"); };
    for (const channel of ["push", "email"] as const) {
      expect((await deliverPerson({ channel, reason: "recent_token" }, true, forbidden, forbidden, forbidden)).channel).toBe(channel);
    }
    expect(sideEffects).toBe(0);
  });
  test("one OK Expo ticket prevents any email despite partial failure", async () => {
    let emails = 0;
    const recorded: string[] = [];
    const result = await deliverPerson({ channel: "push", reason: "recent_token" }, false,
      async () => ({ user_id: "person-a", accepted: 1, attempted: 4, outcome: "push_ok" }),
      async () => { emails++; return true; }, async channel => { recorded.push(channel); });
    expect(result.channel).toBe("push");
    expect(emails).toBe(0);
    expect(recorded).toEqual(["push"]);
  });
  test("every rejected token triggers one email and only an email log", async () => {
    let emails = 0;
    const recorded: string[] = [];
    const result = await deliverPerson({ channel: "push", reason: "recent_token" }, false,
      async () => ({ user_id: "person-a", accepted: 0, attempted: 4, outcome: "push_failed" }),
      async () => { emails++; return true; }, async channel => { recorded.push(channel); });
    expect(result).toEqual({ channel: "email", reason: "all_push_attempts_failed" });
    expect(emails).toBe(1);
    expect(recorded).toEqual(["email-fallback"]);
  });
  test("a failed email does not create a settled delivery log", async () => {
    let records = 0;
    const result = await deliverPerson({ channel: "email", reason: "no_token" }, false,
      async () => { throw new Error("Push must not be attempted"); }, async () => false, async () => { records++; });
    expect(result.channel).toBe("none");
    expect(records).toBe(0);
  });
});

describe("Expo tickets with fake requests only", () => {
  test("only DeviceNotRegistered deletes its exact token; other errors never delete", async () => {
    const deleted: string[] = [];
    const outcomes = await sendExpoTickets([token("dead"), token("bad"), token("ok")], ["person-a"], "title", "body", undefined,
      async row => { deleted.push(row.id); }, response([
        { status: "error", details: { error: "DeviceNotRegistered" } },
        { status: "error", details: { error: "MessageTooBig" } }, { status: "ok" },
      ]));
    expect(deleted).toEqual(["dead"]);
    expect(outcomes).toEqual([{ user_id: "person-a", outcome: "push_ok", accepted: 1, attempted: 3 }]);
  });
  test("one partner's success does not hide another partner's failures", async () => {
    const outcomes = await sendExpoTickets([token("1"), token("2", "person-b")], ["person-a", "person-b", "person-c"], "title", "body", undefined,
      async () => {}, response([{ status: "ok" }, { status: "error" }]));
    expect(outcomes.map(r => r.outcome)).toEqual(["push_ok", "push_failed", "no_token"]);
  });
  test("tickets remain matched to tokens across Expo's 100-message batches", async () => {
    const deleted: string[] = [];
    let batch = 0;
    const outcomes = await sendExpoTickets(Array.from({ length: 101 }, (_, i) => token(String(i))), ["person-a"], "title", "body", undefined,
      async row => { deleted.push(row.id); }, async () => {
        batch++;
        return new Response(JSON.stringify({ data: batch === 1 ? Array.from({ length: 100 }, () => ({ status: "ok" })) : [{ status: "error", details: { error: "DeviceNotRegistered" } }] }));
      });
    expect(outcomes[0].accepted).toBe(100);
    expect(deleted).toEqual(["100"]);
  });
  test("HTTP failures never count as push success or delete a token", async () => {
    let deletions = 0;
    const outcomes = await sendExpoTickets([token("1")], ["person-a"], "title", "body", undefined,
      async () => { deletions++; }, async () => new Response("unavailable", { status: 503 }));
    expect(outcomes[0].outcome).toBe("push_failed");
    expect(deletions).toBe(0);
  });
});
describe("Test accounts are skipped by scheduled notifications", () => {
  const ok = (rows: Array<{ user_id: string }>, users: Array<{ id: string; email: string }>) =>
    loadTestAccounts(async () => ({ data: rows, error: null }), async () => ({ data: users, error: null }));
  test("a test_user person is skipped, and force cannot change that", async () => {
    const lookup = await ok([{ user_id: "person-a" }], []);
    expect(testAccountGate("person-a", lookup)).toEqual({ channel: "none", reason: "test_account" });
    let pushed = false;
    const result = await deliverPerson(testAccountGate("person-a", lookup)!, false, async () => { pushed = true; return { user_id: "person-a", outcome: "push_ok", accepted: 1, attempted: 1 }; }, async () => { pushed = true; return true; }, async () => { pushed = true; });
    expect(result.reason).toBe("test_account");
    expect(pushed).toBe(false);
  });
  test("a demo email in mixed case is skipped", async () => {
    const lookup = await ok([], [{ id: "demo", email: "Demo2@FiftyTwoOrMore.com" }]);
    expect(testAccountGate("demo", lookup)?.reason).toBe("test_account");
  });
  test("a real person whose partner is a test account is still handled", async () => {
    const lookup = await ok([{ user_id: "person-b" }], [{ id: "person-a", email: "real@example.com" }]);
    expect(testAccountGate("person-a", lookup)).toBeNull();
    expect(chooseDelivery("person-a", [token("t1", "person-a")], [], true, now).channel).toBe("push");
  });
  test("a failed role lookup sends nothing", async () => {
    const lookup = await loadTestAccounts(async () => ({ data: null, error: new Error("down") }), async () => ({ data: [], error: null }));
    expect(lookup.ok).toBe(false);
    expect(testAccountGate("person-a", lookup)).toEqual({ channel: "none", reason: "test_account_lookup_failed" });
  });
});
