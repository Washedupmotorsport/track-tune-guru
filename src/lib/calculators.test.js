import { describe, it, expect } from "bun:test";
import {
  fuelCalc, lapsOnFuel, pressureCalc, wheelRate, suspensionFrequencyHz,
  rideHeightChangeMm, overallRatio, speedAtRpmKmh, speedDifferenceKmh,
  psiToKpa, kpaToPsi, parseGearbox, EMPTY_GEARBOX,
} from "./calculators.ts";

describe("fuel calculator — reference values", () => {
  // Reference: 30 L over 12 laps on a 3.12 km circuit, 20-lap race, 3 L reserve.
  const r = fuelCalc({ fuelUsedL: 30, lapsCompleted: 12, circuitLengthKm: 3.12, plannedRaceLaps: 20, reserveL: 3 });

  it("average per lap = 30/12 = 2.5 L", () => expect(r.avgPerLapL).toBeCloseTo(2.5, 6));
  it("per km = 30/(12×3.12) ≈ 0.80128 L/km", () => expect(r.perKmL).toBeCloseTo(0.801282, 5));
  it("race requirement = 2.5×20 + 3 = 53 L", () => expect(r.raceRequirementL).toBeCloseTo(53, 6));
  it("minimum reserve = one lap = 2.5 L", () => expect(r.minReserveL).toBeCloseTo(2.5, 6));
  it("remaining race laps = 20 − 12 = 8", () => expect(r.remainingRaceLaps).toBe(8));

  it("omits per-km when no circuit length is given", () => {
    const x = fuelCalc({ fuelUsedL: 30, lapsCompleted: 12, plannedRaceLaps: 20, reserveL: 3 });
    expect(x.perKmL).toBeNull();
    expect(x.avgPerLapL).toBeCloseTo(2.5, 6);
  });

  it("returns null on zero laps or zero fuel (no division by zero)", () => {
    expect(fuelCalc({ fuelUsedL: 30, lapsCompleted: 0, plannedRaceLaps: 20, reserveL: 3 })).toBeNull();
    expect(fuelCalc({ fuelUsedL: 0, lapsCompleted: 12, plannedRaceLaps: 20, reserveL: 3 })).toBeNull();
    expect(fuelCalc({ fuelUsedL: -5, lapsCompleted: 12, plannedRaceLaps: 20, reserveL: 3 })).toBeNull();
  });

  it("lapsOnFuel: (40 − 3) / 2.5 = 14 laps", () => {
    expect(lapsOnFuel(40, 3, 2.5)).toBe(14);
    expect(lapsOnFuel(2, 3, 2.5)).toBe(0); // below reserve, never negative
    expect(lapsOnFuel(40, 3, 0)).toBeNull();
  });
});

describe("tyre pressure calculator — reference values", () => {
  // Reference: FL 24→31 psi (+7, 29.17%), FR 24→30, RL 22→28, RR 22→29.
  const r = pressureCalc([
    { label: "FL", cold: 24, hot: 31 },
    { label: "FR", cold: 24, hot: 30 },
    { label: "RL", cold: 22, hot: 28 },
    { label: "RR", cold: 22, hot: 29 },
  ]);

  it("gain per corner", () => {
    expect(r.corners[0].gain).toBe(7);
    expect(r.corners[3].gain).toBe(7);
  });
  it("percentage increase: 7/24 ≈ 29.17%", () => expect(r.corners[0].gainPct).toBeCloseTo(29.1667, 3));
  it("cold spread = 24 − 22 = 2", () => expect(r.maxColdSpread).toBe(2));
  it("hot spread = 31 − 28 = 3", () => expect(r.maxHotSpread).toBe(3));

  it("handles missing corners without inventing values", () => {
    const x = pressureCalc([{ label: "FL", cold: 24, hot: null }, { label: "FR", cold: null, hot: null }]);
    expect(x.corners[0].gain).toBeNull();
    expect(x.maxColdSpread).toBeNull(); // only one cold value
  });

  it("psi ↔ kPa conversion: 29 psi ≈ 199.948 kPa", () => {
    expect(psiToKpa(29)).toBeCloseTo(199.948, 2);
    expect(kpaToPsi(199.948)).toBeCloseTo(29, 2);
  });
});

describe("suspension calculator — reference values", () => {
  it("wheel rate = 8 N/mm × 0.9² = 6.48 N/mm", () => {
    expect(wheelRate(8, 0.9)).toBeCloseTo(6.48, 6);
  });

  it("frequency = (1/2π)√(6480/300) ≈ 0.7397 Hz", () => {
    expect(suspensionFrequencyHz(6.48, 300)).toBeCloseTo(0.73972, 4);
  });

  it("ride-height change = 5 mm perch / 0.9 MR ≈ 5.556 mm at the wheel", () => {
    expect(rideHeightChangeMm(5, 0.9)).toBeCloseTo(5.5556, 3);
  });

  it("guards invalid input", () => {
    expect(wheelRate(8, 0)).toBeNull();
    expect(suspensionFrequencyHz(6.48, 0)).toBeNull();
    expect(rideHeightChangeMm(5, 0)).toBeNull();
  });
});

describe("gear ratio calculator — reference values", () => {
  it("overall = 3.2 × 3.9 = 12.48", () => {
    expect(overallRatio(3.2, 3.9)).toBeCloseTo(12.48, 6);
  });

  it("speed at 7000 rpm, overall 12.48, 620 mm tyre ≈ 65.551 km/h", () => {
    // 7000×60×π×620 / (12.48×1e6) = 65.5505…
    expect(speedAtRpmKmh(7000, 12.48, 620)).toBeCloseTo(65.5505, 3);
  });

  it("speed difference between 3.2 and 2.9 gears at 7000 rpm", () => {
    const d = speedDifferenceKmh(7000, 3.2, 2.9, 3.9, 620);
    expect(d.speedA).toBeCloseTo(65.5505, 3);
    expect(d.speedB).toBeCloseTo(72.3316, 3); // 7000×60×π×620/(11.31×1e6)
    expect(d.diff).toBeCloseTo(6.7811, 3);
  });

  it("guards invalid input", () => {
    expect(overallRatio(0, 3.9)).toBeNull();
    expect(speedAtRpmKmh(7000, 12.48, 0)).toBeNull();
    expect(speedDifferenceKmh(7000, 3.2, 0, 3.9, 620)).toBeNull();
  });
});

describe("parseGearbox", () => {
  it("round-trips a valid spec", () => {
    const spec = { finalDrive: 3.9, tyreDiameterMm: 620, gears: [{ label: "1st", ratio: 3.2 }] };
    expect(parseGearbox(spec)).toEqual(spec);
  });

  it("falls back to empty on garbage", () => {
    expect(parseGearbox(null)).toEqual(EMPTY_GEARBOX);
    expect(parseGearbox("junk")).toEqual(EMPTY_GEARBOX);
    expect(parseGearbox({ finalDrive: -1, gears: "no" })).toEqual(EMPTY_GEARBOX);
  });
});
