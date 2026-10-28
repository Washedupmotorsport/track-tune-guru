import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const fixtureIncoming = "72d00000-0000-4000-8000-000000000002";
const fixturePrivate = "72d00000-0000-4000-8000-000000000003";

test("members can read their incoming messages but not unrelated conversations", async () => {
  const { session } = JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8"));
  const base = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error("Backend configuration required");
  const headers = { apikey: key, Authorization: `Bearer ${session.access_token}` };
  const incoming = await fetch(`${base}/rest/v1/team_messages?select=id&id=eq.${fixtureIncoming}`, { headers });
  expect(incoming.ok).toBe(true);
  expect(await incoming.json()).toEqual([{ id: fixtureIncoming }]);
  const hidden = await fetch(`${base}/rest/v1/team_messages?select=id&id=eq.${fixturePrivate}`, { headers });
  expect(hidden.ok).toBe(true);
  expect(await hidden.json()).toEqual([]);
});

test("non-crew recipients cannot receive a new direct message", async () => {
  const { session } = JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8"));
  const base = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error("Backend configuration required");
  const headers = { apikey: key, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };
  const response = await fetch(`${base}/rest/v1/team_messages`, { method: "POST", headers, body: JSON.stringify({ sender_id: session.user.id, recipient_id: "91041dc0-7ce6-4801-b20f-9d4634400697", body: "This must be denied without shared crew membership." }) });
  expect(response.status).toBe(403);
});