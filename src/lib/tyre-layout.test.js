import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

test("invalid tyre layout replacement preserves all fitted assignment IDs", async () => {
  const { session } = JSON.parse(
    readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8"),
  );
  const base = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error("Backend configuration required");
  const headers = {
    apikey: key,
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
  const response = await fetch(
    `${base}/rest/v1/tyre_assignments?select=id,car_id,tyre_set_id&removed_at=is.null`,
    { headers },
  );
  expect(response.ok).toBe(true);
  const assignments = await response.json();
  const first = assignments[0];
  if (!first) throw new Error("An existing fitted set is required to test rollback");
  const ids = assignments
    .filter((a) => a.car_id === first.car_id)
    .map((a) => a.id)
    .sort();
  const invalid = await fetch(`${base}/rest/v1/rpc/replace_tyre_layout`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_car_id: first.car_id,
      p_set_id: first.tyre_set_id,
      p_slots: [1, 1, 3, 4],
      p_expected_ids: ids,
    }),
  });
  expect(invalid.ok).toBe(false);
  const after = await fetch(
    `${base}/rest/v1/tyre_assignments?select=id&car_id=eq.${first.car_id}&removed_at=is.null`,
    { headers },
  );
  expect(after.ok).toBe(true);
  expect((await after.json()).map((a) => a.id).sort()).toEqual(ids);
});
