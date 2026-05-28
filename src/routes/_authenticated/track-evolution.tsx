import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useUnits } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CloudRain, Thermometer, Wind, Activity, Gauge, Disc, AlertTriangle, Sparkles, Plus, Trash2, CloudSun, Droplets, Flame, Snowflake } from "lucide-react";
import { getCurrentWeather } from "@/lib/weather";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/track-evolution")({
  component: TrackEvolutionPage,
  head: () => ({
    meta: [
      { title: "Track Evolution — My Race Engineer" },
      { name: "description", content: "Live track-state engineer: classify green vs rubbered-in vs greasy vs wet, and get setup, pressure and balance calls as the session evolves." },
    ],
  }),
});

// ------------------------------------------------------------
// Track-state model. Pure functions — easy to reason about and test.
// ------------------------------------------------------------

type Snap = {
  id: string;
  t: number;            // ms since epoch
  minute: number;       // minutes into session
  air: number;          // °C
  track: number;        // °C
  hotAvg: number | null; // psi
  grip: number;         // 1..10 driver grip feel
  surface: "dry" | "damp" | "wet";
  laps: number;
  note: string;
};

type State =
  | "green"
  | "rubbering"
  | "rubbered-in"
  | "greasy"
  | "cooling"
  | "wet-transition"
  | "wet"
  | "overheating";

const STATE_META: Record<State, { label: string; icon: typeof CloudRain; tone: string; blurb: string }> = {
  green:           { label: "Green track",       icon: Snowflake,   tone: "text-chart-2",       blurb: "Cold, low-grip surface. No rubber laid. Expect understeer + lock-ups." },
  rubbering:       { label: "Rubbering in",      icon: Activity,    tone: "text-chart-3",       blurb: "Grip climbing each lap. Pace will drop. Don't chase the balance yet." },
  "rubbered-in":   { label: "Rubbered in",       icon: Sparkles,    tone: "text-primary",       blurb: "Peak mechanical grip window. Push for representative lap." },
  greasy:          { label: "Greasy",            icon: Droplets,    tone: "text-accent",        blurb: "Dust / oil / cold rubber. Low front bite, rear steps out." },
  cooling:         { label: "Cooling",           icon: Wind,        tone: "text-chart-2",       blurb: "Track temp falling. Pressures drop, tyres go off the bottom of the window." },
  "wet-transition":{ label: "Wet transition",    icon: CloudRain,   tone: "text-chart-2",       blurb: "Surface damp / drying. Dry line forming. Balance changes lap to lap." },
  wet:             { label: "Wet",               icon: CloudRain,   tone: "text-chart-2",       blurb: "Standing water. Aquaplane risk. Slick tyre is undriveable." },
  overheating:     { label: "Overheating",       icon: Flame,       tone: "text-destructive",   blurb: "Tyres above working window. Grease, blistering risk, big falloff." },
};

function classify(snaps: Snap[]): { state: State; trend: "warming" | "cooling" | "steady"; deltaC: number } {
  if (snaps.length === 0) return { state: "green", trend: "steady", deltaC: 0 };
  const last = snaps[snaps.length - 1];
  const first = snaps[0];
  const deltaC = +(last.track - first.track).toFixed(1);
  const trend = deltaC >= 1.5 ? "warming" : deltaC <= -1.5 ? "cooling" : "steady";

  if (last.surface === "wet") return { state: "wet", trend, deltaC };
  if (last.surface === "damp") return { state: "wet-transition", trend, deltaC };

  // Tyre window: assume working psi 30–34 hot for slick; >35 = overheating
  if (last.hotAvg != null && last.hotAvg >= 35 && last.track >= 35) {
    return { state: "overheating", trend, deltaC };
  }
  if (last.track <= 18 && last.grip <= 5) return { state: "green", trend, deltaC };
  if (trend === "cooling" && last.track < 25) return { state: "cooling", trend, deltaC };
  if (last.grip <= 4) return { state: "greasy", trend, deltaC };
  if (last.grip >= 8 && last.minute >= 20) return { state: "rubbered-in", trend, deltaC };
  if (last.minute >= 5) return { state: "rubbering", trend, deltaC };
  return { state: "green", trend, deltaC };
}

type Reco = {
  category: "Setup" | "Pressures" | "Balance" | "Driving";
  change: string;
  reason: string;
  priority: "high" | "medium" | "low";
};

function recommendations(s: { state: State; trend: string; deltaC: number }, last: Snap | null): Reco[] {
  const out: Reco[] = [];
  if (!last) return out;
  switch (s.state) {
    case "green":
      out.push({ category: "Pressures", change: "Drop cold pressures 1.0 psi all round", reason: "Cold track won't load the tyre — lower psi to widen contact patch.", priority: "high" });
      out.push({ category: "Balance", change: "Soften front ARB one step", reason: "Front grip is the limit on green tarmac.", priority: "medium" });
      out.push({ category: "Driving", change: "Patience through warm-up, brake earlier into T1", reason: "No bite on cold surface — lock-up risk is high.", priority: "high" });
      break;
    case "rubbering":
      out.push({ category: "Driving", change: "Expect 0.3–0.8s per lap improvement — don't chase balance yet", reason: "Grip is climbing every lap; setup changes will be invalidated.", priority: "medium" });
      out.push({ category: "Pressures", change: "Hold pressures; monitor hot reading next stop", reason: "Wait for tyres to stabilise before reacting.", priority: "low" });
      break;
    case "rubbered-in":
      out.push({ category: "Driving", change: "Run reference lap NOW", reason: "Peak grip window — anything logged here is the real benchmark.", priority: "high" });
      out.push({ category: "Balance", change: "Trim balance with ARB / brake bias only", reason: "Geometry should be locked in; fine-tune dynamic balance.", priority: "medium" });
      break;
    case "greasy":
      out.push({ category: "Balance", change: "Move brake bias 1% rearward", reason: "Front is washing — unload front under braking.", priority: "high" });
      out.push({ category: "Setup", change: "Soften rear damper rebound one click", reason: "Help rear tyre stay planted on slippery surface.", priority: "medium" });
      out.push({ category: "Driving", change: "Short-shift out of slow corners", reason: "Avoid wheelspin while rear grip is low.", priority: "high" });
      break;
    case "cooling":
      out.push({ category: "Pressures", change: `Add ${Math.min(2, Math.max(0.5, Math.abs(s.deltaC) * 0.08)).toFixed(1)} psi cold all round`, reason: `Track dropped ${s.deltaC}°C — tyre falls out of bottom of pressure window.`, priority: "high" });
      out.push({ category: "Setup", change: "Consider one step softer front spring / ARB", reason: "Help generate front tyre temperature.", priority: "medium" });
      out.push({ category: "Driving", change: "Add an extra warm-up lap", reason: "Need more energy into the tyre to reach window.", priority: "medium" });
      break;
    case "wet-transition":
      out.push({ category: "Setup", change: "Drop ride height ~3 mm, soften rear ARB one step", reason: "More compliance over standing water and bumps.", priority: "high" });
      out.push({ category: "Pressures", change: "Drop cold pressures 1.5–2.0 psi all round", reason: "Lower temps + need contact patch for water clearance.", priority: "high" });
      out.push({ category: "Balance", change: "Brake bias 2% rearward", reason: "Damp surface reduces front grip first.", priority: "high" });
      out.push({ category: "Driving", change: "Run dry line in fast corners, off-line in slow", reason: "Cleanest tarmac vs water dispersal trade-off.", priority: "medium" });
      break;
    case "wet":
      out.push({ category: "Setup", change: "Switch to wet tyre — slick is undriveable", reason: "Standing water + aquaplane risk.", priority: "high" });
      out.push({ category: "Pressures", change: "Wet target: 23–25 psi hot", reason: "Wet compounds want lower pressure for grooves to bite.", priority: "high" });
      out.push({ category: "Balance", change: "Soften ARBs front and rear", reason: "Maximum mechanical compliance.", priority: "medium" });
      break;
    case "overheating":
      out.push({ category: "Pressures", change: `Drop cold pressures ${(((last.hotAvg ?? 35) - 33) * 0.6).toFixed(1)} psi all round`, reason: "Hot pressures over working window — tyres are greasing up.", priority: "high" });
      out.push({ category: "Driving", change: "Manage tyres for 2 laps, then push", reason: "Let surface temp shed before the timed lap.", priority: "high" });
      out.push({ category: "Setup", change: "Open brake ducts / increase camber 0.2°", reason: "Reduce heat soak and even out contact patch.", priority: "medium" });
      break;
  }
  return out;
}

function avg(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter((x): x is number => typeof x === "number" && !isNaN(x));
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

// ------------------------------------------------------------

function TrackEvolutionPage() {
  const { user } = useAuth();
  const { pressureUnit, tempUnit, system, toDisplayPressure } = useUnits();

  const sessionsQ = useQuery({
    queryKey: ["te-sessions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions")
        .select("id,name,started_at,track,air_temp_c,track_temp_c,weather")
        .order("started_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const tireLogsQ = useQuery({
    queryKey: ["te-tirelogs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tire_logs")
        .select("id,session_id,hot_fl,hot_fr,hot_rl,hot_rr,recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  // Local snapshot timeline — this page is the engineer's pad, not a DB record.
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [startAt] = useState(() => Date.now());

  // Draft snapshot inputs
  const [air, setAir] = useState("22");
  const [track, setTrack] = useState("28");
  const [hotAvg, setHotAvg] = useState("");
  const [grip, setGrip] = useState(6);
  const [surface, setSurface] = useState<Snap["surface"]>("dry");
  const [laps, setLaps] = useState("0");
  const [note, setNote] = useState("");

  // Auto-fill from latest session + tire log
  useEffect(() => {
    const s = sessionsQ.data?.[0];
    const tl = tireLogsQ.data?.[0];
    if (s) {
      if (s.air_temp_c != null) setAir(String(s.air_temp_c));
      if (s.track_temp_c != null) setTrack(String(s.track_temp_c));
      if (s.weather?.toLowerCase().includes("rain")) setSurface("wet");
    }
    if (tl) {
      const a = avg([tl.hot_fl, tl.hot_fr, tl.hot_rl, tl.hot_rr]);
      if (a != null) setHotAvg(a.toFixed(1));
    }
  }, [sessionsQ.data, tireLogsQ.data]);

  const addSnap = () => {
    const a = parseFloat(air), t = parseFloat(track);
    if (isNaN(a) || isNaN(t)) { toast.error("Enter air + track temperature"); return; }
    const now = Date.now();
    setSnaps((prev) => [
      ...prev,
      {
        id: uid(),
        t: now,
        minute: Math.round((now - startAt) / 60000),
        air: a, track: t,
        hotAvg: hotAvg ? parseFloat(hotAvg) : null,
        grip,
        surface,
        laps: parseInt(laps) || 0,
        note: note.trim(),
      },
    ]);
    setNote("");
  };

  const removeSnap = (id: string) => setSnaps((s) => s.filter((x) => x.id !== id));

  const pullWeather = async () => {
    try {
      const w = await getCurrentWeather();
      setAir(String(w.air_temp_c));
      toast.success(`Weather: ${w.weather}, ${w.air_temp_c}°C, ${w.wind_kph} kph wind`);
      if (w.weather.toLowerCase().match(/rain|drizzle|shower|t-storm/)) setSurface("wet");
    } catch (e: any) {
      toast.error(e?.message ?? "Weather fetch failed");
    }
  };

  const classification = useMemo(() => classify(snaps), [snaps]);
  const last = snaps[snaps.length - 1] ?? null;
  const recos = useMemo(() => recommendations(classification, last), [classification, last]);
  const Meta = STATE_META[classification.state];

  const displayPsi = (psi: number | null) =>
    psi == null ? "—" : (system === "imperial" ? psi : toDisplayPressure(psi)).toFixed(1);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
            <CloudRain className="w-3 h-3" /> Live engineer
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Track Evolution</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Log a quick snapshot every few laps — temp, hot pressure, driver grip feel. The system classifies
            the track state and pushes setup / pressure / balance calls like a pit-wall engineer.
          </p>
        </div>
      </div>

      {/* ============== HERO STATE ============== */}
      <div className={`mt-6 rounded-lg border bg-card p-5 shadow-card ${classification.state === "overheating" ? "border-destructive/50" : "border-primary/30"}`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Meta.icon className={`w-8 h-8 ${Meta.tone}`} />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Current state</div>
              <div className={`font-display text-3xl font-bold ${Meta.tone}`}>{Meta.label}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center min-w-[300px]">
            <Stat label="Track" value={last ? `${last.track}°${tempUnit.replace("°","")}` : "—"} />
            <Stat label="Air" value={last ? `${last.air}°${tempUnit.replace("°","")}` : "—"} />
            <Stat label="Trend" value={`${classification.deltaC > 0 ? "+" : ""}${classification.deltaC}°`} tone={classification.trend === "warming" ? "text-chart-3" : classification.trend === "cooling" ? "text-chart-2" : "text-muted-foreground"} />
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{Meta.blurb}</p>
      </div>

      <div className="mt-4 grid lg:grid-cols-3 gap-3">
        {/* ============== LOG PANEL ============== */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-card lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> Log snapshot
            </h2>
            <Button variant="ghost" size="sm" onClick={pullWeather} className="text-xs">
              <CloudSun className="w-4 h-4 mr-1" /> Auto
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Air ({tempUnit})</Label>
              <Input className="font-mono" type="number" value={air} onChange={(e) => setAir(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Track ({tempUnit})</Label>
              <Input className="font-mono" type="number" value={track} onChange={(e) => setTrack(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hot avg ({pressureUnit})</Label>
              <Input className="font-mono" type="number" step="0.1" value={hotAvg} onChange={(e) => setHotAvg(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Laps this run</Label>
              <Input className="font-mono" type="number" value={laps} onChange={(e) => setLaps(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Surface</Label>
            <Select value={surface} onValueChange={(v) => setSurface(v as Snap["surface"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dry">Dry</SelectItem>
                <SelectItem value="damp">Damp / drying</SelectItem>
                <SelectItem value="wet">Wet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Driver grip feel</Label>
              <span className="font-mono text-xs text-primary">{grip}/10</span>
            </div>
            <Slider min={1} max={10} step={1} value={[grip]} onValueChange={(v) => setGrip(v[0])} />
          </div>

          <div>
            <Label className="text-xs">Note</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. T7 going greasy on exit" />
          </div>

          <Button onClick={addSnap} className="w-full">
            <Plus className="w-4 h-4 mr-2" /> Add snapshot
          </Button>
        </div>

        {/* ============== RECOMMENDATIONS ============== */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-card lg:col-span-2">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" /> Engineering calls
          </h2>
          {recos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Log a snapshot to receive setup, pressure and balance calls.</p>
          ) : (
            <ul className="space-y-2">
              {recos.map((r, i) => (
                <li key={i} className="rounded-md border border-border bg-background/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CategoryIcon cat={r.category} />
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{r.category}</div>
                        <PriorityBadge p={r.priority} />
                      </div>
                      <div className="font-display font-bold mt-1">{r.change}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{r.reason}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ============== TIMELINE ============== */}
      <div className="mt-4 rounded-lg border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Session timeline
          </h2>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {snaps.length} snap{snaps.length === 1 ? "" : "s"}
          </div>
        </div>
        {snaps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No snapshots yet. Log your first reading above.</p>
        ) : (
          <>
            <TrendChart snaps={snaps} />
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Min</th>
                    <th className="py-2 pr-3">Air</th>
                    <th className="py-2 pr-3">Track</th>
                    <th className="py-2 pr-3">Hot psi</th>
                    <th className="py-2 pr-3">Grip</th>
                    <th className="py-2 pr-3">Surface</th>
                    <th className="py-2 pr-3">Laps</th>
                    <th className="py-2 pr-3">Note</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  {snaps.map((s) => (
                    <tr key={s.id} className="border-b border-border/50">
                      <td className="py-2 pr-3">{s.minute}</td>
                      <td className="py-2 pr-3">{s.air}°</td>
                      <td className="py-2 pr-3">{s.track}°</td>
                      <td className="py-2 pr-3">{displayPsi(s.hotAvg)}</td>
                      <td className="py-2 pr-3">{s.grip}</td>
                      <td className="py-2 pr-3">{s.surface}</td>
                      <td className="py-2 pr-3">{s.laps}</td>
                      <td className="py-2 pr-3 max-w-[260px] truncate">{s.note || "—"}</td>
                      <td className="py-2">
                        <Button size="sm" variant="ghost" onClick={() => removeSnap(s.id)} aria-label="Remove">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ============== REFERENCE ============== */}
      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(STATE_META) as State[]).map((k) => {
          const M = STATE_META[k];
          const active = classification.state === k;
          return (
            <div key={k} className={`rounded-md border p-3 ${active ? "border-primary/60 bg-primary/5" : "border-border bg-card/50"}`}>
              <div className="flex items-center gap-2">
                <M.icon className={`w-4 h-4 ${M.tone}`} />
                <div className={`font-display font-bold text-sm ${active ? M.tone : ""}`}>{M.label}</div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{M.blurb}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-mono text-xl font-bold ${tone ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}

function PriorityBadge({ p }: { p: "high" | "medium" | "low" }) {
  const cls = p === "high" ? "border-destructive/50 text-destructive" : p === "medium" ? "border-primary/40 text-primary" : "border-border text-muted-foreground";
  return <span className={`ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest border ${cls}`}>{p}</span>;
}

function CategoryIcon({ cat }: { cat: Reco["category"] }) {
  const I = cat === "Setup" ? Gauge : cat === "Pressures" ? Disc : cat === "Balance" ? Activity : AlertTriangle;
  return <I className="w-3.5 h-3.5 text-primary" />;
}

function TrendChart({ snaps }: { snaps: Snap[] }) {
  const W = 600, H = 140, P = 28;
  const xs = snaps.map((s) => s.minute);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, minX + 1);
  const allT = snaps.flatMap((s) => [s.air, s.track]);
  const minY = Math.min(...allT) - 2;
  const maxY = Math.max(...allT) + 2;
  const sx = (x: number) => P + ((x - minX) / Math.max(1, maxX - minX)) * (W - 2 * P);
  const sy = (y: number) => H - P - ((y - minY) / Math.max(1, maxY - minY)) * (H - 2 * P);
  const path = (key: "air" | "track") =>
    snaps.map((s, i) => `${i === 0 ? "M" : "L"} ${sx(s.minute)} ${sy(s[key])}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[160px]">
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="hsl(var(--border))" />
      <line x1={P} y1={P} x2={P} y2={H - P} stroke="hsl(var(--border))" />
      <path d={path("track")} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
      <path d={path("air")} fill="none" stroke="hsl(var(--chart-2))" strokeWidth={2} strokeDasharray="4 3" />
      {snaps.map((s) => (
        <circle key={s.id} cx={sx(s.minute)} cy={sy(s.track)} r={3} fill="hsl(var(--primary))" />
      ))}
      <text x={W - P} y={P - 4} textAnchor="end" className="font-mono" fontSize="9" fill="hsl(var(--muted-foreground))">
        track (solid) · air (dashed) · °C vs min
      </text>
    </svg>
  );
}