import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatLapTime } from "@/lib/lap-time";
import {
  Flag, Timer, Wrench, Disc, CloudRain, Gauge, NotebookPen, TrendingDown, TrendingUp,
  Activity, ChevronRight, Thermometer, MapPin, ClipboardList, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/timeline")({
  component: TimelinePage,
  head: () => ({
    meta: [
      { title: "Race Weekend Timeline — My Race Engineer" },
      { name: "description", content: "Engineering notebook timeline for a race weekend: practice → qualifying → sprint → endurance, with setup revisions, tyre changes, weather shifts, confidence and lap improvements." },
    ],
  }),
});

// ---------------- Types ----------------

type Evt = {
  id: string; title: string; track: string | null; starts_at: string;
  ends_at: string | null; location: string | null; car_id: string | null;
  status: string;
};
type Sess = {
  id: string; name: string; session_type: string; started_at: string;
  driver: string | null; weather: string | null;
  air_temp_c: number | null; track_temp_c: number | null;
  fuel_start_l: number | null; fuel_end_l: number | null;
  setup_id: string | null; event_id: string | null;
};
type Lap = {
  id: string; session_id: string | null; lap_number: number | null;
  lap_time_ms: number; recorded_at: string; setup_id: string | null;
};
type Tire = {
  id: string; session_id: string | null; recorded_at: string;
  tire_set: string; compound: string | null;
  hot_fl: number | null; hot_fr: number | null; hot_rl: number | null; hot_rr: number | null;
};
type Conf = {
  id: string; session_id: string | null; recorded_at: string;
  overall: number; front: number | null; rear: number | null;
  brakes: number | null; traction: number | null; notes: string | null;
};
type Fb = {
  id: string; session_id: string | null; recorded_at: string;
  category: string; severity: string; description: string; balance: string | null;
};
type Setup = { id: string; name: string; created_at: string; updated_at: string };

// ---------------- Stage classification ----------------

type Stage = "Friday Practice" | "Saturday Qualifying" | "Sprint Race" | "Endurance Race" | "Other";
const STAGE_ORDER: Stage[] = ["Friday Practice", "Saturday Qualifying", "Sprint Race", "Endurance Race", "Other"];
const STAGE_META: Record<Stage, { tone: string; icon: typeof Flag; tag: string }> = {
  "Friday Practice":     { tone: "border-chart-2/40 bg-chart-2/5 text-chart-2",     icon: Activity, tag: "FP" },
  "Saturday Qualifying": { tone: "border-chart-3/40 bg-chart-3/5 text-chart-3",     icon: Timer,    tag: "Q" },
  "Sprint Race":         { tone: "border-primary/40 bg-primary/5 text-primary",     icon: Flag,     tag: "SR" },
  "Endurance Race":      { tone: "border-accent/40 bg-accent/5 text-accent",        icon: Flag,     tag: "ENDU" },
  "Other":               { tone: "border-border bg-muted/20 text-muted-foreground", icon: NotebookPen, tag: "—" },
};

function classify(s: Sess, eventStart: number): Stage {
  const t = s.session_type?.toLowerCase() ?? "";
  const name = (s.name ?? "").toLowerCase();
  const dayDelta = Math.floor((new Date(s.started_at).getTime() - eventStart) / 86400000);
  if (t.includes("qual") || name.includes("qual")) return "Saturday Qualifying";
  if (name.includes("sprint")) return "Sprint Race";
  if (name.includes("endur") || name.includes("enduro") || name.includes("24h") || name.includes("12h")) return "Endurance Race";
  if (t === "race") {
    // Heuristic: longer total lap time-spans treated as endurance later when we have laps;
    // default a single race to Sprint Race.
    return "Sprint Race";
  }
  if (t === "practice" || t === "testing" || dayDelta <= 0) return "Friday Practice";
  return "Other";
}

// ---------------- Page ----------------

function TimelinePage() {
  const { user } = useAuth();
  const [eventId, setEventId] = useState<string>("");

  const eventsQ = useQuery({
    queryKey: ["timeline-events", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("calendar_events")
        .select("id, title, track, starts_at, ends_at, location, car_id, status")
        .in("event_type", ["race", "test"])
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data as Evt[];
    },
    enabled: !!user,
  });

  const events = eventsQ.data ?? [];
  const activeId = eventId || events[0]?.id || "";
  const activeEvent = events.find((e) => e.id === activeId) ?? null;

  const sessQ = useQuery({
    queryKey: ["timeline-sessions", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions")
        .select("id, name, session_type, started_at, driver, weather, air_temp_c, track_temp_c, fuel_start_l, fuel_end_l, setup_id, event_id")
        .eq("event_id", activeId)
        .order("started_at", { ascending: true });
      if (error) throw error;
      return data as Sess[];
    },
  });
  const sessions = sessQ.data ?? [];
  const sessionIds = sessions.map((s) => s.id);

  const lapsQ = useQuery({
    queryKey: ["timeline-laps", activeId, sessionIds.join(",")],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("laps")
        .select("id, session_id, lap_number, lap_time_ms, recorded_at, setup_id")
        .in("session_id", sessionIds)
        .order("recorded_at");
      if (error) throw error;
      return data as Lap[];
    },
  });
  const tiresQ = useQuery({
    queryKey: ["timeline-tires", activeId, sessionIds.join(",")],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("tire_logs")
        .select("id, session_id, recorded_at, tire_set, compound, hot_fl, hot_fr, hot_rl, hot_rr")
        .in("session_id", sessionIds)
        .order("recorded_at");
      if (error) throw error;
      return data as Tire[];
    },
  });
  const confQ = useQuery({
    queryKey: ["timeline-conf", activeId, sessionIds.join(",")],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_confidence")
        .select("id, session_id, recorded_at, overall, front, rear, brakes, traction, notes")
        .in("session_id", sessionIds)
        .order("recorded_at");
      if (error) throw error;
      return data as Conf[];
    },
  });
  const fbQ = useQuery({
    queryKey: ["timeline-fb", activeId, sessionIds.join(",")],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_feedback")
        .select("id, session_id, recorded_at, category, severity, description, balance")
        .in("session_id", sessionIds)
        .order("recorded_at");
      if (error) throw error;
      return data as Fb[];
    },
  });

  const setupIds = useMemo(() => {
    const ids = new Set<string>();
    sessions.forEach((s) => s.setup_id && ids.add(s.setup_id));
    (lapsQ.data ?? []).forEach((l) => l.setup_id && ids.add(l.setup_id));
    return Array.from(ids);
  }, [sessions, lapsQ.data]);

  const setupsQ = useQuery({
    queryKey: ["timeline-setups", setupIds.join(",")],
    enabled: setupIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("setups")
        .select("id, name, created_at, updated_at")
        .in("id", setupIds);
      if (error) throw error;
      return data as Setup[];
    },
  });
  const setupMap = new Map((setupsQ.data ?? []).map((s) => [s.id, s]));

  const eventStart = activeEvent ? new Date(activeEvent.starts_at).getTime() : 0;

  // Bucket sessions by stage
  const grouped = useMemo(() => {
    const g = new Map<Stage, Sess[]>();
    STAGE_ORDER.forEach((s) => g.set(s, []));
    sessions.forEach((s) => {
      const st = classify(s, eventStart);
      g.get(st)!.push(s);
    });
    return g;
  }, [sessions, eventStart]);

  // Best lap by session
  const bestBySession = useMemo(() => {
    const m = new Map<string, number>();
    (lapsQ.data ?? []).forEach((l) => {
      if (!l.session_id) return;
      const cur = m.get(l.session_id);
      if (cur == null || l.lap_time_ms < cur) m.set(l.session_id, l.lap_time_ms);
    });
    return m;
  }, [lapsQ.data]);

  // Lap improvement vs previous session
  const orderedSessions = sessions;
  const sessionBests = orderedSessions.map((s) => bestBySession.get(s.id));
  const overallBest = sessionBests.filter((v): v is number => v != null).reduce((a, b) => Math.min(a, b), Infinity);

  // Compute weather shift markers
  const weatherShifts = useMemo(() => {
    const shifts: { from: string; to: string; at: string }[] = [];
    let prev: string | null = null;
    orderedSessions.forEach((s) => {
      const w = s.weather ?? null;
      if (w && prev && w !== prev) shifts.push({ from: prev, to: w, at: s.started_at });
      if (w) prev = w;
    });
    return shifts;
  }, [orderedSessions]);

  // Tyre changes: unique tire_set per session (transitions)
  const tyreChanges = useMemo(() => {
    const out: { session_id: string; set: string; compound: string | null; at: string }[] = [];
    const seen = new Set<string>();
    (tiresQ.data ?? []).forEach((t) => {
      if (!t.session_id) return;
      const key = `${t.session_id}:${t.tire_set}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ session_id: t.session_id, set: t.tire_set, compound: t.compound, at: t.recorded_at });
    });
    return out;
  }, [tiresQ.data]);

  // Setup revisions: ordered by first appearance across sessions
  const setupRevisions = useMemo(() => {
    const seen = new Set<string>();
    const revs: { setup_id: string; first_at: string; session_id: string }[] = [];
    orderedSessions.forEach((s) => {
      if (s.setup_id && !seen.has(s.setup_id)) {
        seen.add(s.setup_id);
        revs.push({ setup_id: s.setup_id, first_at: s.started_at, session_id: s.id });
      }
    });
    return revs;
  }, [orderedSessions]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.15em] text-primary flex items-center gap-1">
            <Flag className="w-3.5 h-3.5" /> Engineering · Race Weekend
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">Weekend timeline</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            A telemetry-style notebook of the weekend — setup revisions, tyre swaps, weather shifts, driver confidence and lap progression, threaded session by session.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Weekend</span>
          <Select value={activeId} onValueChange={setEventId}>
            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Select weekend" /></SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.title}{e.track ? ` · ${e.track}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!activeEvent ? (
        <EmptyState />
      ) : (
        <>
          {/* Title strip */}
          <div className="rounded-lg border border-border bg-card/40 p-4 mb-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" /> {activeEvent.track ?? activeEvent.location ?? "Track TBC"}
              <span className="opacity-60">·</span>
              {new Date(activeEvent.starts_at).toLocaleDateString()}
              {activeEvent.ends_at ? <> – {new Date(activeEvent.ends_at).toLocaleDateString()}</> : null}
              <span className="ml-auto px-2 py-0.5 rounded border border-primary/40 bg-primary/10 text-primary uppercase">
                {activeEvent.status}
              </span>
            </div>
            <h2 className="text-2xl font-semibold mt-2">{activeEvent.title}</h2>
          </div>

          {/* Telemetry strip */}
          <TelemetryStrip
            sessions={orderedSessions}
            bestBySession={bestBySession}
            overallBest={overallBest === Infinity ? null : overallBest}
          />

          {/* Weekend summary KPIs */}
          <SummaryKPIs
            sessions={orderedSessions}
            laps={lapsQ.data ?? []}
            tireChanges={tyreChanges.length}
            setupRevs={setupRevisions.length}
            weatherShifts={weatherShifts.length}
            overallBest={overallBest === Infinity ? null : overallBest}
          />

          {/* Stage timeline */}
          <div className="mt-6 space-y-6">
            {STAGE_ORDER.map((stage) => {
              const arr = grouped.get(stage)!;
              if (arr.length === 0) return null;
              return (
                <StageBlock
                  key={stage}
                  stage={stage}
                  sessions={arr}
                  laps={lapsQ.data ?? []}
                  tires={tiresQ.data ?? []}
                  conf={confQ.data ?? []}
                  fb={fbQ.data ?? []}
                  setupMap={setupMap}
                  bestBySession={bestBySession}
                  overallBest={overallBest === Infinity ? null : overallBest}
                />
              );
            })}
            {sessions.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No sessions logged on this weekend yet. Add sessions from the{" "}
                <Link to="/weekends/$eventId" params={{ eventId: activeId }} className="text-primary underline-offset-4 hover:underline">weekend hub</Link>.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- Components ----------------

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border p-12 text-center">
      <Flag className="w-8 h-8 mx-auto text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">
        No race weekends found. Create one from the{" "}
        <Link to="/calendar" className="text-primary underline-offset-4 hover:underline">calendar</Link>{" "}
        or the <Link to="/weekends" className="text-primary underline-offset-4 hover:underline">weekends hub</Link>.
      </p>
    </div>
  );
}

function SummaryKPIs({
  sessions, laps, tireChanges, setupRevs, weatherShifts, overallBest,
}: {
  sessions: Sess[]; laps: Lap[]; tireChanges: number; setupRevs: number; weatherShifts: number; overallBest: number | null;
}) {
  const totalLaps = laps.length;
  const items = [
    { label: "Sessions", value: String(sessions.length), icon: Timer },
    { label: "Setup revs", value: String(setupRevs), icon: Wrench },
    { label: "Tyre changes", value: String(tireChanges), icon: Disc },
    { label: "Weather shifts", value: String(weatherShifts), icon: CloudRain },
    { label: "Laps", value: String(totalLaps), icon: Activity },
    { label: "Best lap", value: overallBest != null ? formatLapTime(overallBest) : "—", icon: Sparkles },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-4">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div key={it.label} className="rounded-md border border-border bg-card/40 p-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1">
              <Icon className="w-3 h-3" /> {it.label}
            </div>
            <div className="text-lg font-semibold tabular-nums mt-0.5">{it.value}</div>
          </div>
        );
      })}
    </div>
  );
}

function TelemetryStrip({
  sessions, bestBySession, overallBest,
}: { sessions: Sess[]; bestBySession: Map<string, number>; overallBest: number | null }) {
  if (sessions.length === 0 || !overallBest) {
    return null;
  }
  const values = sessions.map((s) => bestBySession.get(s.id) ?? null);
  const finite = values.filter((v): v is number => v != null);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const range = Math.max(1, max - min);
  const W = 900, H = 90, pad = 24;
  const stepX = finite.length > 1 ? (W - pad * 2) / (sessions.length - 1) : 0;
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3 overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Lap-time trace · session bests</div>
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-primary">{formatLapTime(min)} ↓</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[90px]">
        <defs>
          <linearGradient id="trace" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((p) => (
          <line key={p} x1={pad} x2={W - pad} y1={pad + p * (H - pad * 2)} y2={pad + p * (H - pad * 2)}
                stroke="hsl(var(--border))" strokeDasharray="2 4" />
        ))}
        {(() => {
          const pts = sessions.map((s, i) => {
            const v = bestBySession.get(s.id);
            if (v == null) return null;
            const x = pad + i * stepX;
            const y = pad + ((v - min) / range) * (H - pad * 2);
            return { x, y, v, s };
          });
          const valid = pts.filter((p): p is NonNullable<typeof p> => p !== null);
          if (valid.length < 1) return null;
          const d = valid.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
          const area = `${d} L${valid[valid.length - 1].x},${H - pad} L${valid[0].x},${H - pad} Z`;
          return (
            <>
              <path d={area} fill="url(#trace)" />
              <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
              {valid.map((p) => (
                <g key={p.s.id}>
                  <circle cx={p.x} cy={p.y} r="3" fill="hsl(var(--primary))" />
                  <text x={p.x} y={H - 6} textAnchor="middle" className="fill-muted-foreground"
                        style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}>
                    {(p.s.name ?? "").slice(0, 6).toUpperCase()}
                  </text>
                </g>
              ))}
            </>
          );
        })()}
      </svg>
    </div>
  );
}

function StageBlock({
  stage, sessions, laps, tires, conf, fb, setupMap, bestBySession, overallBest,
}: {
  stage: Stage; sessions: Sess[]; laps: Lap[]; tires: Tire[]; conf: Conf[]; fb: Fb[];
  setupMap: Map<string, Setup>; bestBySession: Map<string, number>; overallBest: number | null;
}) {
  const meta = STAGE_META[stage];
  const Icon = meta.icon;
  return (
    <section className={`rounded-lg border ${meta.tone.split(" ").filter((c) => c.startsWith("border-")).join(" ")} bg-card/30`}>
      <header className={`flex items-center gap-3 px-4 py-3 border-b ${meta.tone}`}>
        <Icon className="w-4 h-4" />
        <div className="font-mono text-[11px] uppercase tracking-[0.2em]">{meta.tag}</div>
        <h3 className="text-lg font-semibold tracking-tight">{stage}</h3>
        <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.15em] opacity-70">
          {sessions.length} session{sessions.length === 1 ? "" : "s"}
        </span>
      </header>
      <ol className="relative px-4 py-4">
        <div className="absolute left-[28px] top-4 bottom-4 w-px bg-border" aria-hidden />
        {sessions.map((s) => (
          <SessionRow key={s.id}
            session={s}
            laps={laps.filter((l) => l.session_id === s.id)}
            tires={tires.filter((t) => t.session_id === s.id)}
            conf={conf.filter((c) => c.session_id === s.id)}
            fb={fb.filter((f) => f.session_id === s.id)}
            setupMap={setupMap}
            best={bestBySession.get(s.id) ?? null}
            overallBest={overallBest}
          />
        ))}
      </ol>
    </section>
  );
}

function SessionRow({
  session, laps, tires, conf, fb, setupMap, best, overallBest,
}: {
  session: Sess; laps: Lap[]; tires: Tire[]; conf: Conf[]; fb: Fb[];
  setupMap: Map<string, Setup>; best: number | null; overallBest: number | null;
}) {
  const setup = session.setup_id ? setupMap.get(session.setup_id) : null;
  const lastConf = conf[conf.length - 1] ?? null;
  const firstConf = conf[0] ?? null;
  const confDelta = lastConf && firstConf ? lastConf.overall - firstConf.overall : 0;
  const uniqueTireSets = Array.from(new Set(tires.map((t) => t.tire_set)));
  const lapDelta = best && overallBest ? best - overallBest : null;

  // Lap-time mini sparkline within session
  const lapTimes = laps.map((l) => l.lap_time_ms);

  return (
    <li className="relative pl-12 pb-5 last:pb-0">
      <span className="absolute left-[20px] top-1 w-4 h-4 rounded-full border-2 border-primary bg-background" aria-hidden />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
        <div className="rounded-md border border-border bg-card/40 p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/sessions/$sessionId" params={{ sessionId: session.id }}
                  className="font-semibold hover:text-primary inline-flex items-center gap-1">
              {session.name || session.session_type} <ChevronRight className="w-3 h-3 opacity-60" />
            </Link>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              {new Date(session.started_at).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
            {session.driver && (
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">· {session.driver}</span>
            )}
            <span className="ml-auto font-mono text-xs tabular-nums">
              {best != null ? formatLapTime(best) : "—"}
              {lapDelta != null && lapDelta > 0 && (
                <span className="ml-2 text-muted-foreground">+{(lapDelta / 1000).toFixed(3)}s</span>
              )}
              {lapDelta === 0 && best != null && (
                <span className="ml-2 text-primary">★ Best</span>
              )}
            </span>
          </div>

          {/* mini lap trace */}
          {lapTimes.length > 1 && <LapSparkline values={lapTimes} />}

          {/* Engineering chips */}
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em]">
            {session.weather && (
              <Chip icon={CloudRain} tone="text-chart-2 border-chart-2/40 bg-chart-2/5">{session.weather}</Chip>
            )}
            {(session.air_temp_c != null || session.track_temp_c != null) && (
              <Chip icon={Thermometer} tone="text-muted-foreground border-border">
                {session.air_temp_c != null ? `air ${session.air_temp_c}°` : ""}
                {session.air_temp_c != null && session.track_temp_c != null ? " · " : ""}
                {session.track_temp_c != null ? `track ${session.track_temp_c}°` : ""}
              </Chip>
            )}
            {setup && (
              <Chip icon={Wrench} tone="text-accent border-accent/40 bg-accent/5">
                Setup · {setup.name}
              </Chip>
            )}
            {uniqueTireSets.map((t) => (
              <Chip key={t} icon={Disc} tone="text-primary border-primary/40 bg-primary/5">{t}</Chip>
            ))}
            {lastConf && (
              <Chip icon={Gauge} tone="text-foreground border-border">
                Conf {lastConf.overall}/10
                {confDelta !== 0 && (
                  <span className={`ml-1 ${confDelta > 0 ? "text-primary" : "text-destructive"}`}>
                    {confDelta > 0 ? "▲" : "▼"}{Math.abs(confDelta)}
                  </span>
                )}
              </Chip>
            )}
            <Chip icon={Activity} tone="text-muted-foreground border-border">{laps.length} laps</Chip>
          </div>

          {/* Engineering notes */}
          {fb.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {fb.slice(0, 4).map((f) => (
                <li key={f.id} className="flex gap-2 items-start">
                  <span className={`mt-0.5 inline-block w-1.5 h-1.5 rounded-full ${
                    f.severity === "high" ? "bg-destructive" : f.severity === "warning" ? "bg-chart-3" : "bg-primary"
                  }`} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground w-16 shrink-0">
                    {f.category}
                  </span>
                  <span className="text-foreground/90">{f.description}</span>
                </li>
              ))}
              {fb.length > 4 && (
                <li className="text-[11px] text-muted-foreground pl-4">+ {fb.length - 4} more notes</li>
              )}
            </ul>
          )}
          {lastConf?.notes && (
            <p className="mt-2 text-xs text-muted-foreground flex gap-2">
              <ClipboardList className="w-3 h-3 mt-0.5 shrink-0" /> {lastConf.notes}
            </p>
          )}
        </div>

        {/* Confidence sidebar */}
        <ConfidencePanel conf={lastConf} />
      </div>
    </li>
  );
}

function Chip({ icon: Icon, tone, children }: { icon: typeof Flag; tone: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${tone}`}>
      <Icon className="w-3 h-3" /> {children}
    </span>
  );
}

function LapSparkline({ values }: { values: number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const W = 600, H = 36;
  const stepX = values.length > 1 ? W / (values.length - 1) : 0;
  const d = values.map((v, i) => {
    const x = i * stepX;
    const y = ((v - min) / range) * (H - 6) + 3;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const bestIdx = values.indexOf(min);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-9 mt-2">
      <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.2" opacity="0.9" />
      <circle cx={bestIdx * stepX} cy={3} r="2.5" fill="hsl(var(--primary))" />
    </svg>
  );
}

function ConfidencePanel({ conf }: { conf: Conf | null }) {
  if (!conf) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/20 p-3 text-[11px] text-muted-foreground flex items-center gap-2">
        <Gauge className="w-3.5 h-3.5" /> No confidence log
      </div>
    );
  }
  const rows: { label: string; v: number | null }[] = [
    { label: "Overall",  v: conf.overall },
    { label: "Front",    v: conf.front },
    { label: "Rear",     v: conf.rear },
    { label: "Brakes",   v: conf.brakes },
    { label: "Traction", v: conf.traction },
  ];
  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1">
        <Gauge className="w-3 h-3" /> Driver confidence
      </div>
      <ul className="mt-2 space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[64px_1fr_24px] items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{r.label}</span>
            <div className="h-1.5 rounded bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${((r.v ?? 0) / 10) * 100}%` }} />
            </div>
            <span className="text-[11px] font-mono tabular-nums text-right">{r.v ?? "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}