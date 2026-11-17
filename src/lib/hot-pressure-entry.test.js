import { describe, it, expect } from "bun:test";
import { hotPressureValues, newHotPressureReading } from "./hot-pressure-entry";

describe("session hot pressure entry", () => {
  it("creates separate run payloads without a previous record ID or cold fields", () => {
    const context = {
      user_id: "crew",
      car_id: "car",
      session_id: "practice-2",
      tyre_set_id: "set",
      tire_set: "Slicks",
    };
    const first = newHotPressureReading(context, {
      fl: "31.1",
      fr: "32.2",
      rl: "33.3",
      rr: "34.4",
    });
    const second = newHotPressureReading(context, {
      fl: "35.1",
      fr: "36.2",
      rl: "37.3",
      rr: "38.4",
    });
    expect(first).toEqual({ ...context, hot_fl: 31.1, hot_fr: 32.2, hot_rl: 33.3, hot_rr: 34.4 });
    expect(second).toEqual({ ...context, hot_fl: 35.1, hot_fr: 36.2, hot_rl: 37.3, hot_rr: 38.4 });
    expect(first).not.toHaveProperty("id");
    expect(second).not.toHaveProperty("cold_fl");
  });
  it("maps four distinct readings to their corners without changing cold readings", () => {
    const cold = { cold_fl: 22, cold_fr: 23, cold_rl: 24, cold_rr: 25 };
    const patch = hotPressureValues({ fl: "31.1", fr: "32.2", rl: "33.3", rr: "34.4" });
    expect(patch).toEqual({ hot_fl: 31.1, hot_fr: 32.2, hot_rl: 33.3, hot_rr: 34.4 });
    expect({ ...cold, ...patch }).toEqual({
      ...cold,
      hot_fl: 31.1,
      hot_fr: 32.2,
      hot_rl: 33.3,
      hot_rr: 34.4,
    });
    expect(Object.keys(patch).some((key) => key.startsWith("cold_"))).toBe(false);
  });
  it("rejects missing or invalid pressures", () => {
    for (const fl of ["", "bad", "0", "-1", "Infinity"]) {
      expect(() => hotPressureValues({ fl, fr: "32", rl: "33", rr: "34" })).toThrow();
    }
  });
});
