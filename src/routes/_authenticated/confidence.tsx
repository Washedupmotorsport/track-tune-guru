import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Gauge, Plus, TrendingUp, TrendingDown, Activity, Minus,
  ShieldCheck, Disc, Wind, CloudSun, Thermometer, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/confidence")({ component: ConfidencePage });

type Car = { id: string; name: string };
type Session = {
  id: string; name: string; car_id: string; started_at: string;
  track: string | null; setup_id: string | null; weather: string | null;
  air_temp_c: number | null; track_temp_c: number | null;
};
type Setup = { id: string; name: string; car_id: string };
type Lap = { id: string; session_id: string | null; car_id: string; lap_time_ms: number };
type TireLog = {
  id: string; session_id: string | null; car_id: string;
  hot_fl: number | null; hot_fr: number | null; hot_rl: number | null; hot_rr: number | null;
};
type Confidence = {
  id: string; car_id: string; session_id: string | null; setup_id: string | null;
  overall: number; front: number | null; rear: number | null;
  brakes: number | null; traction: number | null;
  weather: string | null; air_temp_c: number | null; track_temp_c: number | null;
  hot_fl: number | null; hot_fr: number | null; hot_rl: number | null; hot_rr: number | null;
  best_lap_ms: number | null;
  notes: string | null;
  recorded_at: string;
};

const METRICS = [
  { key: "overall",  label: "Overall",  icon: Gauge,       hint: "Driver confidence" },
  { key: "front",    label: "Front",    icon: Activity,    hint: "Front end confidence" },
  { key: "rear",     label: "Rear",     icon: ShieldCheck, hint: "Rear stability" },
  { key: "brakes",   label: "Brakes",   icon: Disc,        hint: "Brake confidence" },
  { key: "traction", label: "Traction", icon: Wind,        hint: "Traction confidence" },
] as const;
type MetricKey = (typeof METRICS)[number]["key"];

const schema = z.object({
  car_id: z.string().uuid("Pick a car"),
  session_id: z.string().uuid().nullable(),
  setup_id: z.string().uuid().nullable(),
  overall: z.number().int().min(1).max(10),
  front: z.number().int().min(1).max(10),
  rear: z.number().int().min(1).max(10),
  brakes: z.number().int().min(1).max(10),
  traction: z.number().int().min(1).max(10),
  weather: z.string().max(40).nullable(),
  notes: z.string().trim().max(2000).nullable(),
});

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3);
  return m > 0 ? `${m}:${s.padStart(6, "0")}` : `${s}s`;
}

function scoreClass(v: number | null | undefined): string {
  if (v == null) return "text-muted-foreground";
  if (v >= 8) return "text-primary";
  if (v >= 6) return "text-foreground";
  if (v >= 4) return "text-accent";
  return "text-destructive";
}

function ConfidencePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [carId, setCarId] = useState<string>("");
  const [open, setOpen] = useState(false);

  const carsQ = useQuery({
    queryKey: ["conf-cars", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id,name").order("created_at");
      if (error) throw error;
      return (data ?? []) as Car[];
    },
    enabled: !!user,
  });

  const activeCarId = carId || carsQ.data?.[0]?.id || "";

  const sessionsQ = useQuery({
    queryKey: ["conf-sessions", activeCarId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id,name,car_id,started_at,track,setup_id,weather,air_temp_c,track_temp_c")
        .eq("car_id", activeCarId)
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Session[];
    },
    enabled: !!activeCarId,
  });

  const setupsQ = useQuery({
    queryKey: ["conf-setups", activeCarId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setups").select("id,name,car_id").eq("car_id", activeCarId);
      if (error) throw error;
      return (data ?? []) as Setup[];
    },
    enabled: !!activeCarId,
  });

  const confQ = useQuery({
    queryKey: ["conf-entries", activeCarId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_confidence")
        .select("*")
        .eq("car_id", activeCarId)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Confidence[];
    },
    enabled: !!activeCarId,
  });

  const lapsQ = useQuery({
    queryKey: ["conf-laps", activeCarId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("laps").select("id,session_id,car_id,lap_time_ms")
        .eq("car_id", activeCarId);
      if (error) throw error;
      return (data ?? []) as Lap[];
    },
    enabled: !!activeCarId,
  });

  const tireQ = useQuery({
    queryKey: ["conf-tires", activeCarId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tire_logs").select("id,session_id,car_id,hot_fl,hot_fr,hot_rl,hot_rr")
        .eq("car_id", activeCarId);
      if (error) throw error;
      return (data ?? []) as TireLog[];
    },
    enabled: !!activeCarId,
  });

  // Index sessions by id for lookups
  const sessionsById = useMemo(() => {
    const m: Record<string, Session> = {};
    (sessionsQ.data ?? []).forEach((s) => (m[s.id] = s));
    return m;
  }, [sessionsQ.data]);

  const setupsById = useMemo(() => {
    const m: Record<string, Setup> = {};
    (setupsQ.data ?? []).forEach((s) => (m[s.id] = s));
    return m;
  }, [setupsQ.data]);

  // Best lap per session
  const bestBySession = useMemo(() => {
    const m: Record<string, number> = {};
    (lapsQ.data ?? []).forEach((l) => {
      if (!l.session_id || !l.lap_time_ms) return;
      const prev = m[l.session_id];
      if (prev == null || l.lap_time_ms < prev) m[l.session_id] = l.lap_time_ms;
    });
    return m;
  }, [lapsQ.data]);

  // Avg hot pressures per session
  const avgHotBySession = useMemo(() => {
    const m: Record<string, number> = {};
    const count: Record<string, number> = {};
    (tireQ.data ?? []).forEach((t) => {
      if (!t.session_id) return;
      const vals = [t.hot_fl, t.hot_fr, t.hot_rl, t.hot_rr].filter((v): v is number => v != null);
      if (!vals.length) return;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      m[t.session_id] = (m[t.session_id] ?? 0) + avg;
      count[t.session_id] = (count[t.session_id] ?? 0) + 1;
    });
    Object.keys(m).forEach((k) => (m[k] = m[k] / count[k]));
    return m;
  }, [tireQ.data]);

  const entries = confQ.data ?? [];

  // Averages
  const averages = useMemo(() => {
    const out: Record<MetricKey, number | null> = {
      overall: null, front: null, rear: null, brakes: null, traction: null,
    };
    if (!entries.length) return out;
    METRICS.forEach((m) => {
      const vals = entries.map((e) => e[m.key]).filter((v): v is number => v != null);
      out[m.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    return out;
  }, [entries]);

  // Recent trend (last vs prior average)
  const trends = useMemo(() => {
    const out: Record<MetricKey, number> = {
      overall: 0, front: 0, rear: 0, brakes: 0, traction: 0,
    };
    if (entries.length < 2) return out;
    const last = entries[entries.length - 1];
    const prior = entries.slice(0, -1);
    METRICS.forEach((m) => {
      const vals = prior.map((e) => e[m.key]).filter((v): v is number => v != null);
      if (!vals.length || last[m.key] == null) return;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      out[m.key] = (last[m.key] as number) - avg;
    });
    return out;
  }, [entries]);

  // Setup effectiveness: avg overall + avg best lap per setup
  const setupRows = useMemo(() => {
    const buckets: Record<string, { conf: number[]; laps: number[] }> = {};
    entries.forEach((e) => {
      const key = e.setup_id ?? "_none";
      const b = (buckets[key] ||= { conf: [], laps: [] });
      b.conf.push(e.overall);
      if (e.best_lap_ms) b.laps.push(e.best_lap_ms);
    });
    return Object.entries(buckets).map(([id, b]) => ({
      id,
      name: id === "_none" ? "Unassigned" : setupsById[id]?.name ?? "Removed setup",
      n: b.conf.length,
      avgConf: b.conf.reduce((a, c) => a + c, 0) / b.conf.length,
      bestLap: b.laps.length ? Math.min(...b.laps) : null,
      avgLap: b.laps.length ? b.laps.reduce((a, c) => a + c, 0) / b.laps.length : null,
    })).sort((a, b) => b.avgConf - a.avgConf);
  }, [entries, setupsById]);

  // Weather correlation
  const weatherRows = useMemo(() => {
    const buckets: Record<string, number[]> = {};
    entries.forEach((e) => {
      const key = (e.weather || "—").toLowerCase();
      (buckets[key] ||= []).push(e.overall);
    });
    return Object.entries(buckets).map(([k, vs]) => ({
      label: k, n: vs.length,
      avg: vs.reduce((a, c) => a + c, 0) / vs.length,
    })).sort((a, b) => b.avg - a.avg);
  }, [entries]);

  // Tyre pressure correlation buckets
  const pressureRows = useMemo(() => {
    const buckets: Record<string, { conf: number[]; }> = {
      low: { conf: [] }, mid: { conf: [] }, high: { conf: [] }, none: { conf: [] },
    };
    entries.forEach((e) => {
      const vals = [e.hot_fl, e.hot_fr, e.hot_rl, e.hot_rr].filter((v): v is number => v != null);
      if (!vals.length) { buckets.none.conf.push(e.overall); return; }
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (avg < 27) buckets.low.conf.push(e.overall);
      else if (avg < 30) buckets.mid.conf.push(e.overall);
      else buckets.high.conf.push(e.overall);
    });
    return Object.entries(buckets)
      .filter(([, b]) => b.conf.length)
      .map(([k, b]) => ({
        key: k,
        label: k === "low" ? "Cold (< 27 psi)" : k === "mid" ? "Window (27–30)" : k === "high" ? "Hot (> 30)" : "No data",
        n: b.conf.length,
        avg: b.conf.reduce((a, c) => a + c, 0) / b.conf.length,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [entries]);

  // Consistency: stddev of overall confidence
  const consistency = useMemo(() => {
    if (entries.length < 2) return null;
    const vals = entries.map((e) => e.overall);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    return Math.sqrt(variance);
  }, [entries]);

  // Lap vs confidence correlation (simple Pearson)
  const lapCorrelation = useMemo(() => {
    const xs: number[] = [], ys: number[] = [];
    entries.forEach((e) => {
      if (e.best_lap_ms != null) { xs.push(e.overall); ys.push(e.best_lap_ms); }
    });
    if (xs.length < 3) return null;
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0, dx2 = 0, dy2 = 0;
    xs.forEach((x, i) => {
      num += (x - mx) * (ys[i] - my);
      dx2 += (x - mx) ** 2; dy2 += (ys[i] - my) ** 2;
    });
    return dx2 && dy2 ? num / Math.sqrt(dx2 * dy2) : 0;
  }, [entries]);

  const addMut = useMutation({
    mutationFn: async (form: z.infer<typeof schema> & { session_id: string | null }) => {
      const session = form.session_id ? sessionsById[form.session_id] : null;
      const hotAvg = session ? avgHotBySession[session.id] : null;
      const best = session ? bestBySession[session.id] : null;
      const row = {
        user_id: user!.id,
        car_id: form.car_id,
        session_id: form.session_id,
        setup_id: form.setup_id ?? session?.setup_id ?? null,
        overall: form.overall,
        front: form.front,
        rear: form.rear,
        brakes: form.brakes,
        traction: form.traction,
        weather: form.weather || session?.weather || null,
        air_temp_c: session?.air_temp_c ?? null,
        track_temp_c: session?.track_temp_c ?? null,
        hot_fl: null as number | null,
        hot_fr: null as number | null,
        hot_rl: null as number | null,
        hot_rr: null as number | null,
        best_lap_ms: best ?? null,
        notes: form.notes,
      };
      // store avg as a single placeholder via hot_fl? No — leave nulls; correlation uses logs anyway.
      // But we want to capture avg into the entry for fast lookup:
      if (hotAvg != null) {
        row.hot_fl = hotAvg; row.hot_fr = hotAvg; row.hot_rl = hotAvg; row.hot_rr = hotAvg;
      }
      const { error } = await supabase.from("driver_confidence").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Confidence logged");
      qc.invalidateQueries({ queryKey: ["conf-entries"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to log"),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("driver_confidence").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conf-entries"] }),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary">Driver telemetry</div>
          <h1 className="text-2xl font-semibold tracking-tight">Confidence &amp; feel</h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            What makes the driver comfortable and fast. Rate after each session, then correlate with setup, tyres, weather and lap times.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={activeCarId}
            onChange={(e) => setCarId(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-xs font-mono uppercase tracking-widest"
          >
            {(carsQ.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={() => setOpen(true)}
            disabled={!activeCarId}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-mono uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Log session
          </button>
        </div>
      </header>

      {/* KPI cards */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {METRICS.map((m) => {
          const Icon = m.icon;
          const val = averages[m.key];
          const tr = trends[m.key];
          const TrendIcon = tr > 0.2 ? TrendingUp : tr < -0.2 ? TrendingDown : Minus;
          const trendCls = tr > 0.2 ? "text-primary" : tr < -0.2 ? "text-destructive" : "text-muted-foreground";
          return (
            <div key={m.key} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{m.label}</div>
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className={`text-2xl font-mono tabular-nums mt-1 ${scoreClass(val ?? null)}`}>
                {val == null ? "—" : val.toFixed(1)}
              </div>
              <div className={`flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest ${trendCls}`}>
                <TrendIcon className="w-3 h-3" />
                {tr === 0 ? "stable" : `${tr > 0 ? "+" : ""}${tr.toFixed(1)} vs avg`}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">{m.hint}</div>
            </div>
          );
        })}
      </section>

      {/* Trend graph */}
      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-2 flex items-center justify-between">
          <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Confidence over time</div>
          <div className="text-[10px] font-mono text-muted-foreground">{entries.length} entries</div>
        </div>
        <div className="p-4">
          {entries.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">
              No confidence data yet. Tap “Log session” after your next outing.
            </div>
          ) : (
            <TrendChart entries={entries} />
          )}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Setup effectiveness */}
        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-2 flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Setup effectiveness</div>
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border">
            {setupRows.length === 0 && <div className="px-4 py-6 text-xs text-muted-foreground">No data.</div>}
            {setupRows.map((r) => (
              <div key={r.id} className="px-4 py-2 flex items-center justify-between text-xs">
                <div className="flex flex-col">
                  <div className="font-mono">{r.name}</div>
                  <div className="text-[10px] text-muted-foreground">{r.n} session{r.n === 1 ? "" : "s"} · best {fmtMs(r.bestLap)}</div>
                </div>
                <div className="flex items-center gap-3 font-mono tabular-nums">
                  <span className={scoreClass(r.avgConf)}>{r.avgConf.toFixed(1)}</span>
                  <div className="w-24 h-1.5 bg-muted/40 rounded">
                    <div className="h-full bg-primary rounded" style={{ width: `${(r.avgConf / 10) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Weather */}
        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-2 flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Weather correlation</div>
            <CloudSun className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border">
            {weatherRows.length === 0 && <div className="px-4 py-6 text-xs text-muted-foreground">No data.</div>}
            {weatherRows.map((r) => (
              <div key={r.label} className="px-4 py-2 flex items-center justify-between text-xs">
                <div className="font-mono uppercase tracking-widest">{r.label}</div>
                <div className="flex items-center gap-3 font-mono tabular-nums">
                  <span className="text-muted-foreground">n={r.n}</span>
                  <span className={scoreClass(r.avg)}>{r.avg.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pressure window */}
        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-2 flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Tyre pressure window</div>
            <Thermometer className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border">
            {pressureRows.length === 0 && <div className="px-4 py-6 text-xs text-muted-foreground">Log hot pressures in tyres to populate.</div>}
            {pressureRows.map((r) => (
              <div key={r.key} className="px-4 py-2 flex items-center justify-between text-xs">
                <div className="font-mono">{r.label}</div>
                <div className="flex items-center gap-3 font-mono tabular-nums">
                  <span className="text-muted-foreground">n={r.n}</span>
                  <span className={scoreClass(r.avg)}>{r.avg.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Consistency + lap correlation */}
        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-2 flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Consistency &amp; pace link</div>
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Confidence std-dev</span>
              <span className="font-mono tabular-nums">{consistency == null ? "—" : consistency.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Confidence ↔ best-lap correlation</span>
              <span className="font-mono tabular-nums">
                {lapCorrelation == null ? "—" : lapCorrelation.toFixed(2)}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Negative correlation means higher confidence pairs with faster (lower) lap times — that's good. Std-dev below 1.5 indicates a settled driver.
            </p>
          </div>
        </section>
      </div>

      {/* Recent log */}
      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-primary">
          Recent debriefs
        </div>
        <div className="divide-y divide-border">
          {entries.length === 0 && <div className="px-4 py-6 text-xs text-muted-foreground">No entries.</div>}
          {[...entries].reverse().slice(0, 12).map((e) => {
            const session = e.session_id ? sessionsById[e.session_id] : null;
            const setup = e.setup_id ? setupsById[e.setup_id] : null;
            return (
              <div key={e.id} className="px-4 py-3 grid md:grid-cols-[1fr_auto] gap-2">
                <div className="space-y-1">
                  <div className="text-xs font-mono">
                    {session?.name ?? "Free entry"} · {new Date(e.recorded_at).toLocaleString()}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {METRICS.map((m) => (
                      <span key={m.key} className="flex items-center gap-1">
                        {m.label.slice(0,3)}
                        <span className={`tabular-nums ${scoreClass(e[m.key] as number | null)}`}>
                          {e[m.key] ?? "—"}
                        </span>
                      </span>
                    ))}
                    {setup && <span>· setup {setup.name}</span>}
                    {e.weather && <span>· {e.weather}</span>}
                    {e.best_lap_ms && <span>· best {fmtMs(e.best_lap_ms)}</span>}
                  </div>
                  {e.notes && <div className="text-xs text-muted-foreground">{e.notes}</div>}
                </div>
                <button
                  onClick={() => removeMut.mutate(e.id)}
                  className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-destructive self-start"
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {open && activeCarId && (
        <LogDialog
          carId={activeCarId}
          sessions={sessionsQ.data ?? []}
          setups={setupsQ.data ?? []}
          onClose={() => setOpen(false)}
          onSubmit={(form) => addMut.mutate(form)}
          submitting={addMut.isPending}
        />
      )}
    </div>
  );
}

function TrendChart({ entries }: { entries: Confidence[] }) {
  const W = 720, H = 200, pad = 24;
  const xs = entries.map((_, i) => i);
  const xScale = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, xs.length - 1);
  const yScale = (v: number) => H - pad - ((v - 1) / 9) * (H - pad * 2);
  const colors: Record<MetricKey, string> = {
    overall: "hsl(var(--primary))",
    front: "hsl(var(--foreground))",
    rear: "hsl(var(--accent))",
    brakes: "hsl(var(--destructive))",
    traction: "hsl(var(--muted-foreground))",
  };
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[200px] min-w-[480px]">
        {[2,4,6,8,10].map((g) => (
          <line key={g} x1={pad} x2={W-pad} y1={yScale(g)} y2={yScale(g)}
            stroke="hsl(var(--border))" strokeDasharray="2 4" />
        ))}
        {METRICS.map((m) => {
          const pts = entries
            .map((e, i) => (e[m.key] == null ? null : `${xScale(i)},${yScale(e[m.key] as number)}`))
            .filter(Boolean).join(" ");
          return (
            <polyline key={m.key} points={pts} fill="none"
              stroke={colors[m.key]} strokeWidth={m.key === "overall" ? 2 : 1}
              opacity={m.key === "overall" ? 1 : 0.6} />
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-3 mt-2 text-[10px] font-mono uppercase tracking-widest">
        {METRICS.map((m) => (
          <span key={m.key} className="flex items-center gap-1">
            <span className="w-3 h-0.5" style={{ background: colors[m.key] }} />
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function LogDialog({
  carId, sessions, setups, onClose, onSubmit, submitting,
}: {
  carId: string;
  sessions: Session[];
  setups: Setup[];
  onClose: () => void;
  onSubmit: (form: z.infer<typeof schema> & { session_id: string | null }) => void;
  submitting: boolean;
}) {
  const [sessionId, setSessionId] = useState<string>(sessions[0]?.id ?? "");
  const [setupId, setSetupId] = useState<string>("");
  const [values, setValues] = useState<Record<MetricKey, number>>({
    overall: 7, front: 7, rear: 7, brakes: 7, traction: 7,
  });
  const [weather, setWeather] = useState("");
  const [notes, setNotes] = useState("");

  function submit() {
    const parsed = schema.safeParse({
      car_id: carId,
      session_id: sessionId || null,
      setup_id: setupId || null,
      ...values,
      weather: weather || null,
      notes: notes || null,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    onSubmit(parsed.data);
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 space-y-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary">Post-session debrief</div>
          <h2 className="text-lg font-semibold">Rate driver confidence</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Session</span>
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs">
              <option value="">Free entry</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {new Date(s.started_at).toLocaleDateString()}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Setup</span>
            <select value={setupId} onChange={(e) => setSetupId(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs">
              <option value="">Auto from session</option>
              {setups.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </label>
        </div>

        <div className="space-y-3">
          {METRICS.map((m) => (
            <div key={m.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono uppercase tracking-widest text-muted-foreground">{m.label}</span>
                <span className={`font-mono tabular-nums ${scoreClass(values[m.key])}`}>{values[m.key]}/10</span>
              </div>
              <input
                type="range" min={1} max={10} step={1}
                value={values[m.key]}
                onChange={(e) => setValues((v) => ({ ...v, [m.key]: Number(e.target.value) }))}
                className="w-full accent-primary"
              />
            </div>
          ))}
        </div>

        <label className="block space-y-1 text-xs">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Weather override</span>
          <input value={weather} onChange={(e) => setWeather(e.target.value)}
            placeholder="dry / damp / wet"
            className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs" />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What helped / hurt confidence this run"
            className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs" />
        </label>

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose}
            className="h-9 px-3 rounded-md border border-border text-xs font-mono uppercase tracking-widest hover:border-primary/40">
            Cancel
          </button>
          <button onClick={submit} disabled={submitting}
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-mono uppercase tracking-widest hover:opacity-90 disabled:opacity-50">
            Save debrief
          </button>
        </div>
      </div>
    </div>
  );
}