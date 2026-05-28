import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  ClipboardList, Plus, Filter, MessageSquare, Wand2, TrendingUp,
  Wind, Disc, Gauge, Mountain, ShieldCheck, AlertTriangle, X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/debrief")({ component: DebriefPage });

type Car = { id: string; name: string };
type Session = { id: string; name: string; car_id: string; started_at: string; track: string | null };
type Setup = { id: string; name: string; car_id: string };
type Feedback = {
  id: string; car_id: string; session_id: string | null; setup_id: string | null;
  corner: string | null; category: string; phase: string | null;
  balance: string | null; severity: string; confidence: number | null;
  description: string; recommendation: string | null; tags: string[];
  recorded_at: string;
};

const CATEGORIES = [
  { id: "balance",     label: "Balance",    icon: Gauge },
  { id: "braking",     label: "Braking",    icon: Disc },
  { id: "traction",    label: "Traction",   icon: Wind },
  { id: "tyre",        label: "Tyre feel",  icon: Disc },
  { id: "kerb",        label: "Kerbs",      icon: Mountain },
  { id: "confidence",  label: "Confidence", icon: ShieldCheck },
  { id: "aero",        label: "Aero",       icon: Wind },
  { id: "other",       label: "Other",      icon: AlertTriangle },
] as const;

const SEVERITY = ["info", "minor", "moderate", "major"] as const;
const PHASES = ["entry", "mid", "exit"] as const;
const BALANCES = ["understeer", "neutral", "oversteer"] as const;

const SEV_COLOR: Record<string, string> = {
  info: "border-border bg-muted/30 text-muted-foreground",
  minor: "border-primary/40 bg-primary/10 text-primary",
  moderate: "border-accent/50 bg-accent/15 text-accent",
  major: "border-destructive/50 bg-destructive/15 text-destructive",
};

const formSchema = z.object({
  car_id: z.string().uuid({ message: "Pick a car" }),
  session_id: z.string().uuid().nullable(),
  setup_id: z.string().uuid().nullable(),
  corner: z.string().trim().max(40).nullable(),
  category: z.enum(["balance","braking","traction","tyre","kerb","confidence","aero","other"]),
  phase: z.enum(["entry","mid","exit"]).nullable(),
  balance: z.enum(["understeer","neutral","oversteer"]).nullable(),
  severity: z.enum(["info","minor","moderate","major"]),
  confidence: z.number().int().min(1).max(10).nullable(),
  description: z.string().trim().min(3, "Add detail").max(2000),
  recommendation: z.string().trim().max(2000).nullable(),
  tags: z.array(z.string().trim().min(1).max(30)).max(8),
});

function DebriefPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const carsQ = useQuery({
    queryKey: ["debrief-cars", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id,name").order("created_at");
      if (error) throw error;
      return data as Car[];
    }, enabled: !!user,
  });

  const sessionsQ = useQuery({
    queryKey: ["debrief-sessions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions")
        .select("id,name,car_id,started_at,track")
        .order("started_at", { ascending: false }).limit(40);
      if (error) throw error;
      return data as Session[];
    }, enabled: !!user,
  });

  const setupsQ = useQuery({
    queryKey: ["debrief-setups", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("setups")
        .select("id,name,car_id").order("updated_at", { ascending: false }).limit(40);
      if (error) throw error;
      return data as Setup[];
    }, enabled: !!user,
  });

  const [filter, setFilter] = useState<{ car: string; session: string; category: string }>({
    car: "all", session: "all", category: "all",
  });

  const feedbackQ = useQuery({
    queryKey: ["driver-feedback", user?.id, filter],
    queryFn: async () => {
      let q = supabase.from("driver_feedback")
        .select("id,car_id,session_id,setup_id,corner,category,phase,balance,severity,confidence,description,recommendation,tags,recorded_at")
        .order("recorded_at", { ascending: false }).limit(200);
      if (filter.car !== "all") q = q.eq("car_id", filter.car);
      if (filter.session !== "all") q = q.eq("session_id", filter.session);
      if (filter.category !== "all") q = q.eq("category", filter.category);
      const { data, error } = await q;
      if (error) throw error;
      return data as Feedback[];
    }, enabled: !!user,
  });

  const [open, setOpen] = useState(false);

  const trends = useMemo(() => {
    const items = feedbackQ.data ?? [];
    const byCat: Record<string, number> = {};
    const byBalance: Record<string, number> = {};
    const byPhase: Record<string, number> = {};
    let confSum = 0, confN = 0;
    let major = 0;
    for (const f of items) {
      byCat[f.category] = (byCat[f.category] ?? 0) + 1;
      if (f.balance) byBalance[f.balance] = (byBalance[f.balance] ?? 0) + 1;
      if (f.phase) byPhase[f.phase] = (byPhase[f.phase] ?? 0) + 1;
      if (typeof f.confidence === "number") { confSum += f.confidence; confN++; }
      if (f.severity === "major") major++;
    }
    return {
      total: items.length, major,
      avgConfidence: confN ? confSum / confN : null,
      byCat, byBalance, byPhase,
    };
  }, [feedbackQ.data]);

  const recommendations = useMemo(() => buildRecommendations(feedbackQ.data ?? []), [feedbackQ.data]);

  const cars = carsQ.data ?? [];
  const sessions = sessionsQ.data ?? [];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-mono uppercase tracking-[0.2em] text-primary text-xs">Driver debrief</h1>
          <p className="text-foreground text-xl font-semibold">Structured feedback</p>
          <p className="text-muted-foreground text-xs font-mono mt-1">
            Capture corner-by-corner notes. Convert observations into setup actions.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-md text-xs font-mono uppercase tracking-widest hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> New entry
        </button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Entries" value={String(trends.total)} icon={<ClipboardList className="w-3.5 h-3.5" />} />
        <Stat label="Avg confidence" value={trends.avgConfidence != null ? `${trends.avgConfidence.toFixed(1)} / 10` : "—"} icon={<ShieldCheck className="w-3.5 h-3.5" />} accent />
        <Stat label="Major flags" value={String(trends.major)} icon={<AlertTriangle className="w-3.5 h-3.5" />} danger={trends.major > 0} />
        <Stat label="Dominant balance" value={dominant(trends.byBalance) ?? "—"} icon={<Gauge className="w-3.5 h-3.5" />} />
      </section>

      <section className="border border-border bg-card/60 rounded-md p-3">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Filter</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select value={filter.car} onChange={(e) => setFilter((f) => ({ ...f, car: e.target.value }))}
            className="bg-muted/30 border border-border rounded px-2 py-1.5 text-xs font-mono">
            <option value="all">All cars</option>
            {cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filter.session} onChange={(e) => setFilter((f) => ({ ...f, session: e.target.value }))}
            className="bg-muted/30 border border-border rounded px-2 py-1.5 text-xs font-mono">
            <option value="all">All sessions</option>
            {sessions.filter((s) => filter.car === "all" || s.car_id === filter.car)
              .map((s) => <option key={s.id} value={s.id}>{s.name} · {new Date(s.started_at).toLocaleDateString()}</option>)}
          </select>
          <select value={filter.category} onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
            className="bg-muted/30 border border-border rounded px-2 py-1.5 text-xs font-mono">
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Feedback log</span>
            <span className="font-mono text-[10px] text-muted-foreground ml-auto">{feedbackQ.data?.length ?? 0} entries</span>
          </div>
          {(feedbackQ.data ?? []).length === 0 ? (
            <div className="border border-dashed border-border rounded-md p-8 text-center">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                No feedback yet — log the first driver comment
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {feedbackQ.data?.map((f) => (
                <FeedbackRow key={f.id} f={f} sessions={sessions} cars={cars} qc={qc} />
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Wand2 className="w-3.5 h-3.5 text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Setup actions</span>
          </div>
          <div className="border border-border bg-card/60 rounded-md p-3 space-y-2">
            {recommendations.length === 0 ? (
              <p className="font-mono text-[11px] text-muted-foreground">No actions yet. Add entries with balance + phase to generate.</p>
            ) : recommendations.map((r) => (
              <div key={r.id} className="border border-border rounded p-2 bg-muted/20">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-primary">{r.tag}</span>
                  <span className="font-mono text-[9px] text-muted-foreground">×{r.weight}</span>
                </div>
                <p className="text-xs mt-1 leading-snug">{r.text}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 px-1 pt-2">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Session trends</span>
          </div>
          <div className="border border-border bg-card/60 rounded-md p-3 space-y-2">
            <BarRow label="Categories" data={trends.byCat} />
            <BarRow label="Balance" data={trends.byBalance} />
            <BarRow label="Phase" data={trends.byPhase} />
          </div>
        </aside>
      </div>

      {open && (
        <EntryDialog
          onClose={() => setOpen(false)}
          cars={cars}
          sessions={sessions}
          setups={setupsQ.data ?? []}
          userId={user!.id}
          onSaved={() => qc.invalidateQueries({ queryKey: ["driver-feedback"] })}
        />
      )}
    </div>
  );
}

function Stat({ label, value, icon, accent, danger }: { label: string; value: string; icon: React.ReactNode; accent?: boolean; danger?: boolean }) {
  return (
    <div className="border border-border bg-card/60 rounded-md p-3">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{label}</span>
        <span className={danger ? "text-destructive" : accent ? "text-accent" : "text-primary"}>{icon}</span>
      </div>
      <div className={`mt-1 font-mono text-2xl tabular-nums ${danger ? "text-destructive" : accent ? "text-accent" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function BarRow({ label, data }: { label: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      {entries.length === 0 ? (
        <div className="font-mono text-[11px] text-muted-foreground">—</div>
      ) : (
        <ul className="space-y-1">
          {entries.map(([k, v]) => (
            <li key={k} className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-foreground w-20 truncate">{k}</span>
              <div className="flex-1 h-1.5 rounded bg-muted/40 overflow-hidden">
                <div className="h-full bg-primary/70" style={{ width: `${(v / max) * 100}%` }} />
              </div>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground w-6 text-right">{v}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FeedbackRow({ f, sessions, cars, qc }: { f: Feedback; sessions: Session[]; cars: Car[]; qc: ReturnType<typeof useQueryClient> }) {
  const cat = CATEGORIES.find((c) => c.id === f.category) ?? CATEGORIES[0];
  const Icon = cat.icon;
  const sess = sessions.find((s) => s.id === f.session_id);
  const car = cars.find((c) => c.id === f.car_id);
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("driver_feedback").delete().eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["driver-feedback"] }); toast.success("Entry removed"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <li className="border border-border bg-card/60 rounded-md p-3">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 px-2 py-1 rounded border text-[10px] font-mono uppercase tracking-widest ${SEV_COLOR[f.severity] ?? SEV_COLOR.info}`}>
          {f.severity}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-primary">
              <Icon className="w-3.5 h-3.5" /> {cat.label}
            </span>
            {f.corner && <Chip>T {f.corner}</Chip>}
            {f.phase && <Chip>{f.phase}</Chip>}
            {f.balance && <Chip>{f.balance}</Chip>}
            {typeof f.confidence === "number" && <Chip>conf {f.confidence}/10</Chip>}
            <span className="font-mono text-[10px] text-muted-foreground ml-auto">
              {new Date(f.recorded_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
            </span>
          </div>
          <p className="text-sm mt-1.5 leading-snug whitespace-pre-wrap">{f.description}</p>
          {f.recommendation && (
            <div className="mt-2 border-l-2 border-primary/60 pl-2">
              <div className="font-mono text-[9px] uppercase tracking-widest text-primary">Action</div>
              <p className="text-xs text-foreground/90 whitespace-pre-wrap">{f.recommendation}</p>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2 font-mono text-[10px] text-muted-foreground flex-wrap">
            <span>{car?.name ?? "—"}</span>
            <span className="opacity-40">·</span>
            <span>{sess?.name ?? "no session"}</span>
            {sess?.track && <><span className="opacity-40">·</span><span>{sess.track}</span></>}
            {f.tags.length > 0 && (
              <>
                <span className="opacity-40">·</span>
                {f.tags.map((t) => <span key={t} className="text-primary">#{t}</span>)}
              </>
            )}
            <button onClick={() => { if (confirm("Delete entry?")) del.mutate(); }}
              className="ml-auto text-destructive/80 hover:text-destructive">
              Delete
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-muted/30 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}

function EntryDialog({ onClose, cars, sessions, setups, userId, onSaved }: {
  onClose: () => void;
  cars: Car[]; sessions: Session[]; setups: Setup[];
  userId: string; onSaved: () => void;
}) {
  const defaultCar = cars[0]?.id ?? "";
  const [form, setForm] = useState({
    car_id: defaultCar,
    session_id: "" as string,
    setup_id: "" as string,
    corner: "",
    category: "balance" as (typeof CATEGORIES)[number]["id"],
    phase: "" as "" | (typeof PHASES)[number],
    balance: "" as "" | (typeof BALANCES)[number],
    severity: "info" as (typeof SEVERITY)[number],
    confidence: "" as string,
    description: "",
    recommendation: "",
    tagsRaw: "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const tags = form.tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        car_id: form.car_id,
        session_id: form.session_id || null,
        setup_id: form.setup_id || null,
        corner: form.corner.trim() || null,
        category: form.category,
        phase: form.phase || null,
        balance: form.balance || null,
        severity: form.severity,
        confidence: form.confidence === "" ? null : Number(form.confidence),
        description: form.description,
        recommendation: form.recommendation.trim() || null,
        tags,
      };
      const parsed = formSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
      const { error } = await supabase.from("driver_feedback").insert({ ...parsed.data, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Feedback logged"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const carSessions = sessions.filter((s) => !form.car_id || s.car_id === form.car_id);
  const carSetups = setups.filter((s) => !form.car_id || s.car_id === form.car_id);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center p-3 md:p-8" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card border border-border rounded-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <header className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">New debrief entry</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </header>

        <div className="p-4 space-y-3">
          <Row label="Car">
            <select value={form.car_id} onChange={(e) => setForm({ ...form, car_id: e.target.value, session_id: "", setup_id: "" })}
              className="bg-muted/30 border border-border rounded px-2 py-1.5 text-sm w-full">
              {cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Row>

          <div className="grid grid-cols-2 gap-2">
            <Row label="Session (optional)">
              <select value={form.session_id} onChange={(e) => setForm({ ...form, session_id: e.target.value })}
                className="bg-muted/30 border border-border rounded px-2 py-1.5 text-sm w-full">
                <option value="">—</option>
                {carSessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Row>
            <Row label="Setup (optional)">
              <select value={form.setup_id} onChange={(e) => setForm({ ...form, setup_id: e.target.value })}
                className="bg-muted/30 border border-border rounded px-2 py-1.5 text-sm w-full">
                <option value="">—</option>
                {carSetups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Row>
          </div>

          <Row label="Category">
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = form.category === c.id;
                return (
                  <button key={c.id} onClick={() => setForm({ ...form, category: c.id })}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono uppercase tracking-widest ${active ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted/20 text-muted-foreground hover:border-primary/40"}`}>
                    <Icon className="w-3 h-3" /> {c.label}
                  </button>
                );
              })}
            </div>
          </Row>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Row label="Corner / sector">
              <input value={form.corner} onChange={(e) => setForm({ ...form, corner: e.target.value })} maxLength={40}
                placeholder="e.g. T3, S2"
                className="bg-muted/30 border border-border rounded px-2 py-1.5 text-sm w-full font-mono" />
            </Row>
            <Row label="Phase">
              <select value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value as "" | (typeof PHASES)[number] })}
                className="bg-muted/30 border border-border rounded px-2 py-1.5 text-sm w-full">
                <option value="">—</option>
                {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Row>
            <Row label="Balance">
              <select value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value as "" | (typeof BALANCES)[number] })}
                className="bg-muted/30 border border-border rounded px-2 py-1.5 text-sm w-full">
                <option value="">—</option>
                {BALANCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Row>
            <Row label="Severity">
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as (typeof SEVERITY)[number] })}
                className="bg-muted/30 border border-border rounded px-2 py-1.5 text-sm w-full">
                {SEVERITY.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Row>
          </div>

          <Row label={`Confidence ${form.confidence ? `(${form.confidence}/10)` : ""}`}>
            <input type="range" min={1} max={10} step={1}
              value={form.confidence || 5}
              onChange={(e) => setForm({ ...form, confidence: e.target.value })}
              className="w-full accent-primary" />
          </Row>

          <Row label="Description">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={2000} rows={3}
              placeholder="e.g. Snap oversteer on throttle application at T7, lost rear traction over inside kerb"
              className="bg-muted/30 border border-border rounded px-2 py-1.5 text-sm w-full font-mono" />
          </Row>

          <Row label="Engineering recommendation (optional)">
            <textarea value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value })}
              maxLength={2000} rows={2}
              placeholder="e.g. Soften rear ARB 1 click, reduce diff preload"
              className="bg-muted/30 border border-border rounded px-2 py-1.5 text-sm w-full font-mono" />
          </Row>

          <Row label="Tags (comma separated)">
            <input value={form.tagsRaw} onChange={(e) => setForm({ ...form, tagsRaw: e.target.value })}
              maxLength={200}
              placeholder="qualifying, wet, cold-tyres"
              className="bg-muted/30 border border-border rounded px-2 py-1.5 text-sm w-full font-mono" />
          </Row>
        </div>

        <footer className="sticky bottom-0 bg-card border-t border-border px-4 py-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded border border-border text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-mono uppercase tracking-widest disabled:opacity-60">
            {save.isPending ? "Saving…" : "Save entry"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function dominant(map: Record<string, number>): string | null {
  const entries = Object.entries(map);
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

type Rec = { id: string; tag: string; text: string; weight: number };

function buildRecommendations(items: Feedback[]): Rec[] {
  const recs: Record<string, Rec> = {};
  function add(id: string, tag: string, text: string) {
    if (!recs[id]) recs[id] = { id, tag, text, weight: 0 };
    recs[id].weight++;
  }
  for (const f of items) {
    if (f.balance === "understeer" && f.phase === "entry") add("us-entry", "Mechanical", "Reduce front ARB or add front rebound to free entry rotation");
    if (f.balance === "understeer" && f.phase === "mid") add("us-mid", "Geometry", "Increase front camber or front toe-out for mid-corner grip");
    if (f.balance === "understeer" && f.phase === "exit") add("us-exit", "Diff", "Lower diff preload / power ramp to reduce exit push");
    if (f.balance === "oversteer" && f.phase === "entry") add("os-entry", "Brakes", "Move brake bias forward; check rear bump on trail-braking");
    if (f.balance === "oversteer" && f.phase === "mid") add("os-mid", "Mechanical", "Soften rear ARB or add rear spring; check rear ride height");
    if (f.balance === "oversteer" && f.phase === "exit") add("os-exit", "Diff", "Raise diff coast/lock or add rear wing to stabilize exit");
    if (f.category === "traction") add("trac", "Setup", "Add rear mechanical grip: softer rear ARB, more rear droop, lower psi");
    if (f.category === "braking" && f.severity !== "info") add("brk", "Brakes", "Inspect brake bias, pad temperature window and master cylinder");
    if (f.category === "kerb") add("kerb", "Damping", "Soften bump damping over kerbs; review ride height clearance");
    if (f.category === "tyre") add("tyre", "Tyres", "Cross-check hot pressures vs target window; review compound choice");
    if (typeof f.confidence === "number" && f.confidence <= 4) add("conf", "Driver", "Low-confidence run — focus next session on reference laps before changes");
  }
  return Object.values(recs).sort((a, b) => b.weight - a.weight).slice(0, 6);
}
