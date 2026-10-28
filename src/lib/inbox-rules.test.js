import { test, expect } from "bun:test";
import { supportIsUnread } from "./inbox-rules";

test("a member's own support request is not an incoming message", () => {
  expect(
    supportIsUnread(
      { created_at: "2026-10-28T06:00:00Z", user_id: "member" },
      [],
      undefined,
      "member",
    ),
  ).toBe(false);
});
test("support replies notify the sender until read", () => {
  const thread = { created_at: "2026-10-28T06:00:00Z", user_id: "member" };
  const replies = [{ sender_id: "staff", created_at: "2026-10-28T06:02:00Z" }];
  expect(supportIsUnread(thread, replies, "2026-10-28T06:01:00Z", "member")).toBe(true);
  expect(supportIsUnread(thread, replies, "2026-10-28T06:03:00Z", "member")).toBe(false);
});
test("a request from someone else is unread for support staff", () => {
  expect(
    supportIsUnread(
      { created_at: "2026-10-28T06:00:00Z", user_id: "member" },
      [],
      undefined,
      "staff",
    ),
  ).toBe(true);
});
