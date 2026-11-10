// Pure, client-safe motorsport engineering calculators.
// Every function validates its inputs and returns null rather than throwing
// or dividing by zero. Nothing here invents missing values — the UI shows
// exactly which inputs are required, plus the formula and assumptions used.

export const PSI_PER_KPA = 1 / 6.894757;
export const KPA_PER_PSI = 6.894757;

export const psiToKpa = (psi: number): number => psi * KPA_PER_PSI;
export const kpaToPsi = (kpa: number): number => kpa * PSI_PER_KPA;

const pos = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

const nonNeg = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

// ───────────────────────── Fuel ─────────────────────────

export type FuelResult = {
  avgPerLapL: number;
  perKmL: number | null; // null when circuit length not given
  raceRequirementL: number; // includes the entered reserve
  minReserveL: number; // one lap of fuel — the floor for any reserve
  remainingRaceLaps: number;
};

/**
 * Fuel maths for a stint/race. `reserveL` is the user's chosen reserve;
 * minReserveL reports one lap of fuel as the absolute floor.
 */
export function fuelCalc(input: {
  fuelUsedL: number;
  lapsCompleted: number;
  circuitLengthKm?: number | null;
  plannedRaceLaps: number;
  reserveL: number;
}): FuelResult | null {
  const { fuelUsedL, lapsCompleted, circuitLengthKm, plannedRaceLaps, reserveL } = input;
  if (!pos(fuelUsedL) || !pos(lapsCompleted) || !pos(plannedRaceLaps) || !nonNeg(reserveL)) return null;
  const avgPerLapL = fuelUsedL / lapsCompleted;
  return {
    avgPerLapL,
    perKmL: pos(circuitLengthKm) ? fuelUsedL / (lapsCompleted * circuitLengthKm) : null,
    raceRequirementL: avgPerLapL * plannedRaceLaps + reserveL,
    minReserveL: avgPerLapL,
    remainingRaceLaps: Math.max(0, plannedRaceLaps - lapsCompleted),
  };
}

/** Laps possible on a given amount of fuel above the reserve. */
export function lapsOnFuel(fuelAvailableL: number, reserveL: number, avgPerLapL: number): number | null {
  if (!nonNeg(fuelAvailableL) || !nonNeg(reserveL) || !pos(avgPerLapL)) return null;
  return Math.max(0, Math.floor((fuelAvailableL - reserveL) / avgPerLapL));
}

// ───────────────────────── Tyre pressures ─────────────────────────

export type CornerPressure = { label: string; cold: number | null; hot: number | null };

export type PressureCornerResult = {
  label: string;
  gain: number | null; // hot - cold, in the input unit
  gainPct: number | null;
};

export type PressureResult = {
  corners: PressureCornerResult[];
  /** Largest cold-to-cold (or hot-to-hot) spread between corners, input unit. */
  maxColdSpread: number | null;
  maxHotSpread: number | null;
};

/**
 * Cold→hot gain, percentage increase and corner-to-corner spread.
 * Works in whatever unit the values are entered (psi or kPa) — convert at the UI edge.
 */
export function pressureCalc(corners: CornerPressure[]): PressureResult {
  const results: PressureCornerResult[] = corners.map((c) => {
    const gain = pos(c.cold) && pos(c.hot) ? c.hot - c.cold : null;
    return {
      label: c.label,
      gain,
      gainPct: gain != null && pos(c.cold) ? (gain / c.cold) * 100 : null,
    };
  });
  const spread = (pick: (c: CornerPressure) => number | null) => {
    const vals = corners.map(pick).filter((v): v is number => pos(v));
    return vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : null;
  };
  return { corners: results, maxColdSpread: spread((c) => c.cold), maxHotSpread: spread((c) => c.hot) };
}

// ───────────────────────── Suspension ─────────────────────────

/** Wheel rate (N/mm) from spring rate (N/mm) and motion ratio. WR = SR × MR² */
export function wheelRate(springRateNPerMm: number, motionRatio: number): number | null {
  if (!pos(springRateNPerMm) || !pos(motionRatio)) return null;
  return springRateNPerMm * motionRatio * motionRatio;
}

/**
 * Approximate suspension (ride) frequency in Hz.
 * f = (1/2π) × √(K / m), K in N/m, m = sprung mass at that corner in kg.
 * Assumes a single-wheel model, damping ignored.
 */
export function suspensionFrequencyHz(wheelRateNPerMm: number, sprungMassKg: number): number | null {
  if (!pos(wheelRateNPerMm) || !pos(sprungMassKg)) return null;
  return Math.sqrt((wheelRateNPerMm * 1000) / sprungMassKg) / (2 * Math.PI);
}

/**
 * Ride-height change at the wheel from a spring-perch adjustment.
 * Wheel movement = perch movement / motion ratio.
 */
export function rideHeightChangeMm(perchAdjustmentMm: number, motionRatio: number): number | null {
  if (typeof perchAdjustmentMm !== "number" || !Number.isFinite(perchAdjustmentMm) || !pos(motionRatio)) return null;
  return perchAdjustmentMm / motionRatio;
}

// ───────────────────────── Gearing ─────────────────────────

/** Overall ratio = gear ratio × final drive. */
export function overallRatio(gearRatio: number, finalDrive: number): number | null {
  if (!pos(gearRatio) || !pos(finalDrive)) return null;
  return gearRatio * finalDrive;
}

/**
 * Theoretical road speed (km/h) at a given RPM.
 * speed = rpm × 60 × π × tyreDiameter(mm) / (overallRatio × 1e6)
 * Assumes zero tyre slip and no rev limiter.
 */
export function speedAtRpmKmh(rpm: number, overall: number, tyreDiameterMm: number): number | null {
  if (!pos(rpm) || !pos(overall) || !pos(tyreDiameterMm)) return null;
  return (rpm * 60 * Math.PI * tyreDiameterMm) / (overall * 1e6);
}

/** Speed difference (km/h) between two gear ratios at the same RPM and tyre. */
export function speedDifferenceKmh(
  rpm: number,
  gearA: number,
  gearB: number,
  finalDrive: number,
  tyreDiameterMm: number,
): { speedA: number; speedB: number; diff: number } | null {
  const oa = overallRatio(gearA, finalDrive);
  const ob = overallRatio(gearB, finalDrive);
  if (oa == null || ob == null) return null;
  const speedA = speedAtRpmKmh(rpm, oa, tyreDiameterMm);
  const speedB = speedAtRpmKmh(rpm, ob, tyreDiameterMm);
  if (speedA == null || speedB == null) return null;
  return { speedA, speedB, diff: speedB - speedA };
}

// ───────────────────────── Saved vehicle gearbox ─────────────────────────

export type GearboxSpec = {
  finalDrive: number | null;
  tyreDiameterMm: number | null;
  gears: { label: string; ratio: number | null }[];
};

export const EMPTY_GEARBOX: GearboxSpec = {
  finalDrive: null,
  tyreDiameterMm: null,
  gears: [
    { label: "1st", ratio: null },
    { label: "2nd", ratio: null },
    { label: "3rd", ratio: null },
    { label: "4th", ratio: null },
    { label: "5th", ratio: null },
    { label: "6th", ratio: null },
  ],
};

/** Parse a stored gearbox JSON blob defensively; anything unexpected becomes EMPTY_GEARBOX. */
export function parseGearbox(raw: unknown): GearboxSpec {
  if (!raw || typeof raw !== "object") return EMPTY_GEARBOX;
  const o = raw as Record<string, unknown>;
  const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  const gears = Array.isArray(o.gears)
    ? o.gears
        .filter((g): g is Record<string, unknown> => !!g && typeof g === "object")
        .map((g, i) => ({
          label: typeof g.label === "string" && g.label.trim() ? g.label.slice(0, 12) : `Gear ${i + 1}`,
          ratio: numOrNull(g.ratio),
        }))
    : EMPTY_GEARBOX.gears;
  return {
    finalDrive: numOrNull(o.finalDrive),
    tyreDiameterMm: numOrNull(o.tyreDiameterMm),
    gears: gears.length ? gears : EMPTY_GEARBOX.gears,
  };
}
