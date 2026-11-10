// Pure tyre analysis helpers for the Tyres module.
// Everything here is an *observation* from recorded data — never a definitive
// pressure, camber or alignment recommendation (data is always incomplete).

export type Corner = "fl" | "fr" | "rl" | "rr";
export const CORNERS: Corner[] = ["fl", "fr", "rl", "rr"];

export type CornerTemps = { inner: number | null; mid: number | null; outer: number | null };

export type TyreReading = {
  cold: Partial<Record<Corner, number | null>>;
  hot: Partial<Record<Corner, number | null>>;
  tread: Partial<Record<Corner, number | null>>;
  temps: Partial<Record<Corner, CornerTemps>>;
};

export type PressureGain = { psi: number; pct: number };

/** Pressure increase from cold to hot, in psi and as a percentage of cold. */
export function pressureGain(cold: number | null | undefined, hot: number | null | undefined): PressureGain | null {
  if (cold == null || hot == null || cold <= 0) return null;
  const psi = hot - cold;
  return { psi, pct: (psi / cold) * 100 };
}

/** Spread (max - min) across the tread for one corner. Null when fewer than two readings. */
export function tempSpread(t: CornerTemps | null | undefined): number | null {
  if (!t) return null;
  const vals = [t.inner, t.mid, t.outer].filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  return Math.max(...vals) - Math.min(...vals);
}

/** Inner-vs-outer gradient for one corner. Positive = inner hotter. Null when either side missing. */
export function innerOuterDelta(t: CornerTemps | null | undefined): number | null {
  if (!t || t.inner == null || t.outer == null) return null;
  return t.inner - t.outer;
}

/** Average of the available tread temps for a corner. */
export function avgTemp(t: CornerTemps | null | undefined): number | null {
  if (!t) return null;
  const vals = [t.inner, t.mid, t.outer].filter((v): v is number => v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Rotate position assignments: mapping says which tyre slot goes to each position. */
export function rotatePositions(
  current: Partial<Record<Corner, number>>,
  mapping: Partial<Record<Corner, number>>,
): Partial<Record<Corner, number>> {
  const next: Partial<Record<Corner, number>> = { ...current };
  for (const c of CORNERS) {
    if (mapping[c] != null) next[c] = mapping[c];
  }
  return next;
}

/** Common rotation presets: value = the slot that moves TO each position. */
export function rotationPreset(
  current: Partial<Record<Corner, number>>,
  preset: "front-to-rear" | "cross" | "rear-to-front",
): Partial<Record<Corner, number>> {
  const c = current;
  switch (preset) {
    case "front-to-rear":
      return { fl: c.rl, fr: c.rr, rl: c.fl, rr: c.fr };
    case "rear-to-front":
      return { fl: c.fr, fr: c.fl, rl: c.rr, rr: c.rl };
    case "cross":
      return { fl: c.rr, fr: c.rl, rl: c.fr, rr: c.fl };
  }
}

// ---- Observations ---------------------------------------------------------

export type Observation = {
  severity: "info" | "watch" | "flag";
  corner?: Corner;
  text: string;
};

// Thresholds chosen conservatively; observations only ever say "worth a look".
export const HIGH_GAIN_PSI = 4;
export const HIGH_GAIN_PCT = 25;
export const TEMP_SPREAD_FLAG_C = 12;
export const INNER_OUTER_FLAG_C = 8;
export const LEFT_RIGHT_FLAG_C = 10;
export const LOW_TREAD_MM = 2;
export const UNEVEN_WEAR_MM = 1;

const cornerLabel = (c: Corner) => c.toUpperCase();

export function analyzeTyreReading(r: TyreReading): Observation[] {
  const obs: Observation[] = [];

  // Pressure gains per corner
  const gains: Partial<Record<Corner, PressureGain>> = {};
  for (const c of CORNERS) {
    const g = pressureGain(r.cold[c], r.hot[c]);
    if (g) gains[c] = g;
    if (g && (g.psi >= HIGH_GAIN_PSI || g.pct >= HIGH_GAIN_PCT)) {
      obs.push({
        severity: "flag",
        corner: c,
        text: `${cornerLabel(c)} gained ${g.psi.toFixed(1)} psi (${g.pct.toFixed(0)}%) cold→hot — an unusually large build. Worth checking cold pressure, tyre condition and how hard that corner is working.`,
      });
    }
  }

  // Uneven build left vs right
  const leftGains = [gains.fl, gains.rl].filter((g): g is PressureGain => !!g);
  const rightGains = [gains.fr, gains.rr].filter((g): g is PressureGain => !!g);
  if (leftGains.length && rightGains.length) {
    const l = leftGains.reduce((a, g) => a + g.psi, 0) / leftGains.length;
    const rr = rightGains.reduce((a, g) => a + g.psi, 0) / rightGains.length;
    if (Math.abs(l - rr) >= 1.5) {
      obs.push({
        severity: "watch",
        text: `Pressure build differs left vs right (${l.toFixed(1)} psi vs ${rr.toFixed(1)} psi average). Normal on one-sided circuits; otherwise worth noting.`,
      });
    }
  }

  // Temperature distribution
  for (const c of CORNERS) {
    const t = r.temps[c];
    const spread = tempSpread(t);
    if (spread != null && spread >= TEMP_SPREAD_FLAG_C) {
      obs.push({
        severity: "flag",
        corner: c,
        text: `${cornerLabel(c)} tread temps vary by ${spread.toFixed(0)}°C across the tyre — uneven temperature distribution. Often linked to pressure or camber, but confirm with more data before changing anything.`,
      });
    }
    const io = innerOuterDelta(t);
    if (io != null && Math.abs(io) >= INNER_OUTER_FLAG_C) {
      obs.push({
        severity: "watch",
        corner: c,
        text: io > 0
          ? `${cornerLabel(c)} inner edge runs ${io.toFixed(0)}°C hotter than the outer. Can indicate camber or pressure effects — observe over more sessions before adjusting.`
          : `${cornerLabel(c)} outer edge runs ${Math.abs(io).toFixed(0)}°C hotter than the inner. Can indicate camber or pressure effects — observe over more sessions before adjusting.`,
      });
    }
  }

  // Left vs right average temps
  const lTemps = [avgTemp(r.temps.fl), avgTemp(r.temps.rl)].filter((v): v is number => v != null);
  const rTemps = [avgTemp(r.temps.fr), avgTemp(r.temps.rr)].filter((v): v is number => v != null);
  if (lTemps.length && rTemps.length) {
    const l = lTemps.reduce((a, b) => a + b, 0) / lTemps.length;
    const rr2 = rTemps.reduce((a, b) => a + b, 0) / rTemps.length;
    if (Math.abs(l - rr2) >= LEFT_RIGHT_FLAG_C) {
      obs.push({
        severity: "watch",
        text: `Left-side tyres average ${l.toFixed(0)}°C vs ${rr2.toFixed(0)}°C on the right — a notable left/right difference, typical of circuits that load one side more.`,
      });
    }
  }

  // Wear
  for (const c of CORNERS) {
    const tread = r.tread[c];
    if (tread != null && tread <= LOW_TREAD_MM) {
      obs.push({
        severity: "flag",
        corner: c,
        text: `${cornerLabel(c)} tread is at ${tread.toFixed(1)} mm — at or below the usual change threshold. Possible excessive wear on this corner.`,
      });
    }
  }
  const lTread = [r.tread.fl, r.tread.rl].filter((v): v is number => v != null);
  const rTread = [r.tread.fr, r.tread.rr].filter((v): v is number => v != null);
  if (lTread.length && rTread.length) {
    const l = Math.min(...lTread);
    const rr3 = Math.min(...rTread);
    if (Math.abs(l - rr3) >= UNEVEN_WEAR_MM) {
      obs.push({
        severity: "watch",
        text: `Tread differs left vs right by ${Math.abs(l - rr3).toFixed(1)} mm — uneven wear across the axle. Rotating the set may even out remaining life.`,
      });
    }
  }

  return obs;
}

/** Accumulated laps / distance / heat-cycle count for a set across its history. */
export function setTotals(records: { laps?: number | null; distance_km?: number | null; heat_cycles?: number | null }[]) {
  return {
    laps: records.reduce((a, r) => a + (r.laps ?? 0), 0),
    distanceKm: records.reduce((a, r) => a + (r.distance_km ?? 0), 0),
    heatCycles: records.reduce((a, r) => a + (r.heat_cycles ?? 0), 0),
  };
}
