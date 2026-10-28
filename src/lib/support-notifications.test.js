import { test, expect } from "bun:test";
import { newSupportMessageIds, sendSupportNotifications } from "./support-notifications";

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