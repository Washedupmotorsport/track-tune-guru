export type TourStep = {
  // CSS selector to spotlight; omit for centered modal-style step.
  selector?: string;
  title: string;
  body: string;
};

export type Tour = {
  key: string;
  label: string;
  route: string;
  steps: TourStep[];
};

export const TOURS: Tour[] = [
  {
    key: "cockpit",
    label: "Engineer Cockpit",
    route: "/engineer",
    steps: [
      {
        title: "Welcome to the Cockpit",
        body: "This is your one-screen summary of the current session — verdicts, tyres, confidence and memory all in one place.",
      },
      {
        title: "Setup verdicts",
        body: "Recent setup changes appear here with their outcome — kept, reverted, or mixed. Use this to decide what to try next.",
      },
      {
        title: "Engineering memory",
        body: "Pinned memory items show first. Add anything future-you must not forget.",
      },
      {
        title: "Quick jumps",
        body: "Each card links to its full workspace. Tap to drill in.",
      },
    ],
  },
  {
    key: "race-mode",
    label: "Race Mode",
    route: "/pitwall",
    steps: [
      { title: "Pit Wall live board", body: "Lap times, fuel, weather and incidents in one trackside view." },
      { title: "Capture laps", body: "Tap the LAP button each time the car crosses the line." },
      { title: "Log incidents", body: "Yellows, reds, contact — log them as they happen for the debrief." },
    ],
  },
  {
    key: "sessions",
    label: "Sessions",
    route: "/sessions",
    steps: [
      { title: "Every run is a session", body: "Practice, qualifying, race — each has its own laps, tyres and setup." },
      { title: "Attach a setup", body: "Sessions tied to a setup feed change-tracking and the cockpit verdicts." },
      { title: "Debrief immediately", body: "Open the session and run the debrief while the run is fresh." },
    ],
  },
  {
    key: "setup",
    label: "Setup",
    route: "/setup-library",
    steps: [
      { title: "Library of setups", body: "One per condition: dry baseline, wet, qualifying, race." },
      { title: "Mark a baseline", body: "The baseline is what every change is measured against." },
      { title: "Iterate, don't overwrite", body: "Clone before changing — keep history intact." },
    ],
  },
  {
    key: "tyres",
    label: "Tyres",
    route: "/tyre-setup",
    steps: [
      { title: "Pressures matter most", body: "Log cold targets and capture hot pressures within a minute of pit-in." },
      { title: "Track wear", body: "Tread + heat-cycles per set tells you what's race-fit." },
    ],
  },
  {
    key: "driver",
    label: "Driver Hub",
    route: "/driver",
    steps: [
      { title: "Driver-first workspace", body: "Feedback, confidence, behaviours and philosophies all live here." },
      { title: "Confidence trend", body: "Per-axle confidence after each run tells you if changes helped the driver." },
      { title: "Known behaviours", body: "Log a symptom once with its workaround — never re-discover it." },
    ],
  },
  {
    key: "garage",
    label: "Garage",
    route: "/garage",
    steps: [
      { title: "Garage", body: "Cars, calendar, weekends and operations (maintenance, damage, inventory, expenses)." },
      { title: "Share with crew", body: "Invite a crew member as viewer or editor on a car." },
    ],
  },
];

export function getTour(key: string): Tour | undefined {
  return TOURS.find((t) => t.key === key);
}