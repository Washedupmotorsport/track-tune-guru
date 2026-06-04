import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Gauge, MessageSquare, AlertTriangle, ClipboardList, NotebookPen,
  Radio, Flag, Disc, Mic, ArrowRight, Zap, CalendarDays, History, Activity,
} from "lucide-react";
import { useEffect, useState } from "react";
import { GuidedTour } from "@/components/guided-tour";

export const Route = createFileRoute("/_authenticated/driver")({
  head: () => ({
    meta: [
      { title: "Driver — My Race Engineer" },
      { name: "description", content: "Driver workspace: in-car feedback, confidence scoring, debrief notes, and handling complaints." },
    ],
  }),
  component: DriverHub,
});

type Confidence = { overall: number | null; recorded_at: string };
type Feedback = { id: string; description: string; severity: string; category: string; recorded_at: string };

function DriverHub() {
  const { user } = useAuth();

  // Per-user weekend-loop lens. Persisted locally so the driver lands on the
  // moment of the weekend they actually care about: next session ahead, the
  // last debrief to close the loop, or the live session if running.
  const LENS_KEY = "mre.driver.weekendLens";
  const [lens, setLens] = useState<"next" | "last" | "live">(() => {
    if (typeof window === "undefined") return "last";
    const v = window.localStorage.getItem(LENS_KEY);
    return v === "next" || v === "last" || v === "live" ? v : "last";
  });
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(LENS_KEY, lens);
  }, [lens]);

  const confQ = useQuery({
    queryKey: ["driver-hub-confidence", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_confidence")
        .select("overall, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as Confidence[];
    },
  });

  const feedbackQ = useQuery({
    queryKey: ["driver-hub-feedback", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_feedback")
        .select("id, description, severity, category, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as Feedback[];
    },
  });

  const lastConfidence = confQ.data?.[0]?.overall ?? null;

  return (
    <div>
      <GuidedTour tourKey="driver" />
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary inline-flex items-center gap-1">
            <Mic className="w-3 h-3" /> Driver workspace
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Driver</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Talk to the pit wall. Score how the car feels, flag handling issues, drop a debrief while it's fresh.
          </p>
        </div>
        <Link
          to="/engineer"
          className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary border border-border rounded-md px-2.5 py-1.5"
        >
          Switch to engineer →
        </Link>
      </div>

      {/* Weekend-loop lens: which moment of the race weekend do you want to land on? */}
      <div className="mt-5 rounded-lg border border-border bg-card p-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mr-1">Default view</span>
        {([
          { id: "next", label: "Next session",  icon: CalendarDays, blurb: "Setup, weather, last notes — get ready to run." },
          { id: "last", label: "Last debrief",  icon: History,      blurb: "Close the loop before the next run." },
          { id: "live", label: "Live session",  icon: Activity,     blurb: "Active session view if a run is happening." },
        ] as const).map((opt) => {
          const Icon = opt.icon;
          const active = lens === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setLens(opt.id)}
              title={opt.blurb}
              className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[10px] font-mono uppercase tracking-widest border transition-colors ${
                active
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "text-muted-foreground border-border hover:text-primary hover:border-primary/40"
              }`}
            >
              <Icon className="w-3 h-3" /> {opt.label}
            </button>
          );
        })}
        <span className="ml-auto text-[10px] text-muted-foreground hidden sm:inline">
          {lens === "next" && "Showing the run ahead."}
          {lens === "last" && "Showing the last debrief — fix it before going out again."}
          {lens === "live" && "Showing the live session if one is running, otherwise the run ahead."}
        </span>
      </div>

      {/* Lens-specific panel — points the driver at the right page for this moment of the weekend. */}
      <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
        {lens === "next" && (
          <LensPanel
            title="Next session"
            blurb="Load the planned setup, check weather and tyres, review the last notes before you go out."
            primary={{ to: "/weekends", label: "Open weekends" }}
            secondary={[
              { to: "/setup-library", label: "Setup library" },
              { to: "/tyre-setup",    label: "Tyre pressures" },
              { to: "/notes",         label: "Engineering notes" },
            ]}
          />
        )}
        {lens === "last" && (
          <LensPanel
            title="Last debrief"
            blurb="What improved, what got worse, what still needs work. Close the loop before the next run."
            primary={{ to: "/post-debrief", label: "Open post-session debrief" }}
            secondary={[
              { to: "/confidence", label: "Score confidence" },
              { to: "/sympathy",   label: "Log driver feedback" },
              { to: "/iteration",  label: "Suggest setup change" },
            ]}
          />
        )}
        {lens === "live" && (
          <LensPanel
            title="Live session"
            blurb="Pit wall channel and pit-lane mode if a run is happening. Otherwise the next session ahead."
            primary={{ to: "/pitwall", label: "Open pit wall" }}
            secondary={[
              { to: "/pitlane",  label: "Pit lane mode" },
              { to: "/racemode", label: "Race mode" },
              { to: "/flags",    label: "Flag an issue" },
            ]}
          />
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Last confidence" value={lastConfidence != null ? `${lastConfidence}/10` : "—"} hint="Most recent score" />
        <Stat label="Recent feedback" value={String(feedbackQ.data?.length ?? 0)} hint="Last 5 entries" />
        <Stat label="Open handling issues" value={String((feedbackQ.data ?? []).filter((f) => f.severity === "warning" || f.severity === "critical").length)} />
        <Stat label="Confidence trend" value={trendArrow(confQ.data ?? [])} hint="vs prior session" />
      </div>

      <h2 className="font-display text-lg font-bold uppercase tracking-wider mt-8 mb-3">Between sessions</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <ActionCard to="/confidence" icon={Gauge} title="Confidence scoring" desc="Rate front, rear, brakes, traction. Track how the car feels session over session." />
        <ActionCard to="/debrief" icon={ClipboardList} title="Debrief" desc="Drop a structured debrief while the lap is fresh. Audio + notes." />
        <ActionCard to="/sympathy" icon={MessageSquare} title="Driver feedback" desc="Tag complaints by corner, phase, and severity. Engineers see them instantly." />
        <ActionCard to="/flags" icon={AlertTriangle} title="Handling issues" desc="Log incidents, near-misses, snap oversteer, brake locks." />
        <ActionCard to="/notes" icon={NotebookPen} title="Notes" desc="Personal notebook — lines, references, what worked." />
        <ActionCard to="/pitwall" icon={Radio} title="Pit wall" desc="Live channel to the engineer between runs." />
      </div>

      <h2 className="font-display text-lg font-bold uppercase tracking-wider mt-8 mb-3">Recent feedback</h2>
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {feedbackQ.isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
        {!feedbackQ.isLoading && (feedbackQ.data ?? []).length === 0 && (
          <div className="p-6 text-center">
            <Zap className="w-6 h-6 mx-auto text-muted-foreground/60" />
            <div className="text-sm text-muted-foreground mt-2">No feedback yet — log the first one after the next run.</div>
            <Link to="/sympathy" className="inline-flex items-center text-xs text-primary mt-2 hover:underline">
              Log feedback <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </div>
        )}
        {(feedbackQ.data ?? []).map((f) => (
          <div key={f.id} className="px-4 py-3 flex items-start gap-3">
            <span className={`mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded border text-[10px] font-mono uppercase tracking-widest ${severityTone(f.severity)}`}>
              {f.severity.slice(0, 3)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm">{f.description}</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
                {f.category} · {new Date(f.recorded_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-dashed border-border bg-card/40 p-4 text-sm text-muted-foreground flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Disc className="w-4 h-4" /> Tyres feel off?
        </div>
        <Link to="/tyre-wear" className="text-xs text-primary hover:underline inline-flex items-center">
          Send a tyre note to the engineer <ArrowRight className="w-3 h-3 ml-1" />
        </Link>
      </div>
    </div>
  );
}

function LensPanel({
  title, blurb, primary, secondary,
}: {
  title: string;
  blurb: string;
  primary: { to: string; label: string };
  secondary: { to: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="font-display font-bold uppercase tracking-wider text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{blurb}</div>
      </div>
      <Link
        to={primary.to}
        className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary text-primary-foreground px-3 h-8 text-[11px] font-mono uppercase tracking-widest hover:opacity-90"
      >
        {primary.label} <ArrowRight className="w-3 h-3" />
      </Link>
      <div className="basis-full flex flex-wrap gap-1.5">
        {secondary.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="inline-flex items-center px-2 h-6 rounded border border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary/40"
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function trendArrow(rows: Confidence[]) {
  if (rows.length < 2) return "—";
  const a = rows[0]?.overall;
  const b = rows[1]?.overall;
  if (a == null || b == null) return "—";
  if (a > b) return `▲ +${a - b}`;
  if (a < b) return `▼ ${a - b}`;
  return "→ 0";
}

function severityTone(s: string) {
  if (s === "critical") return "border-destructive/50 bg-destructive/15 text-destructive";
  if (s === "warning") return "border-accent/50 bg-accent/15 text-accent";
  return "border-border bg-muted/30 text-muted-foreground";
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-card">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold mt-0.5">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function ActionCard({
  to, icon: Icon, title, desc,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-lg border border-border bg-card p-4 shadow-card hover:border-primary/50 hover:bg-card/80 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border bg-muted/30 text-primary">
          <Icon className="w-4 h-4" />
        </span>
        <div className="font-display font-bold uppercase tracking-wider text-sm">{title}</div>
        <ArrowRight className="w-3.5 h-3.5 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{desc}</p>
    </Link>
  );
}
