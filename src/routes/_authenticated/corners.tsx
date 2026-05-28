import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  MapPin, Plus, TrendingUp, TrendingDown, AlertTriangle, Activity,
  Disc, Wind, Gauge, Mountain, ShieldCheck, Flame, ArrowDown, ArrowUp,
  Minus, Sparkles, Repeat, SlidersHorizontal,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/corners")({ component: CornersPage });

type Car = { id: string; name: string };
type Session = { id: string; name: string; car_id: string; started_at: string; track: string | null; setup_id: string | null };
type Setup = { id: string; name: string; car_id: string };
type Feedback = {
  id: string; car_id: string; session_id: string | null; setup_id: string | null;
  corner: string | null; category: string; phase: string | null;
  balance: string | null; severity: string; confidence: number | null;
  description: string; recommendation: string | null; tags: string[];
  recorded_at: string;
};

const FACETS = [
  { id: "entry",     label: "Entry behaviour",   phase: "entry", icon: ArrowDown },
  { id: "apex",      label: "Apex balance",      phase: "mid",   icon: Gauge },
  { id: "exit",      label: "Exit traction",     phase: "exit",  icon: ArrowUp },
  { id: "braking",   label: "Braking stability", phase: "entry", icon: Disc },
  { id: "kerb",      label: "Kerb response",     phase: "mid",   icon: Mountain },
  { id: "throttle",  label: "Throttle apply",    phase: "exit",  icon: Wind },
] as const;

const SEVERITY = ["info", "minor", "moderate", "major"] as const;
const BALANCES = ["understeer", "neutral", "oversteer"] as const;
const SEV_RANK: Record<string, number> = { info: 0, minor: 1, moderate: 2, major: 3 };

const SEV_CLASS: Record<string, string> = {
  info: "border-border bg-muted/30 text-muted-foreground",
  minor: "border-primary/40 bg-primary/10 text-primary",
  moderate: "border-accent/50 bg-accent/15 text-accent",
  major: "border-destructive/50 bg-destructive/15 text-destructive",
};

const BAL_ICON: Record<string, typeof Minus> = {
  understeer: ArrowDown,
  neutral: Minus,
  oversteer: ArrowUp,
};

function facetToCategory(facetId: string): string {
  if (facetId === "braking") return "braking";
  if (facetId === "exit" || facetId === "throttle") return "traction";
  if (facetId === "kerb") return "kerb";
  return "balance";
}

const formSchema = z.object({
  car_id: z.string().uuid({ message: "Pick a car" }),
  session_id: z.string().uuid().nullable(),
  setup_id: z.string().uuid().nullable(),
  corner: z.string().trim().min(1, "Corner required").max(40),
  facet: z.enum(["entry","apex","exit","braking","kerb","throttle"]),
  balance: z.enum(["understeer","neutral","oversteer"]).nullable(),
  severity: z.enum(["info","minor","moderate","major"]),
  confidence: z.number().int().min(1).max(10).nullable(),
  description: z.string().trim().min(3, "Add detail").max(2000),
});

function CornersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const carsQ = useQuery({
    queryKey: ["corners-cars", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id,name").order("created_at");
      if (error) throw error;
      return data as Car[];
    }, enabled: !!user,
  });

  const [carId, setCarId] = useState<string>("");
  const activeCar = carId || carsQ.data?.[0]?.id || "";

  const sessionsQ = useQuery({
    queryKey: ["corners-sessions", activeCar],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions")
        .select("id,name,car_id,started_at,track,setup_id")
        .eq("car_id", activeCar).order("started_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as Session[];
    }, enabled: !!activeCar,
  });

  const setupsQ = useQuery({
    queryKey: ["corners-setups", activeCar],
    queryFn: async () => {
      const { data, error } = await supabase.from("setups")
        .select("id,name,car_id").eq("car_id", activeCar).order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Setup[];
    }, enabled: !!activeCar,
  });

  const fbQ = useQuery({
    queryKey: ["corners-feedback", activeCar],
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_feedback")
        .select("id,car_id,session_id,setup_id,corner,category,phase,balance,severity,confidence,description,recommendation,tags,recorded_at")
        .eq("car_id", activeCar).order("recorded_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Feedback[];
    }, enabled: !!activeCar,
  });

  const [open, setOpen] = useState(false);
  const [filterCorner, setFilterCorner] = useState<string>("");

  const cornerStats = useMemo(() => {
    const rows = (fbQ.data ?? []).filter((f) => f.corner && f.corner.trim() !== "");
    const byCorner = new Map<string, Feedback[]>();
    rows.forEach((f) => {
      const key = f.corner!.trim();
      if (!byCorner.has(key)) byCorner.set(key, []);
      byCorner.get(key)!.push(f);
    });
    return Array.from(byCorner.entries()).map(([corner, entries]) => {
      const sevSum = entries.reduce((s, e) => s + (SEV_RANK[e.severity] ?? 0), 0);
      const confidences = entries.map((e) => e.confidence).filter((c): c is number => c != null);
      const avgConf = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;
      // confidence trend: first half vs second half (chronological)
      const chrono = [...entries].sort((a, b) => +new Date(a.recorded_at) - +new Date(b.recorded_at));
      const half = Math.floor(chrono.length / 2);
      const early = chrono.slice(0, half).map((e) => e.confidence).filter((c): c is number => c != null);
      const late = chrono.slice(half).map((e) => e.confidence).filter((c): c is number => c != null);
      const earlyAvg = early.length ? early.reduce((a,b)=>a+b,0)/early.length : null;
      const lateAvg = late.length ? late.reduce((a,b)=>a+b,0)/late.length : null;
      const confDelta = earlyAvg != null && lateAvg != null ? lateAvg - earlyAvg : null;
      const balCount: Record<string, number> = { understeer: 0, neutral: 0, oversteer: 0 };
      entries.forEach((e) => { if (e.balance && balCount[e.balance] != null) balCount[e.balance]++; });
      const dominantBalance = (Object.entries(balCount).sort((a,b)=>b[1]-a[1])[0]?.[1] ?? 0) > 0
        ? Object.entries(balCount).sort((a,b)=>b[1]-a[1])[0][0] : null;
      const phaseCount: Record<string, number> = { entry: 0, mid: 0, exit: 0 };
      entries.forEach((e) => { if (e.phase && phaseCount[e.phase] != null) phaseCount[e.phase]++; });
      const worstPhase = Object.entries(phaseCount).sort((a,b)=>b[1]-a[1])[0];
      const setupBuckets = new Map<string, { count: number; sev: number }>();
      entries.forEach((e) => {
        const k = e.setup_id ?? "—";
        const cur = setupBuckets.get(k) ?? { count: 0, sev: 0 };
        cur.count++; cur.sev += SEV_RANK[e.severity] ?? 0;
        setupBuckets.set(k, cur);
      });
      const setupSensitivity = Array.from(setupBuckets.entries())
        .map(([sid, v]) => ({ setup_id: sid, count: v.count, avgSev: v.count ? v.sev / v.count : 0 }))
        .sort((a, b) => b.avgSev - a.avgSev);
      return {
        corner,
        count: entries.length,
        sevScore: sevSum,
        avgConfidence: avgConf,
        confDelta,
        dominantBalance,
        worstPhase: worstPhase && worstPhase[1] > 0 ? worstPhase[0] : null,
        setupSensitivity,
        recent: chrono.slice(-5).reverse(),
      };
    }).sort((a, b) => b.sevScore - a.sevScore || b.count - a.count);
  }, [fbQ.data]);

  const repeatedIssues = useMemo(() => {
    const rows = (fbQ.data ?? []).filter((f) => f.corner);
    const sig = new Map<string, { count: number; corner: string; phase: string | null; balance: string | null; category: string; maxSev: number }>();
    rows.forEach((f) => {
      const key = `${f.corner}|${f.phase ?? "-"}|${f.balance ?? "-"}|${f.category}`;
      const cur = sig.get(key) ?? { count: 0, corner: f.corner!, phase: f.phase, balance: f.balance, category: f.category, maxSev: 0 };
      cur.count++;
      cur.maxSev = Math.max(cur.maxSev, SEV_RANK[f.severity] ?? 0);
      sig.set(key, cur);
    });
    return Array.from(sig.values())
      .filter((r) => r.count >= 2)
      .sort((a, b) => b.count - a.count || b.maxSev - a.maxSev)
      .slice(0, 10);
  }, [fbQ.data]);

  const setupNameMap = useMemo(() => {
    const m = new Map<string, string>();
    setupsQ.data?.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [setupsQ.data]);

  const selectedCorner = filterCorner
    ? cornerStats.find((c) => c.corner === filterCorner) ?? null
    : cornerStats[0] ?? null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary">Engineering · Corners</div>
          <h1 className="text-xl font-mono uppercase tracking-widest mt-1 flex items-center gap-2">
            <MapPin className="w-5 h-5" /> Corner-by-corner analysis
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Per-corner debrief data — entry, apex, exit, braking, kerbs, throttle. Track repeated issues, confidence drift, and setup sensitivity by corner.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Car</span>
            <select
              value={activeCar}
              onChange={(e) => setCarId(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm font-mono"
            >
              {(carsQ.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button
            onClick={() => setOpen(true)}
            disabled={!activeCar}
            className="h-9 inline-flex items-center gap-2 rounded-md bg-primary px-3 text-xs font-mono uppercase tracking-widest text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Log corner note
          </button>
        </div>
      </header>

      {!activeCar ? (
        <div className="border border-dashed border-border rounded-md p-8 text-center text-sm text-muted-foreground">
          Add a car in the garage to begin corner-by-corner debrief analysis.
        </div>
      ) : cornerStats.length === 0 ? (
        <div className="border border-dashed border-border rounded-md p-8 text-center">
          <Sparkles className="w-6 h-6 mx-auto text-primary mb-2" />
          <p className="text-sm text-muted-foreground">No corner-tagged feedback yet for this car.</p>
          <p className="text-xs text-muted-foreground mt-1">Log a corner-specific note to see trends and setup sensitivity here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-4 border border-border rounded-md bg-card">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" /> Corners ({cornerStats.length})
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">SEV ↓</div>
            </div>
            <ul className="divide-y divide-border max-h-[460px] overflow-auto">
              {cornerStats.map((c) => {
                const active = (selectedCorner?.corner ?? "") === c.corner;
                return (
                  <li key={c.corner}>
                    <button
                      onClick={() => setFilterCorner(c.corner)}
                      className={`w-full text-left px-3 py-2 hover:bg-muted/40 ${active ? "bg-muted/60" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm">{c.corner}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{c.count}×</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {c.dominantBalance && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                            {(() => { const I = BAL_ICON[c.dominantBalance]; return <I className="w-3 h-3" />; })()}
                            {c.dominantBalance}
                          </span>
                        )}
                        {c.worstPhase && (
                          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{c.worstPhase}</span>
                        )}
                        {c.avgConfidence != null && (
                          <span className="text-[10px] font-mono text-muted-foreground">conf {c.avgConfidence.toFixed(1)}</span>
                        )}
                        {c.confDelta != null && Math.abs(c.confDelta) >= 0.5 && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-mono ${c.confDelta > 0 ? "text-primary" : "text-destructive"}`}>
                            {c.confDelta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {c.confDelta > 0 ? "+" : ""}{c.confDelta.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="lg:col-span-8 space-y-4">
            {selectedCorner && (
              <div className="border border-border rounded-md bg-card">
                <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                  <div className="font-mono text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" /> {selectedCorner.corner}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {selectedCorner.count} entries
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
                  <Stat label="Severity score" value={String(selectedCorner.sevScore)} icon={<Flame className="w-3.5 h-3.5" />} />
                  <Stat label="Avg confidence" value={selectedCorner.avgConfidence != null ? selectedCorner.avgConfidence.toFixed(1) : "—"} icon={<ShieldCheck className="w-3.5 h-3.5" />} />
                  <Stat
                    label="Confidence trend"
                    value={selectedCorner.confDelta == null ? "—" : `${selectedCorner.confDelta > 0 ? "+" : ""}${selectedCorner.confDelta.toFixed(1)}`}
                    icon={selectedCorner.confDelta != null && selectedCorner.confDelta < 0
                      ? <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                      : <TrendingUp className="w-3.5 h-3.5 text-primary" />}
                  />
                  <Stat label="Dominant balance" value={selectedCorner.dominantBalance ?? "—"} icon={<Gauge className="w-3.5 h-3.5" />} />
                </div>

                <div className="p-3 border-t border-border">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5" /> Setup sensitivity
                  </div>
                  {selectedCorner.setupSensitivity.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No setup linkage.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {selectedCorner.setupSensitivity.slice(0, 5).map((s) => {
                        const name = s.setup_id === "—" ? "Unassigned" : (setupNameMap.get(s.setup_id) ?? "Unknown setup");
                        const pct = Math.min(100, Math.round((s.avgSev / 3) * 100));
                        return (
                          <li key={s.setup_id} className="flex items-center gap-2 text-xs font-mono">
                            <span className="w-40 truncate text-muted-foreground">{name}</span>
                            <div className="flex-1 h-1.5 rounded bg-muted overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-muted-foreground tabular-nums w-12 text-right">{s.count}× / {s.avgSev.toFixed(1)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="p-3 border-t border-border">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Recent entries</div>
                  <ul className="space-y-2">
                    {selectedCorner.recent.map((f) => (
                      <li key={f.id} className={`border rounded px-2.5 py-2 ${SEV_CLASS[f.severity] ?? ""}`}>
                        <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-widest">
                          <span>{f.category}{f.phase ? ` · ${f.phase}` : ""}{f.balance ? ` · ${f.balance}` : ""}</span>
                          <span className="opacity-70">{new Date(f.recorded_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs mt-1 text-foreground/90 whitespace-pre-wrap">{f.description}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="border border-border rounded-md bg-card">
              <div className="px-3 py-2 border-b border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Repeat className="w-3.5 h-3.5" /> Repeated issues
              </div>
              {repeatedIssues.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">No recurring patterns yet — at least two matching entries needed.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {repeatedIssues.map((r, i) => (
                    <li key={i} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                      <div className="font-mono">
                        <span className="text-foreground">{r.corner}</span>
                        <span className="text-muted-foreground"> · {r.category}{r.phase ? ` · ${r.phase}` : ""}{r.balance ? ` · ${r.balance}` : ""}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase ${SEV_CLASS[SEVERITY[r.maxSev]] ?? ""}`}>
                          {SEVERITY[r.maxSev]}
                        </span>
                        <span className="font-mono text-muted-foreground">×{r.count}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}

      {open && (
        <LogDialog
          onClose={() => setOpen(false)}
          carId={activeCar}
          sessions={sessionsQ.data ?? []}
          setups={setupsQ.data ?? []}
          userId={user!.id}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["corners-feedback", activeCar] }); setOpen(false); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-card px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="font-mono text-lg mt-0.5">{value}</div>
    </div>
  );
}

function LogDialog({
  onClose, carId, sessions, setups, userId, onSaved,
}: {
  onClose: () => void; carId: string; sessions: Session[]; setups: Setup[]; userId: string; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    car_id: carId,
    session_id: null as string | null,
    setup_id: null as string | null,
    corner: "",
    facet: "entry" as (typeof FACETS)[number]["id"],
    balance: null as (typeof BALANCES)[number] | null,
    severity: "minor" as (typeof SEVERITY)[number],
    confidence: 6 as number | null,
    description: "",
  });

  const m = useMutation({
    mutationFn: async () => {
      const parsed = formSchema.parse(form);
      const facet = FACETS.find((f) => f.id === parsed.facet)!;
      const { error } = await supabase.from("driver_feedback").insert({
        user_id: userId,
        car_id: parsed.car_id,
        session_id: parsed.session_id,
        setup_id: parsed.setup_id,
        corner: parsed.corner,
        category: facetToCategory(parsed.facet),
        phase: facet.phase,
        balance: parsed.balance,
        severity: parsed.severity,
        confidence: parsed.confidence,
        description: parsed.description,
        tags: [parsed.facet],
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Corner note logged"); onSaved(); },
    onError: (e: unknown) => {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message ?? "Invalid input"
        : e instanceof Error ? e.message : "Failed to save";
      toast.error(msg);
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center p-3" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card border border-border rounded-md shadow-xl">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="font-mono uppercase tracking-widest text-xs flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> New corner note
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">Close</button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Corner">
              <input
                value={form.corner}
                onChange={(e) => setForm((f) => ({ ...f, corner: e.target.value }))}
                placeholder="e.g. Turn 3"
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm font-mono"
              />
            </Field>
            <Field label="Facet">
              <select
                value={form.facet}
                onChange={(e) => setForm((f) => ({ ...f, facet: e.target.value as typeof f.facet }))}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm font-mono"
              >
                {FACETS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </Field>
            <Field label="Balance">
              <select
                value={form.balance ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, balance: (e.target.value || null) as typeof f.balance }))}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm font-mono"
              >
                <option value="">—</option>
                {BALANCES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Severity">
              <select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as typeof f.severity }))}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm font-mono"
              >
                {SEVERITY.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Session">
              <select
                value={form.session_id ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, session_id: e.target.value || null }))}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm font-mono"
              >
                <option value="">—</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Setup">
              <select
                value={form.setup_id ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, setup_id: e.target.value || null }))}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm font-mono"
              >
                <option value="">—</option>
                {setups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label={`Confidence ${form.confidence ?? "—"}/10`}>
            <input
              type="range" min={1} max={10} value={form.confidence ?? 5}
              onChange={(e) => setForm((f) => ({ ...f, confidence: Number(e.target.value) }))}
              className="w-full"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Turn 3 entry understeer when trail-braking past 50%"
              className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm font-mono"
            />
          </Field>
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-9 px-3 rounded-md border border-border text-xs font-mono uppercase tracking-widest">Cancel</button>
          <button
            onClick={() => m.mutate()}
            disabled={m.isPending}
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-mono uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
          >
            {m.isPending ? "Saving…" : "Save note"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}