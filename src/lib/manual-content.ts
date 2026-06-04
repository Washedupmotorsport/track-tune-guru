export type ManualSection = {
  id: string;
  title: string;
  group: string;
  route?: string;
  summary: string;
  whenToUse: string;
  keyActions: string[];
  pitfalls?: string[];
  videoUrl?: string;
};

export const MANUAL_GROUPS = [
  "Getting Started",
  "Race Weekend",
  "Setup & Tyres",
  "Driver",
  "Engineering Log",
  "Garage & Operations",
  "Reference",
] as const;

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    group: "Getting Started",
    summary:
      "My Race Engineer is your trackside co-pilot. Add a car, build a baseline setup, log sessions, and let the cockpit summarise everything.",
    whenToUse: "Read this once before your first event.",
    keyActions: [
      "Garage → add your car (make, model, discipline).",
      "Setup library → create a baseline for the track.",
      "Sessions → start a session, log laps and tyre data.",
      "Cockpit → review verdicts, confidence and what to change next.",
    ],
    pitfalls: ["Skipping the baseline setup makes change-tracking meaningless."],
  },
  {
    id: "cockpit",
    title: "Engineer Cockpit",
    group: "Getting Started",
    route: "/engineer",
    summary:
      "One screen that summarises the current session, latest setup changes, driver verdicts, tyre snapshot, confidence trend and pinned engineering memory.",
    whenToUse: "First thing each morning at the track and after every session.",
    keyActions: [
      "Scan the verdicts column for what worked and what didn't.",
      "Check pinned memory items before touching the setup.",
      "Jump to any panel via the cards.",
    ],
  },
  {
    id: "race-mode",
    title: "Race Mode (Pit Wall)",
    group: "Race Weekend",
    route: "/pitwall",
    summary:
      "Live trackside board: lap stopwatch, last/best/avg, fuel countdown, weather, incidents and pit-stop call.",
    whenToUse: "During the race itself — keep this open on the pit wall device.",
    keyActions: [
      "Tap LAP to capture each lap time.",
      "Log yellows, reds and incidents as they happen.",
      "Watch fuel-to-end vs laps-to-go for the stop call.",
    ],
    pitfalls: ["Don't forget to start the timer when the car crosses the line."],
  },
  {
    id: "pit-lane",
    title: "Pit Lane mode",
    group: "Race Weekend",
    route: "/pitlane",
    summary:
      "Pit-lane-friendly big-button view with stopwatch, last three laps and quick incident buttons.",
    whenToUse: "When you're standing in the pit with a phone, not a laptop.",
    keyActions: ["LAP button captures the current lap.", "Hold-to-stop avoids accidental taps."],
  },
  {
    id: "track-evolution",
    title: "Track Evolution",
    group: "Race Weekend",
    route: "/track-evolution",
    summary: "Grip and temperature trend across the weekend so you know when to chase the track.",
    whenToUse: "Between sessions to decide if pressure / camber changes are needed.",
    keyActions: ["Log track temp and conditions for each run.", "Compare morning vs afternoon."],
  },
  {
    id: "sessions",
    title: "Sessions & Laps",
    group: "Race Weekend",
    route: "/sessions",
    summary: "Every on-track run is a session. Laps, sectors, fuel and tyres hang off it.",
    whenToUse: "Start a new session before each practice / qualifying / race.",
    keyActions: [
      "Create the session with track, weather, temps.",
      "Import laps from CSV or tap them in live.",
      "Attach the setup used so analysis links back.",
    ],
    pitfalls: ["Sessions without a setup attached can't feed setup verdicts."],
  },
  {
    id: "debrief",
    title: "Session debrief",
    group: "Race Weekend",
    route: "/post-debrief",
    summary:
      "Structured post-session write-up: what improved, what got worse, what to try next. Can be AI-summarised.",
    whenToUse: "Within 30 minutes of coming off track.",
    keyActions: [
      "Fill improved / worsened / needs work.",
      "Tag balance issues and confidence concerns.",
      "Generate AI summary to surface patterns.",
    ],
  },
  {
    id: "setup-library",
    title: "Setup library",
    group: "Setup & Tyres",
    route: "/setup-library",
    summary: "All saved setups for the car — baseline, qualifying, wet, etc.",
    whenToUse: "Start of each weekend; clone the best baseline for the conditions.",
    keyActions: ["Mark one setup as the baseline.", "Clone before changing — never overwrite history."],
  },
  {
    id: "baseline",
    title: "Baseline generator",
    group: "Setup & Tyres",
    route: "/baseline",
    summary: "Generates a sensible starting setup from discipline, track type and tyre.",
    whenToUse: "First time at a new track or with a new car.",
    keyActions: ["Pick discipline + track character.", "Save the output to your library."],
  },
  {
    id: "iteration",
    title: "Setup iteration",
    group: "Setup & Tyres",
    route: "/iteration",
    summary:
      "Step-by-step iteration log: propose a change, predict the effect, then record the actual outcome.",
    whenToUse: "Between every run when you're chasing a balance issue.",
    keyActions: [
      "Describe the change in one sentence.",
      "Record expected vs actual driver response.",
      "Outcome status (kept / reverted / mixed) feeds the cockpit.",
    ],
  },
  {
    id: "tyre-setup",
    title: "Tyre pressures",
    group: "Setup & Tyres",
    route: "/tyre-setup",
    summary: "Cold/hot targets and recommended starting pressures.",
    whenToUse: "Before every session out lap.",
    keyActions: ["Log cold pressures.", "Capture hot pressures within 60s of pit-in."],
  },
  {
    id: "tyre-wear",
    title: "Tyre wear",
    group: "Setup & Tyres",
    route: "/tyre-wear",
    summary: "Tread depth and heat-cycle tracking per set.",
    whenToUse: "End of each stint.",
    keyActions: ["Measure tread at four corners.", "Increment heat cycles."],
  },
  {
    id: "tyre-compare",
    title: "Tyre compare",
    group: "Setup & Tyres",
    route: "/tyre-compare",
    summary: "Side-by-side tyre data across sessions or sets.",
    whenToUse: "Choosing between sets for qualifying or the race.",
    keyActions: ["Pick two sets.", "Compare wear, pressures and pace."],
  },
  {
    id: "tires",
    title: "Tyre sets",
    group: "Setup & Tyres",
    route: "/tires",
    summary: "All tyre sets owned, with status and life remaining.",
    whenToUse: "Weekend planning — pick which sets to bring.",
    keyActions: ["Mark sets as race / qualifying / scrub."],
  },
  {
    id: "driver",
    title: "Driver hub",
    group: "Driver",
    route: "/driver",
    summary: "Driver-first workspace: feedback, confidence, behaviours and philosophies.",
    whenToUse: "When the driver is doing the talking.",
    keyActions: [
      "Log driver feedback in their words.",
      "Update confidence sliders after each run.",
      "Capture known behaviours so they're not re-discovered.",
    ],
  },
  {
    id: "confidence",
    title: "Confidence",
    group: "Driver",
    route: "/confidence",
    summary: "Driver confidence per axle / phase, tracked over time.",
    whenToUse: "Immediately after every session.",
    keyActions: ["Rate front, rear, brakes, traction.", "Add a one-line note."],
  },
  {
    id: "debrief-driver",
    title: "Driver feedback",
    group: "Driver",
    route: "/debrief",
    summary: "Free-form driver comments tagged by corner, phase and severity.",
    whenToUse: "During the debrief while the run is fresh.",
    keyActions: ["Tag the corner and phase (entry / mid / exit)."],
  },
  {
    id: "known-behaviours",
    title: "Known behaviours",
    group: "Driver",
    route: "/known-behaviours",
    summary: "Reusable library of how the car behaves under specific conditions.",
    whenToUse: "When a symptom keeps coming back — log it once, reference forever.",
    keyActions: ["Add triggers, workaround and confidence."],
  },
  {
    id: "engineering-memory",
    title: "Engineering memory",
    group: "Engineering Log",
    route: "/engineering-memory",
    summary: "Pinned engineering knowledge — what works, what doesn't, on this car at this track.",
    whenToUse: "Whenever you learn something that future-you must not forget.",
    keyActions: ["Pin high-priority items.", "Increment occurrences when you see it again."],
  },
  {
    id: "notes",
    title: "Engineer notes",
    group: "Engineering Log",
    route: "/notes",
    summary: "Free-form notebook for hypotheses, to-dos and observations.",
    whenToUse: "Anytime — overflow for things that aren't structured data yet.",
    keyActions: ["Tag by category for later filtering."],
  },
  {
    id: "garage",
    title: "Garage",
    group: "Garage & Operations",
    route: "/garage",
    summary: "Cars, calendar and weekend planning.",
    whenToUse: "Off-weekend planning and admin.",
    keyActions: ["Add cars.", "Share cars with crew (viewer or editor)."],
  },
  {
    id: "calendar",
    title: "Calendar",
    group: "Garage & Operations",
    route: "/calendar",
    summary: "Upcoming events and test days.",
    whenToUse: "Season planning.",
    keyActions: ["Add event with track and dates."],
  },
  {
    id: "weekends",
    title: "Race weekends",
    group: "Garage & Operations",
    route: "/weekends",
    summary: "Per-event hub — sessions, expenses, damage all rolled up.",
    whenToUse: "During and after each event.",
    keyActions: ["Open the event to see everything in one place."],
  },
  {
    id: "maintenance",
    title: "Maintenance",
    group: "Garage & Operations",
    route: "/maintenance",
    summary: "Service intervals by hours, km or laps with warning thresholds.",
    whenToUse: "Before every event and after every session.",
    keyActions: ["Bump current value after each session.", "Mark serviced when done."],
  },
  {
    id: "damage",
    title: "Damage log",
    group: "Garage & Operations",
    route: "/damage",
    summary: "Component damage with severity and repair cost.",
    whenToUse: "Anytime something breaks.",
    keyActions: ["Log component, severity, cost and parts used."],
  },
  {
    id: "inventory",
    title: "Parts inventory",
    group: "Garage & Operations",
    route: "/inventory",
    summary: "Spares on hand with min-stock warnings.",
    whenToUse: "Pre-event packing list.",
    keyActions: ["Set min quantity to get low-stock warnings."],
  },
  {
    id: "expenses",
    title: "Expenses",
    group: "Garage & Operations",
    route: "/expenses",
    summary: "Per-event spend by category and currency.",
    whenToUse: "Whenever money leaves your wallet.",
    keyActions: ["Tag to a car and/or event for accurate rollups."],
  },
  {
    id: "calculators",
    title: "Calculators",
    group: "Reference",
    route: "/calculators",
    summary: "Pressure, fuel, gear and other quick maths.",
    whenToUse: "Anytime you need a number, fast.",
    keyActions: ["Pick a calculator from the tabs."],
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcuts",
    group: "Reference",
    summary: "Power-user shortcuts.",
    whenToUse: "Once you know the app.",
    keyActions: [
      "⌘K / Ctrl+K — Command palette.",
      "Click the units toggle to flip metric/imperial.",
    ],
  },
];

export function findSectionForRoute(pathname: string): ManualSection | undefined {
  // exact match first, then prefix
  const exact = MANUAL_SECTIONS.find((s) => s.route === pathname);
  if (exact) return exact;
  const sorted = [...MANUAL_SECTIONS]
    .filter((s) => s.route)
    .sort((a, b) => (b.route!.length - a.route!.length));
  return sorted.find((s) => pathname.startsWith(s.route!));
}