import { test, expect } from "bun:test";
import { selectRaceSession, nextLapNumber, sessionLogContext } from "./race-day-rules";

test("an old manual session falls back to the current weekend session", () => {
  expect(selectRaceSession([{ id: "B" }, { id: "C" }], "A", "C")).toEqual({ id: "C" });
  expect(selectRaceSession([{ id: "B" }], "A", "A")).toEqual({ id: "B" });
  expect(selectRaceSession([], "A")).toBeNull();
});
test("lap numbering stays above backfilled and unnumbered laps", () => {
  expect(nextLapNumber([{ lap_number: 8 }, { lap_number: 2 }, { lap_number: null }])).toBe(9);
  expect(nextLapNumber([{ lap_number: null }, { lap_number: null }])).toBe(3);
  expect(nextLapNumber([])).toBe(1);
});
test("tyre logs attach only to a matching car and active weekend session", () => {
  const weekend = { id: "weekend", car_id: "car" };
  const session = { id: "session", car_id: "car", event_id: "weekend" };
  expect(sessionLogContext("car", weekend, session)).toEqual({ session_id: "session", event_id: "weekend" });
  expect(sessionLogContext("other", weekend, session)).toEqual({ session_id: null, event_id: null });
  expect(sessionLogContext("car", weekend, { ...session, event_id: "old" })).toEqual({ session_id: null, event_id: "weekend" });
});