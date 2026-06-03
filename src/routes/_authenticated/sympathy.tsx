import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ShieldAlert, AlertTriangle, Activity, Disc, Gauge, Wind, Thermometer,
  Sparkles, MoveHorizontal, Flame, Mountain, Wrench, Plus,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/sympathy")({
  component: SympathyPage,
  head: () => ({
    meta: [
      { title: "Mechanical Sympathy — My Race Engineer" },
      { name: "description", content: "Detect tyre abuse, overheating, unstable braking, kerb strikes, and rear overworking — and generate engineering warnings to protect the car." },
    ],
  }),
});

// ------------------------------------------------------------
// Pattern model
// ------------------------------------------------------------

type Pattern =
  | "sliding"
  | "overheating"
  | "unstable-braking"
  | "kerb-strikes"
  | "rear-overwork"
  | "steering-input";

type Obs = {
  id: string;
  pattern: Pattern;
  severity: 1 | 2 | 3; // low / med / high
  laps?: number | null;
  note: string;
  recorded_at: number;
};

const PATTERN_META: Record<Pattern, { label: string; icon: typeof ShieldAlert; tone: string; hint: string }> = {
  "sliding":          { label: "Excessive sliding",     icon: MoveHorizontal, tone: "text-accent",      hint: "Tyres scrubbing across the surface — pace bleeds, temps spike." },
  "overheating":      { label: "Overheating tyres",     icon: Flame,          tone: "text-destructive", hint: "Above working window — blistering and graining risk." },
  "unstable-braking": { label: "Unstable braking",      icon: Disc,           tone: "text-destructive", hint: "Rear stepping out or platform pitching under brakes." },
  "kerb-strikes":     { label: "Aggressive kerbs",      icon: Mountain,       tone: "text-accent",      hint: "Heavy kerb hits stress dampers, upright, splitter, geometry." },
  "rear-overwork":    { label: "Rear overworked",       icon: Activity,       tone: "text-destructive", hint: "Rear axle taking more load than front — wear and heat asymmetry." },
  "steering-input":   { label: "Excessive steering",    icon: Wind,           tone: "text-accent",      hint: "Driver scrubbing front tyres with too much hand input." },
};

type Warning = {
  area: string;
  message: string;
  reason: string;
  priority: "high" | "medium" | "low";
};

// ------------------------------------------------------------
// Auto-detect signals from existing DB data
// ------------------------------------------------------------

type Feedback = {
  id: string; severity: string; phase: string | null; balance: string | null;
  category: string; corner: string | null; tags: string[]; description: string;
  recorded_at: string;
};
type TireLog = {
  id: string; hot_fl: number | null; hot_fr: number | null; hot_rl: number | null; hot_rr: number | null;
  tread_fl: number | null; tread_fr: number | null; tread_rl: number | null; tread_rr: number | null;
  track_c: number | null; recorded_at: string;
};
type Lap = { id: string; lap_time_ms: number; session_id: string | null; recorded_at: string };
type Confidence = { id: string; rear: number | null; brakes: number | null; traction: number | null };

function detectFromData(
  fb: Feedback[], tl: TireLog[], laps: Lap[], conf: Confidence[]
): { pattern: Pattern; severity: 1 | 2 | 3; evidence: string }[] {
  const out: { pattern: Pattern; severity: 1 | 2 | 3; evidence: string }[] = [];

  // ---- Tyre overheating: any corner > 35 psi hot, or front-rear asymmetry > 3 psi
  const recentTL = tl.slice(0, 5);
  for (const t of recentTL) {
    const corners = [t.hot_fl, t.hot_fr, t.hot_rl, t.hot_rr].filter((x): x is number => typeof x === "number");
    if (corners.length && Math.max(...corners) >= 35) {
      out.push({ pattern: "overheating", severity: 3, evidence: `Hot psi peak ${Math.max(...corners).toFixed(1)} on ${new Date(t.recorded_at).toLocaleDateString()}` });
      break;
    }
  }

  // ---- Rear overwork: rear hot pressures consistently 1.5+ psi above fronts, or rear tread wear >> front
  const lastTL = recentTL[0];
  if (lastTL) {
    const fAvg = avg([lastTL.hot_fl, lastTL.hot_fr]);
    const rAvg = avg([lastTL.hot_rl, lastTL.hot_rr]);
    if (fAvg != null && rAvg != null && rAvg - fAvg >= 1.5) {
      out.push({ pattern: "rear-overwork", severity: 2, evidence: `Rear hot ${rAvg.toFixed(1)} vs front ${fAvg.toFixed(1)} psi (+${(rAvg-fAvg).toFixed(1)})` });
    }
    const fTread = avg([lastTL.tread_fl, lastTL.tread_fr]);
    const rTread = avg([lastTL.tread_rl, lastTL.tread_rr]);
    if (fTread != null && rTread != null && fTread - rTread >= 1.0) {
      out.push({ pattern: "rear-overwork", severity: 3, evidence: `Rear tread ${rTread.toFixed(1)} mm vs front ${fTread.toFixed(1)} mm` });
    }
  }

  // ---- Unstable braking: feedback under "braking" phase with rear-instability tags, or low brakes confidence
  const brakeFb = fb.filter((f) => f.phase === "braking" || /brake|lock|abs/i.test(f.description));
  if (brakeFb.length >= 2) {
    out.push({ pattern: "unstable-braking", severity: brakeFb.length >= 4 ? 3 : 2, evidence: `${brakeFb.length} braking-phase notes in recent feedback` });
  }
  const brakeConf = avg(conf.slice(0, 5).map((c) => c.brakes));
  if (brakeConf != null && brakeConf <= 5) {
    out.push({ pattern: "unstable-braking", severity: 2, evidence: `Recent brake confidence avg ${brakeConf.toFixed(1)}/10` });
  }

  // ---- Sliding: traction confidence low + feedback tags mention "slide"/"oversteer"/"loose"
  const tracConf = avg(conf.slice(0, 5).map((c) => c.traction));
  const slideFb = fb.filter((f) => /slide|sliding|loose|oversteer|wheelspin/i.test(f.description));
  if (slideFb.length >= 2 || (tracConf != null && tracConf <= 5)) {
    out.push({ pattern: "sliding", severity: 2, evidence: `${slideFb.length} sliding notes${tracConf != null ? ` · traction conf ${tracConf.toFixed(1)}/10` : ""}` });
  }

  // ---- Kerb strikes: tags or description includes "kerb"/"curb"
  const kerbFb = fb.filter((f) => /kerb|curb|jump/i.test(f.description) || f.tags?.some((t) => /kerb|curb/i.test(t)));
  if (kerbFb.length >= 2) {
    out.push({ pattern: "kerb-strikes", severity: kerbFb.length >= 4 ? 3 : 2, evidence: `${kerbFb.length} kerb-related notes recently` });
  }

  // ---- Steering input: feedback mentions "scrub"/"steering"/"understeer + sliding"
  const steerFb = fb.filter((f) => /scrub|too much steering|saw[- ]?ing|correction/i.test(f.description));
  if (steerFb.length >= 2) {
    out.push({ pattern: "steering-input", severity: 2, evidence: `${steerFb.length} steering-scrub notes` });
  }

  return out;
}

function avg(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter((x): x is number => typeof x === "number" && !isNaN(x));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

// ------------------------------------------------------------
// Warning generator — pattern + severity -> engineering call
// ------------------------------------------------------------

function warningsFor(p: Pattern, sev: 1 | 2 | 3): Warning[] {
  const pri = sev === 3 ? "high" : sev === 2 ? "medium" : "low";
  switch (p) {
    case "overheating":
      return [
        { area: "Pressures", message: "Rear pressures appear too high — drop 0.5–1.0 psi cold", reason: "Hot reading sits above working window, surface is greasing up.", priority: pri },
        { area: "Cooling",   message: "Open brake ducts one notch, check fender liners", reason: "Reduce conducted heat into the tyre carcass.", priority: pri },
        { area: "Driving",   message: "Manage tyres for an extra warm-up lap before push", reason: "Let tyres shed surface heat before timed lap.", priority: "medium" },
      ];
    case "rear-overwork":
      return [
        { area: "Suspension",  message: "Rear rebound may be too stiff — soften 1 click", reason: "Rear staying loaded too long, generating heat and wear.", priority: pri },
        { area: "Aero",        message: "Add 1 step of rear wing if available", reason: "Give the rear axle more aero load relative to front.", priority: "medium" },
        { area: "Differential",message: "Reduce diff preload / power ramp 5–10%", reason: "Less locking under power = less rear scrub.", priority: pri },
      ];
    case "unstable-braking":
      return [
        { area: "Platform", message: "Front platform instability detected — stiffen front bump 1 click", reason: "Pitch under braking is loading the front unevenly.", priority: pri },
        { area: "Bias",     message: "Move brake bias 1% forward", reason: "Stabilise rear axle on initial brake application.", priority: pri },
        { area: "Suspension", message: "Check rear rebound is not packing down under load transfer", reason: "Packed rebound = rear lifts late, causing instability.", priority: "medium" },
      ];
    case "sliding":
      return [
        { area: "Pressures", message: "Check pressures vs window — likely 1.5+ psi over", reason: "Over-inflation reduces contact patch, accelerates sliding & overheating.", priority: pri },
        { area: "Geometry",  message: "Add 0.2° negative camber on loaded axle", reason: "Maintain contact patch through high-slip events.", priority: "medium" },
        { area: "Driving",   message: "Smoother steering inputs, earlier throttle application", reason: "Reduce energy input into the tyre surface.", priority: "medium" },
      ];
    case "kerb-strikes":
      return [
        { area: "Inspection", message: "Inspect dampers, tie-rods, splitter mounts before next run", reason: "Repeated kerb hits cause cumulative geometry drift and damage.", priority: pri },
        { area: "Setup",      message: "Raise ride height 2 mm if running stiff platform", reason: "Reduce floor / splitter strike on aggressive kerbs.", priority: "medium" },
        { area: "Driving",    message: "Identify which corner the kerb strike happens — avoid extra-high kerbs", reason: "One avoidable kerb saves the car all weekend.", priority: "medium" },
      ];
    case "steering-input":
      return [
        { area: "Balance",  message: "Soften front ARB / increase front grip to reduce mid-corner steering", reason: "Driver shouldn't have to add lock mid-corner.", priority: pri },
        { area: "Geometry", message: "Check toe-out is not excessive (scrubs fronts on straights)", reason: "Excess toe-out destroys front tyre temp.", priority: "medium" },
        { area: "Driving",  message: "Coach: one input per corner — set the wheel and hold", reason: "Saw-ing the wheel wrecks front tyre.", priority: "medium" },
      ];
  }
}

// ------------------------------------------------------------

function SympathyPage() {
  const { user } = useAuth();

  const fbQ = useQuery({
    queryKey: ["symp-fb", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_feedback")
        .select("id,severity,phase,balance,category,corner,tags,description,recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(80);
      return (data ?? []) as Feedback[];
    },
  });
  const tlQ = useQuery({
    queryKey: ["symp-tl", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tire_logs")
        .select("id,hot_fl,hot_fr,hot_rl,hot_rr,tread_fl,tread_fr,tread_rl,tread_rr,track_c,recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(20);
      return (data ?? []) as TireLog[];
    },
  });
  const lapsQ = useQuery({
    queryKey: ["symp-laps", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("laps")
        .select("id,lap_time_ms,session_id,recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(120);
      return (data ?? []) as Lap[];
    },
  });
  const confQ = useQuery({
    queryKey: ["symp-conf", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_confidence")
        .select("id,rear,brakes,traction")
        .order("recorded_at", { ascending: false })
        .limit(20);
      return (data ?? []) as Confidence[];
    },
  });

  const [manual, setManual] = useState<Obs[]>([]);
  const [pattern, setPattern] = useState<Pattern>("sliding");
  const [sev, setSev] = useState<number>(2);
  const [note, setNote] = useState("");
  const [laps, setLaps] = useState("");

  const addManual = () => {
    if (!note.trim()) return;
    setManual((m) => [...m, {
      id: Math.random().toString(36).slice(2, 9),
      pattern, severity: sev as 1 | 2 | 3,
      laps: laps ? parseInt(laps) : null,
      note: note.trim(),
      recorded_at: Date.now(),
    }]);
    setNote("");
  };

  const detected = useMemo(() => {
    if (!fbQ.data || !tlQ.data || !lapsQ.data || !confQ.data) return [];
    return detectFromData(fbQ.data, tlQ.data, lapsQ.data, confQ.data);
  }, [fbQ.data, tlQ.data, lapsQ.data, confQ.data]);

  // Merge manual + detected → unique patterns with max severity
  const merged = useMemo(() => {
    const map = new Map<Pattern, { severity: 1 | 2 | 3; evidence: string[] }>();
    for (const d of detected) {
      const e = map.get(d.pattern);
      map.set(d.pattern, {
        severity: Math.max(e?.severity ?? 0, d.severity) as 1 | 2 | 3,
        evidence: [...(e?.evidence ?? []), `data: ${d.evidence}`],
      });
    }
    for (const m of manual) {
      const e = map.get(m.pattern);
      map.set(m.pattern, {
        severity: Math.max(e?.severity ?? 0, m.severity) as 1 | 2 | 3,
        evidence: [...(e?.evidence ?? []), `logged: ${m.note}`],
      });
    }
    return [...map.entries()].sort((a, b) => b[1].severity - a[1].severity);
  }, [detected, manual]);

  const protectionScore = useMemo(() => {
    // 100 = perfect, drops with severity-weighted patterns
    const penalty = merged.reduce((acc, [, v]) => acc + v.severity * 12, 0);
    return Math.max(0, 100 - penalty);
  }, [merged]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Car &amp; tyre protection
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Mechanical Sympathy</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Watches feedback, tyre logs, lap data and confidence ratings for patterns of abuse — then translates them
            into engineering warnings to protect the car and tyres.
          </p>
        </div>
      </div>

      {/* HEALTH */}
      <div className="mt-6 grid sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-primary/30 bg-card p-5 shadow-card">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Protection score</div>
          <div className={`font-mono text-5xl font-bold mt-1 ${protectionScore >= 80 ? "text-primary" : protectionScore >= 60 ? "text-accent" : "text-destructive"}`}>
            {protectionScore}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {protectionScore >= 80 ? "Car & tyres being looked after." : protectionScore >= 60 ? "Some abuse detected — investigate." : "Significant abuse — act now."}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:col-span-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Active patterns</div>
          {merged.length === 0 ? (
            <div className="mt-2 text-sm text-muted-foreground">No abuse patterns detected. Log observations or run sessions to surface trends.</div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {merged.map(([p, v]) => {
                const M = PATTERN_META[p];
                return (
                  <div key={p} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 ${v.severity === 3 ? "border-destructive/60" : v.severity === 2 ? "border-primary/40" : "border-border"}`}>
                    <M.icon className={`w-3.5 h-3.5 ${M.tone}`} />
                    <span className="font-display text-sm font-bold">{M.label}</span>
                    <SevPill s={v.severity} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid lg:grid-cols-3 gap-3">
        {/* WARNINGS */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-card lg:col-span-2">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" /> Engineering warnings
          </h2>
          {merged.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to flag yet.</p>
          ) : (
            <div className="space-y-4">
              {merged.map(([p, v]) => {
                const M = PATTERN_META[p];
                const ws = warningsFor(p, v.severity);
                return (
                  <div key={p} className="rounded-md border border-border bg-background/30 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <M.icon className={`w-4 h-4 ${M.tone}`} />
                      <div className="font-display font-bold">{M.label}</div>
                      <SevPill s={v.severity} />
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">{M.hint}</div>
                    <ul className="space-y-2">
                      {ws.map((w, i) => (
                        <li key={i} className="rounded border border-border bg-card/60 p-2">
                          <div className="flex items-center gap-2">
                            <Wrench className="w-3.5 h-3.5 text-primary" />
                            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{w.area}</span>
                            <PriPill p={w.priority} />
                          </div>
                          <div className="font-display font-bold text-sm mt-1">{w.message}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{w.reason}</div>
                        </li>
                      ))}
                    </ul>
                    <details className="mt-2">
                      <summary className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer">
                        Evidence ({v.evidence.length})
                      </summary>
                      <ul className="mt-1 text-xs text-muted-foreground list-disc pl-5">
                        {v.evidence.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MANUAL LOG */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-card space-y-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Log observation
          </h2>
          <div>
            <Label className="text-xs">Pattern</Label>
            <Select value={pattern} onValueChange={(v) => setPattern(v as Pattern)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PATTERN_META) as Pattern[]).map((p) => (
                  <SelectItem key={p} value={p}>{PATTERN_META[p].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Severity</Label>
              <span className="font-mono text-xs text-primary">{sev === 3 ? "High" : sev === 2 ? "Med" : "Low"}</span>
            </div>
            <Slider min={1} max={3} step={1} value={[sev]} onValueChange={(v) => setSev(v[0])} />
          </div>
          <div>
            <Label className="text-xs">Laps observed</Label>
            <Input type="number" value={laps} onChange={(e) => setLaps(e.target.value)} className="font-mono" />
          </div>
          <div>
            <Label className="text-xs">Note</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. heavy lock-up into T1 last 3 laps" />
          </div>
          <Button onClick={addManual} className="w-full">
            <Plus className="w-4 h-4 mr-2" /> Add observation
          </Button>

          {manual.length > 0 && (
            <div className="pt-3 border-t border-border">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Logged this session</div>
              <ul className="space-y-1 text-xs">
                {manual.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-2">
                    <span><strong className="font-display">{PATTERN_META[m.pattern].label}</strong> · {m.note}</span>
                    <button onClick={() => setManual((arr) => arr.filter((x) => x.id !== m.id))} className="text-muted-foreground hover:text-destructive" aria-label="Remove">×</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* REFERENCE */}
      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(Object.keys(PATTERN_META) as Pattern[]).map((k) => {
          const M = PATTERN_META[k];
          const active = merged.find(([p]) => p === k);
          return (
            <div key={k} className={`rounded-md border p-3 ${active ? "border-primary/60 bg-primary/5" : "border-border bg-card/50"}`}>
              <div className="flex items-center gap-2">
                <M.icon className={`w-4 h-4 ${M.tone}`} />
                <div className="font-display font-bold text-sm">{M.label}</div>
                {active && <SevPill s={active[1].severity} />}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{M.hint}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SevPill({ s }: { s: 1 | 2 | 3 }) {
  const cls = s === 3 ? "border-destructive/60 text-destructive" : s === 2 ? "border-primary/40 text-primary" : "border-border text-muted-foreground";
  const lbl = s === 3 ? "High" : s === 2 ? "Med" : "Low";
  return <span className={`ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest border ${cls}`}>{lbl}</span>;
}
function PriPill({ p }: { p: "high" | "medium" | "low" }) {
  const cls = p === "high" ? "border-destructive/50 text-destructive" : p === "medium" ? "border-primary/40 text-primary" : "border-border text-muted-foreground";
  return <span className={`ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest border ${cls}`}>{p}</span>;
}