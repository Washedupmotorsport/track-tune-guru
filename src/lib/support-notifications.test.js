import { test, expect } from "bun:test";
import { newSupportMessageIds, sendSupportNotifications, sendSupportReplyNotification } from "./support-notifications";

test("a stored team reply emails the original website sender with a reply-specific dedupe key", async () => {
  const calls = [];
  const result = await sendSupportReplyNotification(async (...args) => {
    calls.push(args);
    return { sent: true };
  }, { id: "reply-123", supportId: "request-123", body: "Your session is ready." }, {
    email: "driver@example.com", name: "Driver",
  }, true);
  expect(result).toBe("sent");
  expect(calls).toEqual([["support-reply", "driver@example.com", {
    templateData: { name: "Driver", reference: "request-123", body: "Your session is ready." },
    idempotencyKey: "support-reply-reply-123", replyTo: "support@myraceengineer.app",
  }]]);
});

test("customer replies do not trigger outbound email", async () => {
  let calls = 0;
  const result = await sendSupportReplyNotification(async () => { calls++; },
    { id: "reply-123", supportId: "request-123", body: "More detail" }, { email: "driver@example.com" }, false);
  expect(calls).toBe(0);
  expect(result).toBe("not_required");
});

test("blocked reply email is reported as suppressed without retries", async () => {
  let calls = 0;
  const result = await sendSupportReplyNotification(async () => {
    calls++;
    return { sent: false, reason: "recipient_suppressed" };
  }, { id: "reply-123", supportId: "request-123", body: "Answer" }, { email: "driver@example.com" }, true);
  expect(result).toBe("suppressed");
  expect(calls).toBe(1);
});

test("reply email failure reports a saved-but-not-emailed outcome", async () => {
  expect(await sendSupportReplyNotification(async () => { throw new Error("Unavailable"); },
    { id: "reply-123", supportId: "request-123", body: "Answer" }, { email: "driver@example.com" }, true)).toBe("failed");
});

test("a saved support message confirms to its sender and notifies the team with separate dedupe keys", async () => {
  const calls = [];
  await sendSupportNotifications(async (...args) => { calls.push(args); return { sent: true }; }, "message-123", {
    email: "driver@example.com", name: "Driver", category: "bug", message: "Timer issue",
  });
  expect(calls.map((call) => [call[0], call[1], call[2].idempotencyKey, call[2].replyTo])).toEqual([
    ["support-message", "support@myraceengineer.app", "support-message-message-123", "driver@example.com"],
    ["support-confirmation", "driver@example.com", "support-confirmation-message-123", "support@myraceengineer.app"],
  ]);
});

test("team delivery failure does not prevent the sender confirmation", async () => {
  const results = await sendSupportNotifications(async (template) => {
    if (template === "support-message") throw new Error("Provider unavailable");
    return { sent: true };
  }, "message-123", { email: "driver@example.com", category: "other", message: "Help" });
  expect(results.map((result) => result.status)).toEqual(["rejected", "fulfilled"]);
});

test("alerts ignore initial messages and only announce newly arrived IDs once", () => {
  expect(newSupportMessageIds(null, ["old"])).toEqual([]);
  expect(newSupportMessageIds(["old"], ["new", "old"])).toEqual(["new"]);
  expect(newSupportMessageIds(["new", "old"], ["new", "old"])).toEqual([]);
});