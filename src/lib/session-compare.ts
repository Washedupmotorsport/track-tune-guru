// Pure, client-safe session comparison logic.
// Diffs two setups' setup_data maps and computes lap/sector performance deltas.
// Deliberately descriptive only: it reports what changed and what was measured,
// never claims a change caused a result (see CORRELATION_NOTE).

export type SetupData = Record<string, string | number | null | undefined>;

export type SetupFieldDef = { key: string; label: string; group: string };

// Known setup_data keys in display order. Unknown keys are still diffed,
// labelled from their key name, and grouped as "Other".
export const SETUP_FIELDS: SetupFieldDef[] = [
  { key: "psi_lf", label: "Cold pressure FL", group: "Tyre pressures" },
  { key: "psi_rf", label: "Cold pressure FR", group: "Tyre pressures" },
  { key: "psi_lr", label: "Cold pressure RL", group: "Tyre pressures" },
  { key: "psi_rr", label: "Cold pressure RR", group: "Tyre pressures" },
  { key: "hot_psi_lf", label: "Hot pressure FL", group: "Tyre pressures" },
  { key: "hot_psi_rf", label: "Hot pressure FR", group: "Tyre pressures" },
  { key: "hot_psi_lr", label: "Hot pressure RL", group: "Tyre pressures" },
  { key: "hot_psi_rr", label: "Hot pressure RR", group: "Tyre pressures" },
  { key: "camber_lf", label: "Camber FL", group: "Camber, caster & toe" },
  { key: "camber_rf", label: "Camber FR", group: "Camber, caster & toe" },
  { key: "camber_lr", label: "Camber RL", group: "Camber, caster & toe" },
  { key: "camber_rr", label: "Camber RR", group: "Camber, caster & toe" },
  { key: "caster", label: "Caster", group: "Camber, caster & toe" },
  { key: "toe_front", label: "Toe front", group: "Camber, caster & toe" },
  { key: "toe_rear", label: "Toe rear", group: "Camber, caster & toe" },
  { key: "comp_front", label: "Compression front", group: "Dampers" },
  { key: "comp_rear", label: "Compression rear", group: "Dampers" },
  { key: "reb_front", label: "Rebound front", group: "Dampers" },
  { key: "reb_rear", label: "Rebound rear", group: "Dampers" },
  { key: "spring_front", label: "Spring rate front", group: "Springs" },
  { key: "spring_rear", label: "Spring rate rear", group: "Springs" },
  { key: "arb_front", label: "Anti-roll bar front", group: "Anti-roll bars" },
  { key: "arb_rear", label: "Anti-roll bar rear", group: "Anti-roll bars" },
  { key: "ride_front", label: "Ride height front", group: "Ride heights" },
  { key: "ride_rear", label: "Ride height rear", group: "Ride heights" },
  { key: "wing_front", label: "Front wing", group: "Aerodynamics" },
  { key: "wing_rear", label: "Rear wing", group: "Aerodynamics" },
  { key: "splitter", label: "Splitter", group: "Aerodynamics" },
  { key: "diffuser", label: "Diffuser", group: "Aerodynamics" },
  { key: "diff_preload", label: "Diff preload", group: "Differential" },
  { key: "diff_power", label: "Diff power side", group: "Differential" },
  { key: "diff_coast", label: "Diff coast side", group: "Differential" },
  { key: "fuel_load", label: "Fuel load", group: "Fuel" },
  { key: "brake_bias", label: "Brake bias % front", group: "Brakes" },
];

const FIELD_INDEX = new Map(SETUP_FIELDS.map((f, i) => [f.key, i]));

function prettifyKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fieldDefFor(key: string): SetupFieldDef {
  const known = SETUP_FIELDS.find((f) => f.key === key);
  if (known) return known;
  return { key, label: prettifyKey(key), group: "Other" };
}

function norm(v: string | number | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export type SetupDiffRow = {
  key: string;
  label: string;
  group: string;
  a: string | null;
  b: string | null;
  changed: boolean;
  /** "a" when only session A is missing a value, "b" likewise, null when both have one. */
  missingIn: "a" | "b" | null;
};

/**
 * Diff two setup_data maps. Returns every key present in either setup,
 * known fields first (in SETUP_FIELDS order), then unknown keys alphabetically.
 */
export function diffSetupData(a: SetupData, b: SetupData): SetupDiffRow[] {
  const keys = new Set<string>([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  const rows: SetupDiffRow[] = [];
  for (const key of keys) {
    const def = fieldDefFor(key);
    const av = norm(a?.[key]);
    const bv = norm(b?.[key]);
    const changed = av !== bv;
    rows.push({
      key,
      label: def.label,
      group: def.group,
      a: av,
      b: bv,
      changed,
      missingIn: av == null && bv != null ? "a" : bv == null && av != null ? "b" : null,
    });
  }
  return rows.sort((x, y) => {
    const xi = FIELD_INDEX.get(x.key) ?? SETUP_FIELDS.length;
    const yi = FIELD_INDEX.get(y.key) ?? SETUP_FIELDS.length;
    if (xi !== yi) return xi - yi;
    return x.key.localeCompare(y.key);
  });
}

export type LapRow = {
  lap_time_ms: number | null;
  sector_1_ms?: number | null;
  sector_2_ms?: number | null;
  sector_3_ms?: number | null;
};

export type LapStats = {
  count: number;
  bestMs: number | null;
  avgMs: number | null;
  bestS1: number | null;
  bestS2: number | null;
  bestS3: number | null;
};

function bestOf(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return nums.length ? Math.min(...nums) : null;
}

export function lapStats(laps: LapRow[]): LapStats {
  const times = laps.map((l) => l.lap_time_ms).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const avg = times.length ? Math.round(times.reduce((s, v) => s + v, 0) / times.length) : null;
  return {
    count: times.length,
    bestMs: bestOf(times),
    avgMs: avg,
    bestS1: bestOf(laps.map((l) => l.sector_1_ms)),
    bestS2: bestOf(laps.map((l) => l.sector_2_ms)),
    bestS3: bestOf(laps.map((l) => l.sector_3_ms)),
  };
}

export type PerfDelta = {
  label: string;
  aMs: number | null;
  bMs: number | null;
  /** b - a; negative means session B was faster. Null when either side is missing. */
  deltaMs: number | null;
};

export function comparePerformance(a: LapStats, b: LapStats): PerfDelta[] {
  const row = (label: string, aMs: number | null, bMs: number | null): PerfDelta => ({
    label,
    aMs,
    bMs,
    deltaMs: aMs != null && bMs != null ? bMs - aMs : null,
  });
  return [
    row("Best lap", a.bestMs, b.bestMs),
    row("Average lap", a.avgMs, b.avgMs),
    row("Sector 1 (best)", a.bestS1, b.bestS1),
    row("Sector 2 (best)", a.bestS2, b.bestS2),
    row("Sector 3 (best)", a.bestS3, b.bestS3),
  ];
}

/** "+0.350s" / "-0.350s" / "0.000s" */
export function formatDeltaMs(ms: number): string {
  const sign = ms > 0 ? "+" : ms < 0 ? "-" : "";
  return `${sign}${(Math.abs(ms) / 1000).toFixed(3)}s`;
}

/**
 * Human-readable measurable differences for the "What improved?" summary.
 * Only includes rows where both sides have data and the delta is non-zero.
 * Wording stays descriptive ("was faster/slower") — never causal.
 */
export function buildWhatImproved(deltas: PerfDelta[], nameA: string, nameB: string): string[] {
  const lines: string[] = [];
  for (const d of deltas) {
    if (d.deltaMs == null || d.deltaMs === 0) continue;
    const faster = d.deltaMs < 0 ? nameB : nameA;
    lines.push(`${d.label}: ${faster} was ${(Math.abs(d.deltaMs) / 1000).toFixed(3)}s faster`);
  }
  return lines;
}

export const CORRELATION_NOTE =
  "These differences happened alongside the setup changes. Track conditions, traffic, fuel load and the driver also affect lap time — treat this as a clue to test, not proof of cause.";
