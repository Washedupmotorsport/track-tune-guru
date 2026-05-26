import type { DisciplineId } from "./disciplines";

export type Drivetrain = "FWD" | "RWD" | "AWD";
export type TireType = "street" | "semi_slick" | "slick" | "wet" | "drag_radial" | "rally_gravel" | "rally_tarmac";
export type Surface = "smooth" | "bumpy" | "street" | "loose" | "dirt";
export type Grip = "low" | "medium" | "high";

export type BaselineInput = {
  discipline: DisciplineId;
  drivetrain: Drivetrain;
  weightKg: number;       // total car weight
  frontBiasPct: number;   // 40-65 typical
  tire: TireType;
  surface: Surface;
  grip: Grip;
  ambientC: number;
  aero: boolean;          // has meaningful aero?
};

export type BaselineRow = { key: string; label: string; value: string; unit?: string; rationale?: string };

const round = (n: number, step = 0.5) => Math.round(n / step) * step;
const fmt = (n: number, d = 1) => Number.isFinite(n) ? n.toFixed(d) : "—";

/**
 * Heuristic baseline. Numbers are starting points only — every car/track is different.
 */
export function generateBaseline(input: BaselineInput): { rows: BaselineRow[]; setupData: Record<string, string> } {
  const { discipline, drivetrain, weightKg, frontBiasPct, tire, surface, grip, ambientC, aero } = input;
  const rearBiasPct = 100 - frontBiasPct;
  const cornerF = (weightKg * (frontBiasPct / 100)) / 2;
  const cornerR = (weightKg * (rearBiasPct / 100)) / 2;

  // ---- Tire pressures (cold, psi) ----
  // base by tire type
  const baseByTire: Record<TireType, number> = {
    street: 32, semi_slick: 28, slick: 24, wet: 26,
    drag_radial: 18, rally_gravel: 22, rally_tarmac: 28,
  };
  let coldF = baseByTire[tire];
  let coldR = baseByTire[tire];
  // weight scaling: heavier corners → +psi
  coldF += (cornerF - 350) / 100;
  coldR += (cornerR - 350) / 100;
  // ambient adjust (cooler = +psi target so hot lands higher)
  const tempAdj = (20 - ambientC) * 0.05;
  coldF += tempAdj; coldR += tempAdj;
  // surface
  if (surface === "bumpy" || surface === "loose" || surface === "dirt") { coldF -= 1; coldR -= 1; }
  // discipline overrides
  if (discipline === "drift") { coldF = 32; coldR = 38; }
  if (discipline === "drag") { coldF = 35; coldR = 18; }

  // ---- Camber (degrees, negative) ----
  const camberByDisc: Record<DisciplineId, [number, number]> = {
    circuit: [-3.0, -2.2],
    autocross: [-2.5, -1.8],
    drift: [-4.0, -1.5],
    drag: [-0.5, -0.5],
    rally: [-1.0, -0.8],
    oval: [-3.5, -2.0],
  };
  let [camF, camR] = camberByDisc[discipline];
  if (grip === "low") { camF += 0.5; camR += 0.5; }
  if (grip === "high") { camF -= 0.3; camR -= 0.3; }
  if (drivetrain === "FWD") camR -= 0.3; // more rear camber to rotate
  if (drivetrain === "RWD") camR += 0.2; // less rear neg for traction

  // ---- Toe (degrees, + = toe-in) ----
  let toeF = 0.05, toeR = 0.10;
  if (discipline === "drift") { toeF = -0.20; toeR = 0.20; }
  if (discipline === "drag") { toeF = 0.05; toeR = 0.00; }
  if (drivetrain === "FWD") { toeF = -0.05; toeR = 0.15; }
  if (drivetrain === "RWD" && discipline === "circuit") { toeF = 0.00; toeR = 0.15; }

  // ---- Caster ----
  const caster = discipline === "drift" ? 7.5 : discipline === "drag" ? 3.0 : 5.5;

  // ---- Toe converted to mm (measured across a reference wheel diameter) ----
  // Using 380mm (~15" rim) as a common reference. toe_mm = D * tan(angle)
  const TOE_REF_DIAMETER_MM = 380;
  const toeDegToMm = (deg: number) => TOE_REF_DIAMETER_MM * Math.tan((deg * Math.PI) / 180);
  const toeFmm = toeDegToMm(toeF);
  const toeRmm = toeDegToMm(toeR);

  // ---- Springs (kg/mm) — based on corner weight & discipline ----
  const stiffnessFactor =
    discipline === "circuit" ? 0.30 :
    discipline === "autocross" ? 0.26 :
    discipline === "oval" ? 0.32 :
    discipline === "drift" ? 0.22 :
    discipline === "rally" ? 0.12 :
    0.18;
  let springF = round(cornerF * stiffnessFactor, 2);
  let springR = round(cornerR * stiffnessFactor, 2);
  if (drivetrain === "FWD") springR = round(springR * 1.15, 2);
  if (drivetrain === "RWD") springF = round(springF * 1.10, 2);
  if (aero) { springF = round(springF * 1.20, 2); springR = round(springR * 1.20, 2); }

  // ---- Ride height (mm) ----
  const rhBase = discipline === "rally" ? 180 : discipline === "drift" ? 110 : aero ? 70 : 95;
  const rhF = rhBase;
  const rhR = rhBase + (aero ? 15 : 8); // rake

  // ---- Brake bias (% front) ----
  const biasBase = Math.round(frontBiasPct + 5);
  const brakeBias = discipline === "drift" ? 70 : discipline === "drag" ? 75 : Math.min(68, Math.max(54, biasBase));

  // ---- Dampers (clicks 1-20) ----
  const compF = grip === "high" ? 10 : 8;
  const compR = grip === "high" ? 9 : 7;
  const rebF = compF + 2;
  const rebR = compR + 2;

  // ---- ARB ----
  const arbBalance =
    drivetrain === "FWD" ? "Front: soft · Rear: stiff" :
    drivetrain === "RWD" ? "Front: medium · Rear: soft-medium" :
    "Front: medium · Rear: medium";

  const rows: BaselineRow[] = [
    { key: "psi_lf", label: "Cold PSI Front", value: fmt(coldF), unit: "psi", rationale: `${tire} base + corner weight ${fmt(cornerF,0)}kg` },
    { key: "psi_rf", label: "Cold PSI Front", value: fmt(coldF), unit: "psi" },
    { key: "psi_lr", label: "Cold PSI Rear", value: fmt(coldR), unit: "psi", rationale: `${tire} base + corner weight ${fmt(cornerR,0)}kg` },
    { key: "psi_rr", label: "Cold PSI Rear", value: fmt(coldR), unit: "psi" },
    { key: "camber_lf", label: "Camber Front", value: fmt(camF, 1), unit: "°", rationale: `${discipline} + ${grip} grip` },
    { key: "camber_rf", label: "Camber Front", value: fmt(camF, 1), unit: "°" },
    { key: "camber_lr", label: "Camber Rear", value: fmt(camR, 1), unit: "°", rationale: `${drivetrain} balance` },
    { key: "camber_rr", label: "Camber Rear", value: fmt(camR, 1), unit: "°" },
    { key: "toe_front", label: "Toe Front", value: fmt(toeFmm, 2), unit: "mm", rationale: `${toeF < 0 ? "toe-out for turn-in" : "toe-in for stability"} (@ ${TOE_REF_DIAMETER_MM}mm ref)` },
    { key: "toe_rear", label: "Toe Rear", value: fmt(toeRmm, 2), unit: "mm", rationale: `rear toe-in for stability (@ ${TOE_REF_DIAMETER_MM}mm ref)` },
    { key: "caster", label: "Caster", value: fmt(caster, 1), unit: "°" },
    { key: "spring_front", label: "Spring Front", value: fmt(springF / 9.80665, 1), unit: "kg/mm", rationale: `~${(stiffnessFactor*100).toFixed(0)}% of corner weight` },
    { key: "spring_rear", label: "Spring Rear", value: fmt(springR / 9.80665, 1), unit: "kg/mm" },
    { key: "ride_front", label: "Ride Height F", value: fmt(rhF, 0), unit: "mm" },
    { key: "ride_rear", label: "Ride Height R", value: fmt(rhR, 0), unit: "mm", rationale: `${rhR - rhF}mm rake` },
    { key: "arb_front", label: "ARB", value: arbBalance, rationale: `tuned for ${drivetrain}` },
    { key: "arb_rear", label: "ARB", value: arbBalance },
    { key: "comp_front", label: "Damp Comp F", value: String(compF) },
    { key: "comp_rear", label: "Damp Comp R", value: String(compR) },
    { key: "reb_front", label: "Damp Reb F", value: String(rebF) },
    { key: "reb_rear", label: "Damp Reb R", value: String(rebR) },
    { key: "brake_bias", label: "Brake Bias %F", value: String(brakeBias), unit: "%" },
  ];

  const setupData: Record<string, string> = {};
  for (const r of rows) setupData[r.key] = r.value;

  return { rows, setupData };
}