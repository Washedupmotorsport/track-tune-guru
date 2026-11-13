import { describe, it, expect } from "bun:test";
import { hotPressureValues } from "./hot-pressure-entry";

describe("session hot pressure entry", () => {
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
