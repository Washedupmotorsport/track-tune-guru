/** Educational scenario only: not a vehicle physics model or setup recommendation. */
export type DemoSurface = "dry" | "damp" | "wet";
export type DemoSetup = { surface: DemoSurface; temperature: number; pressure: number; frontBar: number };

export const DEMO_BASELINE: DemoSetup = { surface: "dry", temperature: 32, pressure: 22, frontBar: 3 };
export const DEMO_LIMITS = { temperature: [15, 55], pressure: [18, 28], frontBar: [1, 5] } as const;

export function exploreSetup(input: DemoSetup) {
  const temperature = Math.min(55, Math.max(15, input.temperature));
  const pressure = Math.min(28, Math.max(18, input.pressure));
  const frontBar = Math.min(5, Math.max(1, input.frontBar));
  const surfaceRise = { dry: 5, damp: 3, wet: 1 }[input.surface];
  const hotPressure = Math.round((pressure + surfaceRise + (temperature - 32) * 0.1) * 10) / 10;
  // Deliberately simplified balance signal: one variable's trade-off, not predicted grip.
  const balance = frontBar - 3;
  const handling = balance > 0 ? "More understeer" : balance < 0 ? "More rotation" : "Neutral baseline";
  const feedback = balance > 0
    ? "The front feels less willing to turn; the car tends to push wide at mid-corner."
    : balance < 0
      ? "The car rotates more readily; the rear feels less settled during direction changes."
      : "The car has a neutral starting balance. Entry and exit still need driver feedback.";
  const conditions = input.surface === "wet"
    ? "Standing water can reduce traction sharply. Smooth steering, braking and throttle matter more than chasing a dry setup."
    : input.surface === "damp"
      ? "Changing grip can make the balance inconsistent from corner to corner."
      : temperature >= 40
        ? "A hotter surface can increase tyre heat and pressure; watch for overheating."
        : "Dry running provides a more consistent starting point for comparing one change at a time.";
  const pressureNote = pressure > 22
    ? "Higher cold pressure also raises the example hot reading. More pressure does not automatically mean more grip."
    : pressure < 22
      ? "Lower cold pressure lowers the example hot reading. Too little pressure can increase carcass movement and heat."
      : "Baseline cold pressure retained. The example hot reading varies with surface and temperature.";
  return { hotPressure, balance, handling, feedback, conditions, pressureNote };
}