import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  BookOpen, Wind, ShieldCheck, CloudRain, Zap, Mountain,
  Activity, Disc, Gauge, Sparkles, ThumbsUp, ThumbsDown, ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/philosophies")({
  component: PhilosophiesPage,
  head: () => ({
    meta: [
      { title: "Setup Philosophies — My Race Engineer" },
      { name: "description", content: "Engineering setup philosophies for different driving styles and race conditions — aggressive rotation, stable endurance, wet compliance, high-speed stability, kerb-friendly." },
    ],
  }),
});

type Trait = { label: string; level: 1 | 2 | 3 | 4 | 5 };
type Philosophy = {
  id: string;
  name: string;
  tagline: string;
  icon: typeof Wind;
  accent: string;
  ideal: string[];
  avoid: string[];
  handling: string[];
  tyre: string[];
  driverFeel: string[];
  setup: { area: string; direction: string }[];
  traits: Trait[];
};

const PHILOSOPHIES: Philosophy[] = [
  {
    id: "aggressive-rotation",
    name: "Aggressive Rotation",
    tagline: "Pointy front, loose rear — turns on a dime, rewards commitment.",
    icon: Zap,
    accent: "text-accent",
    ideal: ["Tight, technical tracks", "Qualifying laps", "Confident, smooth drivers", "Rubbered-in surface"],
    avoid: ["Long stints", "Wet or greasy surface", "High-speed circuits", "Nervous drivers"],
    handling: [
      "Instant turn-in response, almost telepathic",
      "Rotates on trail brake — needs throttle to settle the rear",
      "Excellent mid-corner direction change",
      "Snap-oversteer risk if you lift mid-corner",
    ],
    tyre: [
      "Front tyres do less work — last longer",
      "Rear inside tyre overheats first — watch hot psi RR",
      "High wear rate over long stints",
    ],
    driverFeel: [
      "Car feels alive and reactive",
      "Demands precise throttle and steering inputs",
      "Punishing of mistakes — high reward, low margin",
    ],
    setup: [
      { area: "Front ARB",       direction: "Soft — promote front grip and rotation" },
      { area: "Rear ARB",        direction: "Stiff — reduce rear grip, encourage yaw" },
      { area: "Rear wing",       direction: "Low — less rear downforce" },
      { area: "Brake bias",      direction: "Rearward 1–2% from baseline" },
      { area: "Diff preload",    direction: "Low — let inside wheel spin freely" },
      { area: "Rear toe",        direction: "Near zero — minimise rear stability" },
      { area: "Front camber",    direction: "More negative — bite on turn-in" },
    ],
    traits: [
      { label: "Front bite",       level: 5 },
      { label: "Rear stability",   level: 2 },
      { label: "Tyre kindness",    level: 2 },
      { label: "Wet capability",   level: 1 },
      { label: "Driver confidence",level: 2 },
      { label: "Outright pace",    level: 5 },
    ],
  },
  {
    id: "stable-endurance",
    name: "Stable Endurance",
    tagline: "Forgiving balance, easy on tyres — fast at hour three, not lap three.",
    icon: ShieldCheck,
    accent: "text-primary",
    ideal: ["Multi-stint endurance", "Driver swaps with mixed skill", "High track temps", "Fuel-heavy runs"],
    avoid: ["Single-lap qualifying", "Cold conditions where you need bite"],
    handling: [
      "Predictable, neutral balance across full fuel load",
      "Mild understeer as the safety net",
      "Stable under braking even at peak load",
      "Behaviour consistent from new tyres to end-of-stint",
    ],
    tyre: [
      "Even wear front-to-rear and left-to-right",
      "Pressures stay in working window across long stints",
      "Lower peak temperatures — degrades gracefully",
    ],
    driverFeel: [
      "Confidence-inspiring — easy to hand over to another driver",
      "No surprises in traffic or under pressure",
      "Trades 0.3–0.5s/lap qualifying pace for race-stint consistency",
    ],
    setup: [
      { area: "Front ARB",       direction: "Stiff/medium — biased toward understeer" },
      { area: "Rear ARB",        direction: "Soft — maximum rear grip" },
      { area: "Rear wing",       direction: "High — downforce for tyre protection" },
      { area: "Brake bias",      direction: "Forward 1% — pure stability" },
      { area: "Diff preload",    direction: "Medium — predictable on-throttle" },
      { area: "Pressures",       direction: "Cold +0.5 psi — survive long runs" },
      { area: "Ride height",     direction: "Higher — protect floor over kerbs/bumps" },
    ],
    traits: [
      { label: "Front bite",       level: 2 },
      { label: "Rear stability",   level: 5 },
      { label: "Tyre kindness",    level: 5 },
      { label: "Wet capability",   level: 3 },
      { label: "Driver confidence",level: 5 },
      { label: "Outright pace",    level: 3 },
    ],
  },
  {
    id: "wet-compliance",
    name: "Wet Weather Compliance",
    tagline: "Soft, planted, ride-the-water — mechanical grip when aero is dead.",
    icon: CloudRain,
    accent: "text-chart-2",
    ideal: ["Standing water", "Heavy rain", "Wet-to-damp transitions"],
    avoid: ["Drying line", "Mixed dry/damp where you want bite back"],
    handling: [
      "Soft ride absorbs water and bumps — tyres stay in contact",
      "Slow, progressive response — no snap reactions",
      "Brake stability maximised — no front lock-up",
      "Will feel sluggish if track dries",
    ],
    tyre: [
      "Lower pressures — tread blocks bite into water film",
      "Wet compound essential — slick is undriveable",
      "Heat generation low — risk of going cold off-throttle",
    ],
    driverFeel: [
      "Inputs slowed and softened — car rewards patience",
      "Easy to recover from a slide",
      "Confidence comes from compliance, not response",
    ],
    setup: [
      { area: "Spring rates",    direction: "Soft front and rear — maximum compliance" },
      { area: "ARBs",            direction: "Soft both ends — independent wheel work" },
      { area: "Ride height",     direction: "+3–5 mm — clear standing water under floor" },
      { area: "Rear wing",       direction: "Maximum — mechanical + aero stability" },
      { area: "Pressures",       direction: "−1.5 to −2.0 psi cold all round" },
      { area: "Brake bias",      direction: "Rearward 2% — prevent front lock-up" },
      { area: "Diff preload",    direction: "Low — gentle on-throttle delivery" },
    ],
    traits: [
      { label: "Front bite",       level: 2 },
      { label: "Rear stability",   level: 5 },
      { label: "Tyre kindness",    level: 4 },
      { label: "Wet capability",   level: 5 },
      { label: "Driver confidence",level: 4 },
      { label: "Outright pace",    level: 2 },
    ],
  },
  {
    id: "high-speed-stability",
    name: "High-Speed Stability",
    tagline: "Locked-in platform — confidence to commit at 250 km/h.",
    icon: Wind,
    accent: "text-primary",
    ideal: ["Fast flowing circuits (Spa, Silverstone, Suzuka)", "Long flat-out sections", "Banked corners"],
    avoid: ["Tight street tracks", "Stop-and-go layouts"],
    handling: [
      "Rock-solid in fast direction changes",
      "Aero platform stays consistent through compressions",
      "Slight understeer mid-corner is by design — trust it",
      "Will feel heavy and lazy in slow corners",
    ],
    tyre: [
      "Fronts work hard in sustained high-speed loadings",
      "Higher pressures protect carcass at top speed",
      "Camber tuned for full-load contact patch, not low-speed bite",
    ],
    driverFeel: [
      "Total commitment in high-speed corners — car never moves",
      "Demands confidence to lift later and brake later",
      "Slow-corner pace is the price you pay",
    ],
    setup: [
      { area: "Spring rates",    direction: "Stiff — control aero platform" },
      { area: "Front ARB",       direction: "Stiff — minimise roll at speed" },
      { area: "Rear wing",       direction: "Medium-high — balance with front aero" },
      { area: "Ride height",     direction: "Low — maximise underfloor efficiency" },
      { area: "Pressures",       direction: "Cold +0.5–1.0 psi above baseline" },
      { area: "Camber",          direction: "Less negative — full contact at high load" },
      { area: "Brake bias",      direction: "Neutral / slight forward" },
    ],
    traits: [
      { label: "Front bite",       level: 3 },
      { label: "Rear stability",   level: 5 },
      { label: "Tyre kindness",    level: 4 },
      { label: "Wet capability",   level: 2 },
      { label: "Driver confidence",level: 5 },
      { label: "Outright pace",    level: 4 },
    ],
  },
  {
    id: "kerb-friendly",
    name: "Kerb Friendly",
    tagline: "Compliant platform — attack apex kerbs and exit sausages without upsetting the car.",
    icon: Mountain,
    accent: "text-accent",
    ideal: ["Tracks with aggressive kerbs (Monza, COTA, Hungaroring)", "Chicanes", "Inside-line apex kerbs"],
    avoid: ["Pure aero high-speed tracks where you need a stiff platform"],
    handling: [
      "Soaks up kerb strikes without throwing balance off",
      "Stays settled when riding kerbs on entry and exit",
      "Slightly less responsive than a stiff platform",
      "Survives the lap even if you over-commit to a kerb",
    ],
    tyre: [
      "Lower kerb-load shock to the tyre carcass",
      "Reduced spike heating from impacts",
      "Less risk of puncture from sharp kerb edges",
    ],
    driverFeel: [
      "Frees the driver to use the whole track including kerbs",
      "Forgiving when a wheel drops off the inside",
      "Loses a touch of precision in pure asphalt corners",
    ],
    setup: [
      { area: "Spring rates",    direction: "Softer than baseline both ends" },
      { area: "Bump damping",    direction: "Open — let kerbs compress, not deflect" },
      { area: "Rebound damping", direction: "Slightly soft — control extension on kerb release" },
      { area: "Ride height",     direction: "+2–3 mm — clearance over kerb crests" },
      { area: "ARBs",            direction: "Soft — allow independent wheel articulation" },
      { area: "Bumpstops",       direction: "Longer / progressive — soak final travel" },
    ],
    traits: [
      { label: "Front bite",       level: 3 },
      { label: "Rear stability",   level: 4 },
      { label: "Tyre kindness",    level: 4 },
      { label: "Wet capability",   level: 3 },
      { label: "Driver confidence",level: 5 },
      { label: "Outright pace",    level: 3 },
    ],
  },
];

function PhilosophiesPage() {
  const [selectedId, setSelectedId] = useState<string>(PHILOSOPHIES[0].id);
  const selected = PHILOSOPHIES.find((p) => p.id === selectedId) ?? PHILOSOPHIES[0];
  const Icon = selected.icon;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> Engineering reference
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Setup Philosophies</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Five engineering setup directions, each tuned for a driving style or condition.
            Pick one to understand what it gives you, what it costs, and why it behaves the way it does.
          </p>
        </div>
        <Link
          to="/baseline"
          className="inline-flex items-center text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary"
        >
          Build from baseline <ChevronRight className="w-3 h-3 ml-0.5" />
        </Link>
      </div>

      {/* ============== SELECTOR ============== */}
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {PHILOSOPHIES.map((p) => {
          const PIcon = p.icon;
          const active = p.id === selectedId;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`text-left rounded-md border p-3 transition-colors ${
                active
                  ? "border-primary/60 bg-primary/5 shadow-card"
                  : "border-border bg-card/50 hover:border-primary/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <PIcon className={`w-4 h-4 ${p.accent}`} />
                <div className={`font-display font-bold text-sm ${active ? p.accent : ""}`}>
                  {p.name}
                </div>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{p.tagline}</p>
            </button>
          );
        })}
      </div>

      {/* ============== DETAIL ============== */}
      <div className={`mt-4 rounded-lg border border-primary/30 bg-card p-5 shadow-card`}>
        <div className="flex items-start gap-3">
          <Icon className={`w-8 h-8 ${selected.accent}`} />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Philosophy</div>
            <h2 className={`font-display text-3xl font-bold ${selected.accent}`}>{selected.name}</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{selected.tagline}</p>
          </div>
        </div>

        {/* TRAITS */}
        <div className="mt-5">
          <SectionTitle icon={Sparkles}>Trait profile</SectionTitle>
          <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {selected.traits.map((t) => (
              <TraitBar key={t.label} trait={t} />
            ))}
          </div>
        </div>

        <div className="mt-5 grid lg:grid-cols-2 gap-4">
          <Panel icon={ThumbsUp} title="Ideal conditions" tone="text-primary" items={selected.ideal} />
          <Panel icon={ThumbsDown} title="Avoid in" tone="text-destructive" items={selected.avoid} />
        </div>

        <div className="mt-4 grid lg:grid-cols-3 gap-4">
          <Panel icon={Activity} title="Expected handling" items={selected.handling} />
          <Panel icon={Disc} title="Tyre impact" items={selected.tyre} />
          <Panel icon={Gauge} title="Driver confidence" items={selected.driverFeel} />
        </div>

        {/* SETUP DIRECTION */}
        <div className="mt-5">
          <SectionTitle icon={Sparkles}>Setup direction</SectionTitle>
          <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {selected.setup.map((s, i) => (
              <div key={i} className="rounded-md border border-border bg-background/40 p-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{s.area}</div>
                <div className="font-display text-sm font-bold mt-0.5">{s.direction}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          These are directional — combine with your baseline and adjust based on driver feedback,
          tyre logs and track evolution. A philosophy is a starting point, not a final answer.
        </p>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Sparkles; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-primary" />
      <h3 className="font-display text-sm font-bold uppercase tracking-wider">{children}</h3>
    </div>
  );
}

function Panel({
  icon: Icon, title, items, tone,
}: { icon: typeof Sparkles; title: string; items: string[]; tone?: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${tone ?? "text-primary"}`} />
        <div className="font-display text-sm font-bold uppercase tracking-wider">{title}</div>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {items.map((s, i) => (
          <li key={i} className="text-muted-foreground">
            <span className="text-primary mr-2">›</span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TraitBar({ trait }: { trait: Trait }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{trait.label}</div>
        <div className="font-mono text-xs text-primary">{trait.level}/5</div>
      </div>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-sm ${
              i <= trait.level ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}