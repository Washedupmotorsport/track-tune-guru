import { describe, it, expect } from "bun:test";
import {
  pressureGain,
  tempSpread,
  innerOuterDelta,
  avgTemp,
  rotatePositions,
  rotationPreset,
  analyzeTyreReading,
  setTotals,
  HIGH_GAIN_PSI,
  LOW_TREAD_MM,
} from "./tyre-analysis";

describe("pressureGain", () => {
  it("computes psi and percentage increase", () => {
    const g = pressureGain(20, 26);
    expect(g.psi).toBeCloseTo(6);
    expect(g.pct).toBeCloseTo(30);
  });
  it("returns null when either reading is missing", () => {
    expect(pressureGain(null, 26)).toBeNull();
    expect(pressureGain(20, null)).toBeNull();
    expect(pressureGain(0, 26)).toBeNull();
  });
});

describe("tempSpread", () => {
  it("is max minus min across the tread", () => {
    expect(tempSpread({ inner: 100, mid: 90, outer: 80 })).toBe(20);
  });
  it("needs at least two readings", () => {
    expect(tempSpread({ inner: 100, mid: null, outer: null })).toBeNull();
    expect(tempSpread(null)).toBeNull();
  });
});

describe("innerOuterDelta / avgTemp", () => {
  it("positive when inner is hotter", () => {
    expect(innerOuterDelta({ inner: 95, mid: 88, outer: 85 })).toBe(10);
  });
  it("averages available temps only", () => {
    expect(avgTemp({ inner: 90, mid: null, outer: 80 })).toBe(85);
    expect(avgTemp({ inner: null, mid: null, outer: null })).toBeNull();
  });
});

describe("rotation", () => {
  const current = { fl: 1, fr: 2, rl: 3, rr: 4 };
  it("front-to-rear swaps axles straight", () => {
    expect(rotationPreset(current, "front-to-rear")).toEqual({ fl: 3, fr: 4, rl: 1, rr: 2 });
  });
  it("cross rotation swaps diagonally", () => {
    expect(rotationPreset(current, "cross")).toEqual({ fl: 4, fr: 3, rl: 2, rr: 1 });
  });
  it("rotatePositions applies a partial mapping over current", () => {
    expect(rotatePositions(current, { fl: 4 })).toEqual({ fl: 4, fr: 2, rl: 3, rr: 4 });
  });
});

describe("analyzeTyreReading", () => {
  const calm = {
    cold: { fl: 24, fr: 24, rl: 24, rr: 24 },
    hot: { fl: 26, fr: 26, rl: 26, rr: 26 },
    tread: { fl: 5, fr: 5, rl: 5, rr: 5 },
    temps: {
      fl: { inner: 90, mid: 88, outer: 86 },
      fr: { inner: 90, mid: 88, outer: 86 },
      rl: { inner: 90, mid: 88, outer: 86 },
      rr: { inner: 90, mid: 88, outer: 86 },
    },
  };

  it("raises nothing for an even, healthy reading", () => {
    expect(analyzeTyreReading(calm)).toEqual([]);
  });

  it("flags an unusual pressure increase with psi and percent", () => {
    const obs = analyzeTyreReading({ ...calm, hot: { ...calm.hot, fl: 24 + HIGH_GAIN_PSI + 0.5 } });
    const flag = obs.find((o) => o.corner === "fl" && o.severity === "flag");
    expect(flag).toBeTruthy();
    expect(flag.text).toMatch(/psi/);
    expect(flag.text).toMatch(/%/);
  });

  it("flags uneven temperature distribution across the tread", () => {
    const obs = analyzeTyreReading({
      ...calm,
      temps: { ...calm.temps, fr: { inner: 105, mid: 95, outer: 85 } },
    });
    expect(obs.some((o) => o.corner === "fr" && /uneven temperature/i.test(o.text))).toBe(true);
  });

  it("notes a large left/right temperature difference", () => {
    const obs = analyzeTyreReading({
      ...calm,
      temps: {
        ...calm.temps,
        fl: { inner: 110, mid: 110, outer: 110 },
        rl: { inner: 110, mid: 110, outer: 110 },
      },
    });
    expect(obs.some((o) => /left-side/i.test(o.text))).toBe(true);
  });

  it("flags possible excessive wear at the change threshold", () => {
    const obs = analyzeTyreReading({ ...calm, tread: { ...calm.tread, rr: LOW_TREAD_MM } });
    expect(obs.some((o) => o.corner === "rr" && /excessive wear/i.test(o.text))).toBe(true);
  });

  it("never issues definitive setup instructions", () => {
    const obs = analyzeTyreReading({
      cold: { fl: 20, fr: 20, rl: 20, rr: 20 },
      hot: { fl: 28, fr: 28, rl: 28, rr: 28 },
      tread: { fl: 1.5, fr: 1.5, rl: 1.5, rr: 1.5 },
      temps: {
        fl: { inner: 120, mid: 100, outer: 80 },
        fr: { inner: 120, mid: 100, outer: 80 },
        rl: { inner: 120, mid: 100, outer: 80 },
        rr: { inner: 120, mid: 100, outer: 80 },
      },
    });
    expect(obs.length).toBeGreaterThan(0);
    for (const o of obs) {
      expect(o.text).not.toMatch(/\b(set|increase|decrease|add|bleed)\b.{0,20}\b(camber|pressure|toe|alignment)\b/i);
    }
  });
});

describe("setTotals", () => {
  it("accumulates laps, distance and heat cycles across history", () => {
    const t = setTotals([
      { laps: 12, distance_km: 40, heat_cycles: 1 },
      { laps: 8, distance_km: 27.5, heat_cycles: 1 },
      { laps: null, distance_km: null, heat_cycles: 2 },
    ]);
    expect(t).toEqual({ laps: 20, distanceKm: 67.5, heatCycles: 4 });
  });
});
