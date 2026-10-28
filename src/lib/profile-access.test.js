import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

test("authenticated profile reads exclude unrelated racers and retain own profile and owned crew", async () => {
  const { session } = JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8"));
  const base = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error("Backend configuration required for access test");
  async function rows(table, query) {
    const response = await fetch(`${base}/rest/v1/${table}?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${session.access_token}` },
    });
    expect(response.ok).toBe(true);
    return response.json();
  }
  const ownId = session.user.id;
  const cars = await rows("cars", `select=id&user_id=eq.${ownId}`);
  const owned = new Set(cars.map((car) => car.id));
  const shares = await rows("car_shares", `select=car_id,shared_with_user_id&owner_id=eq.${ownId}`);
  const permitted = new Set([ownId, ...shares.filter((share) => owned.has(share.car_id)).map((share) => share.shared_with_user_id)]);
  const profiles = await rows("profiles", "select=id");
  expect(profiles.some((profile) => profile.id === ownId)).toBe(true);
  expect(profiles.every((profile) => permitted.has(profile.id))).toBe(true);
  const unrelated = "91041dc0-7ce6-4801-b20f-9d4634400697";
  expect(permitted.has(unrelated)).toBe(false);
  expect(await rows("profiles", `select=id&id=eq.${unrelated}`)).toEqual([]);
});