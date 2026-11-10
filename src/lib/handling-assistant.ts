// Pure, client-safe handling-issue analysis.
// Turns a recorded handling complaint + the car's recorded setup/tyre/session
// data into possible causes and ONE practical test adjustment.
// Rules baked in (per product brief):
// - never invent missing setup data — gaps are listed under missingData
// - cautious wording only ("may", "could") — no absolute claims
// - braking, suspension and stability issues are safety-critical and flagged
// - recommendations are proposals, never applied to recorded setups

import { SETUP_FIELDS, type SetupData } from "./session-compare";

export type IssueId =
  | "entry_understeer" | "mid_understeer" | "exit_understeer"
  | "entry_oversteer" | "mid_oversteer" | "exit_oversteer"
  | "braking_instability" | "poor_traction" | "wheelspin"
  | "bottoming" | "body_roll";

export type ConditionInput = {
  cornerSpeed?: string;
  brakingPhase?: string;
  throttlePosition?: string;
  trackConditions?: string;
  tyreCondition?: string;
};

export type TyreSnapshot = {
  compound?: string | null;
  cold_fl?: number | null; cold_fr?: number | null; cold_rl?: number | null; cold_rr?: number | null;
  hot_fl?: number | null; hot_fr?: number | null; hot_rl?: number | null; hot_rr?: number | null;
  heat_cycles?: number | null;
  tread_fl?: number | null; tread_fr?: number | null; tread_rl?: number | null; tread_rr?: number | null;
};

type Cause = { id: string; text: string; keys: string[] };
type TestOption = {
  id: string;
  text: string;
  expected: string;
  alsoAffects: string;
  /** Pick this test only when the condition holds; first match wins. */
  when?: (ctx: AnalysisInput) => boolean;
};

type IssueDef = {
  id: IssueId;
  label: string;
  /** Braking, suspension and stability changes are safety-critical. */
  safetyCritical: boolean;
  /** Setup keys the assistant reviews for this issue. */
  relevantKeys: string[];
  causes: Cause[];
  tests: TestOption[];
};

export type AnalysisInput = {
  issueId: IssueId;
  conditions: ConditionInput;
  setupData: SetupData;
  tyre: TyreSnapshot | null;
  /** Number of recorded sessions available for this car. */
  sessionsCount: number;
};

export type CauseOut = { id: string; text: string; evidence: string | null };

export type HandlingAnalysis = {
  issue: { id: IssueId; label: string; safetyCritical: boolean };
  causes: CauseOut[]; // max 3
  recommendedTest: string;
  expectedResult: string;
  alsoAffects: string;
  missingData: string[];
  dataConsidered: string[];
  safetyNote: string | null;
};

const has = (d: SetupData, k: string) => {
  const v = d?.[k];
  return v != null && String(v).trim() !== "";
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Average hot-minus-cold gain across the recorded front (or rear) corners. */
export function pressureGainPsi(tyre: TyreSnapshot, end: "front" | "rear"): number | null {
  const pairs = end === "front"
    ? [[tyre.cold_fl, tyre.hot_fl], [tyre.cold_fr, tyre.hot_fr]]
    : [[tyre.cold_rl, tyre.hot_rl], [tyre.cold_rr, tyre.hot_rr]];
  const gains = pairs
    .map(([c, h]) => (c != null && h != null ? h - c : null))
    .filter((g): g is number => g != null);
  return gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : null;
}

export const HIGH_PRESSURE_GAIN_PSI = 6;

const FRONT_PRESSURE_KEYS = ["psi_lf", "psi_rf", "hot_psi_lf", "hot_psi_rf"];
const REAR_PRESSURE_KEYS = ["psi_lr", "psi_rr", "hot_psi_lr", "hot_psi_rr"];
const FRONT_ALIGNMENT_KEYS = ["camber_lf", "camber_rf", "toe_front", "caster"];
const REAR_ALIGNMENT_KEYS = ["camber_lr", "camber_rr", "toe_rear"];
const FRONT_SUSPENSION_KEYS = ["spring_front", "arb_front", "comp_front", "reb_front", "ride_front"];
const REAR_SUSPENSION_KEYS = ["spring_rear", "arb_rear", "comp_rear", "reb_rear", "ride_rear"];
const AERO_KEYS = ["wing_front", "wing_rear", "splitter", "diffuser"];
const BRAKE_KEYS = ["brake_bias"];
const DIFF_KEYS = ["diff_preload", "diff_power", "diff_coast"];

export const HANDLING_ISSUES: IssueDef[] = [
  {
    id: "entry_understeer",
    label: "Entry understeer",
    safetyCritical: false,
    relevantKeys: [...FRONT_PRESSURE_KEYS, ...FRONT_ALIGNMENT_KEYS, "reb_front", "arb_front", "brake_bias", "diff_coast"],
    causes: [
      { id: "front_grip", text: "Front tyres may not be at their best pressure window for turn-in", keys: FRONT_PRESSURE_KEYS },
      { id: "brake_bias", text: "Brake bias or coast-side diff may be unloading the front on turn-in", keys: ["brake_bias", "diff_coast"] },
      { id: "front_rebound", text: "Front rebound or front roll stiffness may be slowing weight transfer to the front", keys: ["reb_front", "arb_front"] },
      { id: "front_alignment", text: "Front camber/toe may not be giving the front enough bite on entry", keys: FRONT_ALIGNMENT_KEYS },
    ],
    tests: [
      {
        id: "front_pressure",
        text: "Drop front cold pressures by 1 psi and re-check hot pressures after the next run",
        expected: "Front tyres may reach their working window sooner, which could improve initial turn-in bite",
        alsoAffects: "Lower front pressures can increase front tyre wear and may soften steering precision on long runs",
        when: (c) => { const g = c.tyre ? pressureGainPsi(c.tyre, "front") : null; return g != null && g > HIGH_PRESSURE_GAIN_PSI; },
      },
      {
        id: "brake_bias",
        text: "Move brake bias 0.5–1% rearward and trail the brakes slightly less into one corner",
        expected: "More weight may stay on the front tyres at turn-in, which could help the nose bite",
        alsoAffects: "Rearward bias can make the rear lighter under braking — watch for rear movement on entry",
      },
    ],
  },
  {
    id: "mid_understeer",
    label: "Mid-corner understeer",
    safetyCritical: false,
    relevantKeys: [...FRONT_PRESSURE_KEYS, ...FRONT_ALIGNMENT_KEYS, ...FRONT_SUSPENSION_KEYS, "wing_front"],
    causes: [
      { id: "front_pressure", text: "Front tyre pressures may be outside their working window mid-corner", keys: FRONT_PRESSURE_KEYS },
      { id: "front_alignment", text: "Front camber or toe may be giving up front grip at sustained load", keys: FRONT_ALIGNMENT_KEYS },
      { id: "front_roll", text: "Front roll stiffness (springs/anti-roll bar) may be overloading the outside front tyre", keys: ["spring_front", "arb_front"] },
      { id: "front_aero", text: "Front aero balance may be short at this corner speed", keys: ["wing_front", "splitter"] },
    ],
    tests: [
      {
        id: "front_pressure",
        text: "Drop front cold pressures by 1 psi and confirm hot pressures after the next run",
        expected: "A better front pressure window could add mid-corner front grip",
        alsoAffects: "May increase front tyre wear and slightly soften steering response",
        when: (c) => { const g = c.tyre ? pressureGainPsi(c.tyre, "front") : null; return g != null && g > HIGH_PRESSURE_GAIN_PSI; },
      },
      {
        id: "front_arb",
        text: "Soften the front anti-roll bar by one step",
        expected: "The outside front tyre may keep a more even contact patch, which could reduce mid-corner push",
        alsoAffects: "Softer front roll stiffness can add body roll and may change entry response",
      },
    ],
  },
  {
    id: "exit_understeer",
    label: "Exit understeer",
    safetyCritical: false,
    relevantKeys: [...FRONT_PRESSURE_KEYS, "arb_front", "wing_rear", "diff_power", "ride_rear"],
    causes: [
      { id: "diff_power", text: "Power-side diff may be pushing the car wide as throttle is applied", keys: ["diff_power"] },
      { id: "front_aero", text: "Aero balance may be rear-biased at exit speeds", keys: ["wing_front", "wing_rear"] },
      { id: "front_pressure", text: "Front pressures may be too high late in the run", keys: FRONT_PRESSURE_KEYS },
    ],
    tests: [
      {
        id: "diff_power",
        text: "Reduce power-side diff locking one step",
        expected: "The car may rotate more freely on throttle, which could reduce exit push",
        alsoAffects: "Less power locking can increase inside-rear wheelspin on exit",
      },
    ],
  },
  {
    id: "entry_oversteer",
    label: "Entry oversteer",
    safetyCritical: true,
    relevantKeys: [...REAR_PRESSURE_KEYS, "reb_rear", "arb_rear", "brake_bias", "diff_coast", ...REAR_ALIGNMENT_KEYS],
    causes: [
      { id: "brake_bias", text: "Brake bias may be too far rearward for the current grip level", keys: ["brake_bias"] },
      { id: "rear_rebound", text: "Rear rebound or coast diff may be making the rear light on turn-in", keys: ["reb_rear", "diff_coast"] },
      { id: "rear_pressure", text: "Rear pressures may be outside their window, reducing rear stability", keys: REAR_PRESSURE_KEYS },
    ],
    tests: [
      {
        id: "brake_bias",
        text: "Move brake bias 0.5–1% forward and bed it in with gentle braking first",
        expected: "The rear may stay more settled under braking and turn-in",
        alsoAffects: "Forward bias can increase front lock-ups and understeer on entry",
      },
    ],
  },
  {
    id: "mid_oversteer",
    label: "Mid-corner oversteer",
    safetyCritical: true,
    relevantKeys: [...REAR_PRESSURE_KEYS, ...REAR_ALIGNMENT_KEYS, ...REAR_SUSPENSION_KEYS, "wing_rear"],
    causes: [
      { id: "rear_roll", text: "Rear roll stiffness may be overloading the outside rear tyre", keys: ["spring_rear", "arb_rear"] },
      { id: "rear_alignment", text: "Rear camber/toe may be giving up rear grip at sustained load", keys: REAR_ALIGNMENT_KEYS },
      { id: "rear_pressure", text: "Rear pressures may be outside their working window", keys: REAR_PRESSURE_KEYS },
      { id: "rear_aero", text: "Rear aero may be short at this corner speed", keys: ["wing_rear", "diffuser"] },
    ],
    tests: [
      {
        id: "rear_arb",
        text: "Soften the rear anti-roll bar by one step",
        expected: "The outside rear tyre may keep a more even contact patch, which could calm mid-corner rotation",
        alsoAffects: "Softer rear roll stiffness can add body roll and may dull direction changes",
      },
    ],
  },
  {
    id: "exit_oversteer",
    label: "Exit oversteer",
    safetyCritical: true,
    relevantKeys: [...REAR_PRESSURE_KEYS, "diff_power", "arb_rear", "reb_rear", "wing_rear"],
    causes: [
      { id: "diff_power", text: "Power-side diff may be too open, spinning the inside rear", keys: ["diff_power"] },
      { id: "rear_pressure", text: "Rear pressures may be too high, reducing traction", keys: REAR_PRESSURE_KEYS },
      { id: "rear_roll", text: "Rear roll stiffness may be unloading the inside rear on exit", keys: ["arb_rear", "spring_rear"] },
    ],
    tests: [
      {
        id: "rear_pressure",
        text: "Drop rear cold pressures by 1 psi and confirm hot pressures after the next run",
        expected: "A better rear pressure window could add traction and calm exit snap",
        alsoAffects: "Lower rear pressures can increase rear tyre wear and slightly soften rear response",
        when: (c) => { const g = c.tyre ? pressureGainPsi(c.tyre, "rear") : null; return g != null && g > HIGH_PRESSURE_GAIN_PSI; },
      },
      {
        id: "diff_power",
        text: "Add one step of power-side diff locking",
        expected: "Drive may be shared more evenly across the rear, which could reduce inside-rear spin",
        alsoAffects: "More power locking can push the car wide (exit understeer)",
      },
    ],
  },
  {
    id: "braking_instability",
    label: "Braking instability",
    safetyCritical: true,
    relevantKeys: [...BRAKE_KEYS, ...REAR_PRESSURE_KEYS, "reb_rear", "ride_rear", "diff_coast"],
    causes: [
      { id: "brake_bias", text: "Brake bias may be too far rearward for current grip", keys: ["brake_bias"] },
      { id: "rear_rebound", text: "Rear rebound may be letting the rear lift and wander under braking", keys: ["reb_rear"] },
      { id: "ride_height", text: "Rear ride height or rake may be shifting too much weight forward under braking", keys: ["ride_rear", "ride_front"] },
    ],
    tests: [
      {
        id: "brake_bias",
        text: "Move brake bias 0.5–1% forward, then build braking pressure gradually over the next run",
        expected: "The rear may stay more planted under braking",
        alsoAffects: "Forward bias can increase front lock-ups and entry understeer",
      },
    ],
  },
  {
    id: "poor_traction",
    label: "Poor traction",
    safetyCritical: false,
    relevantKeys: [...REAR_PRESSURE_KEYS, ...REAR_SUSPENSION_KEYS, "diff_power", ...REAR_ALIGNMENT_KEYS],
    causes: [
      { id: "rear_pressure", text: "Rear pressures may be outside their window, shrinking the contact patch", keys: REAR_PRESSURE_KEYS },
      { id: "rear_springs", text: "Rear springs or dampers may be too stiff to keep the rear tyres planted", keys: ["spring_rear", "comp_rear", "reb_rear"] },
      { id: "diff_power", text: "Power-side diff may not be putting drive down evenly", keys: ["diff_power"] },
    ],
    tests: [
      {
        id: "rear_pressure",
        text: "Drop rear cold pressures by 1 psi and confirm hot pressures after the next run",
        expected: "A larger, more even rear contact patch could improve drive off the corners",
        alsoAffects: "Lower rear pressures can increase rear tyre wear",
        when: (c) => { const g = c.tyre ? pressureGainPsi(c.tyre, "rear") : null; return g != null && g > HIGH_PRESSURE_GAIN_PSI; },
      },
      {
        id: "rear_comp",
        text: "Soften rear compression damping by one click",
        expected: "The rear may follow the surface better, which could put power down more consistently",
        alsoAffects: "Softer rear compression can add squat and body movement on exit",
      },
    ],
  },
  {
    id: "wheelspin",
    label: "Excessive wheelspin",
    safetyCritical: false,
    relevantKeys: [...REAR_PRESSURE_KEYS, "diff_power", "arb_rear", "spring_rear"],
    causes: [
      { id: "diff_power", text: "Power-side diff may be too open, letting the inside rear spin", keys: ["diff_power"] },
      { id: "rear_pressure", text: "Rear pressures may be too high for the current track grip", keys: REAR_PRESSURE_KEYS },
      { id: "rear_roll", text: "Rear roll stiffness may be unloading the inside rear tyre", keys: ["arb_rear", "spring_rear"] },
    ],
    tests: [
      {
        id: "diff_power",
        text: "Add one step of power-side diff locking",
        expected: "Drive may be shared more evenly, which could reduce inside-rear spin",
        alsoAffects: "More power locking can push the car wide on exit",
      },
    ],
  },
  {
    id: "bottoming",
    label: "Bottoming",
    safetyCritical: true,
    relevantKeys: ["ride_front", "ride_rear", "spring_front", "spring_rear", "comp_front", "comp_rear"],
    causes: [
      { id: "ride_height", text: "Ride heights may be too low for this track's bumps and kerbs", keys: ["ride_front", "ride_rear"] },
      { id: "springs", text: "Spring rates may be too soft, letting the chassis reach the bump stops", keys: ["spring_front", "spring_rear"] },
      { id: "compression", text: "Compression damping may be too soft over compressions", keys: ["comp_front", "comp_rear"] },
    ],
    tests: [
      {
        id: "ride_height",
        text: "Raise ride height by one small step (2–3 mm) at the end that bottoms",
        expected: "The chassis may clear the bumps, which could restore a consistent platform",
        alsoAffects: "Higher ride height can raise the centre of gravity and may reduce aero efficiency",
      },
    ],
  },
  {
    id: "body_roll",
    label: "Excessive body roll",
    safetyCritical: false,
    relevantKeys: ["arb_front", "arb_rear", "spring_front", "spring_rear", "comp_front", "comp_rear"],
    causes: [
      { id: "arb", text: "Anti-roll bars may be too soft for the current grip level", keys: ["arb_front", "arb_rear"] },
      { id: "springs", text: "Spring rates may be too soft, allowing excessive roll", keys: ["spring_front", "spring_rear"] },
      { id: "dampers", text: "Compression damping may be too soft in transient roll", keys: ["comp_front", "comp_rear"] },
    ],
    tests: [
      {
        id: "arb",
        text: "Stiffen the anti-roll bar at the end that rolls most by one step",
        expected: "The car may roll less, which could sharpen response and keep the tyre contact patches more even",
        alsoAffects: "Stiffer roll control can reduce mechanical grip over bumps and kerbs",
      },
    ],
  },
];

export function issueById(id: IssueId): IssueDef {
  const def = HANDLING_ISSUES.find((i) => i.id === id);
  if (!def) throw new Error(`Unknown handling issue: ${id}`);
  return def;
}

const CONDITION_LABELS: [keyof ConditionInput, string][] = [
  ["cornerSpeed", "Corner speed"],
  ["brakingPhase", "Braking phase"],
  ["throttlePosition", "Throttle position"],
  ["trackConditions", "Track conditions"],
  ["tyreCondition", "Tyre condition"],
];

const fieldLabel = (key: string) => SETUP_FIELDS.find((f) => f.key === key)?.label ?? key;

/**
 * Analyse a handling complaint against recorded data.
 * Causes are capped at 3; each cause carries an evidence note only when the
 * related setup values are actually recorded — nothing is invented.
 */
export function analyzeHandlingIssue(input: AnalysisInput): HandlingAnalysis {
  const def = issueById(input.issueId);
  const setup = input.setupData ?? {};

  // Causes: prefer those whose related setup data is recorded, keep max 3.
  const withEvidence = def.causes.map((c) => {
    const recorded = c.keys.filter((k) => has(setup, k));
    const evidence = recorded.length
      ? `Recorded: ${recorded.map((k) => `${fieldLabel(k)} = ${setup[k]}`).join(", ")}`
      : null;
    return { id: c.id, text: c.text, evidence, hasData: recorded.length > 0 };
  });
  const causes: CauseOut[] = [...withEvidence]
    .sort((a, b) => Number(b.hasData) - Number(a.hasData))
    .slice(0, 3)
    .map(({ id, text, evidence }) => ({ id, text, evidence }));

  // Recommended test: first matching option, else the first (default) option.
  const test = def.tests.find((t) => !t.when || t.when(input)) ?? def.tests[0];

  // Missing data: relevant setup keys not recorded + missing conditions + context gaps.
  const missingData: string[] = [];
  const missingKeys = def.relevantKeys.filter((k) => !has(setup, k));
  if (missingKeys.length) {
    missingData.push(`Setup values not recorded: ${missingKeys.map(fieldLabel).join(", ")}`);
  }
  if (!input.tyre) missingData.push("No tyre pressure/temperature log recorded for this car");
  for (const [key, label] of CONDITION_LABELS) {
    const v = input.conditions?.[key];
    if (!v || !String(v).trim()) missingData.push(`${label} not specified`);
  }
  if (input.sessionsCount === 0) missingData.push("No previous sessions recorded for this car to compare against");

  // What was actually reviewed — transparency for the driver.
  const dataConsidered: string[] = [];
  const considered = (label: string, keys: string[]) => {
    if (keys.some((k) => has(setup, k))) dataConsidered.push(label);
  };
  considered("Tyre pressures", [...FRONT_PRESSURE_KEYS, ...REAR_PRESSURE_KEYS]);
  considered("Alignment (camber, caster, toe)", [...FRONT_ALIGNMENT_KEYS, ...REAR_ALIGNMENT_KEYS]);
  considered("Springs, dampers & anti-roll bars", [...FRONT_SUSPENSION_KEYS, ...REAR_SUSPENSION_KEYS]);
  considered("Aerodynamics", AERO_KEYS);
  considered("Brakes", BRAKE_KEYS);
  considered("Differential", DIFF_KEYS);
  if (input.tyre) dataConsidered.push("Latest tyre log (pressures, compound, condition)");
  if (input.sessionsCount > 0) dataConsidered.push(`${input.sessionsCount} recorded session${input.sessionsCount === 1 ? "" : "s"} of history`);

  const safetyNote = def.safetyCritical
    ? "This affects braking, suspension or vehicle stability. Change one small step at a time, build speed gradually, and stop if the car feels worse."
    : null;

  return {
    issue: { id: def.id, label: def.label, safetyCritical: def.safetyCritical },
    causes,
    recommendedTest: test.text,
    expectedResult: test.expected,
    alsoAffects: test.alsoAffects,
    missingData,
    dataConsidered,
    safetyNote,
  };
}

export const RECOMMENDATION_NOTE =
  "This is a proposed test based on what is recorded — not a verified result. Record what you actually changed and how the next session went before treating it as confirmed.";
