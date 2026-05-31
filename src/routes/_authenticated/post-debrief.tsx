import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck, Plus, Save, Sparkles, Loader2, TrendingUp, TrendingDown,
  AlertTriangle, Gauge, Disc, ShieldCheck, Wrench, Trash2, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { summarizeSessionDebrief, type SessionDebriefAI } from "@/lib/session-debrief.functions";

export const Route = createFileRoute("/_authenticated/post-debrief")({
  component: PostDebriefPage,
  validateSearch: (s: Record<string, unknown>) => ({
    sessionId: typeof s.sessionId === "string" ? s.sessionId : undefined,
    carId: typeof s.carId === "string" ? s.carId : undefined,
    new: s.new === "1" || s.new === true ? true : undefined,
  }),
});

type Car = { id: string; name: string };
type Session = { id: string; name: string; car_id: string; started_at: string; track: string | null; setup_id: string | null };
type Debrief = {
  id: string; car_id: string; session_id: string | null; setup_id: string | null;
  improved: string | null; worsened: string | null; needs_work: string | null;
  confidence_issue: string | null; tyre_issue: string | null; balance_issue: string | null;
  suggested_changes: string | null; notes: string | null;
  ai_summary: SessionDebriefAI | null;
  created_at: string; updated_at: string;
};

function PostDebriefPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const [carFilter, setCarFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [seedSessionId, setSeedSessionId] = useState<string | undefined>(undefined);

  // Deep-link from a session detail page: ?sessionId=...&new=1
  useEffect(() => {
    if (search.new && search.sessionId) {
      setSeedSessionId(search.sessionId);
      setEditing(true);
      setOpenId(null);
      if (search.carId) setCarFilter(search.carId);
    }
  }, [search.new, search.sessionId, search.carId]);

  const carsQ = useQuery({
    queryKey: ["debrief-cars-pd", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id,name").order("created_at");
      if (error) throw error;
      return data as Car[];
    }, enabled: !!user,
  });

  const sessionsQ = useQuery({
    queryKey: ["debrief-sessions-pd", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions")
        .select("id,name,car_id,started_at,track,setup_id")
        .order("started_at", { ascending: false }).limit(60);
      if (error) throw error;
      return data as Session[];
    }, enabled: !!user,
  });

  const debriefsQ = useQuery({
    queryKey: ["session-debriefs", user?.id, carFilter],
    queryFn: async () => {
      let q = supabase.from("session_debriefs").select("*")
        .order("created_at", { ascending: false }).limit(50);
      if (carFilter !== "all") q = q.eq("car_id", carFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Debrief[];
    }, enabled: !!user,
  });

  const opened = useMemo(
    () => debriefsQ.data?.find((d) => d.id === openId) ?? null,
    [debriefsQ.data, openId],
  );

  // Aggregate recurring trends across all debriefs for the selected scope
  const trends = useMemo(() => {
    const items = debriefsQ.data ?? [];
    const buckets = {
      confidence: countWords(items.map((d) => d.confidence_issue)),
      tyre: countWords(items.map((d) => d.tyre_issue)),
      balance: countWords(items.map((d) => d.balance_issue)),
      worsened: countWords(items.map((d) => d.worsened)),
    };
    return buckets;
  }, [debriefsQ.data]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-mono uppercase tracking-[0.2em] text-primary text-xs">Post-session debrief</h1>
          <p className="text-foreground text-xl font-semibold">Engineering debrief workflow</p>
          <p className="text-muted-foreground text-xs font-mono mt-1">
            Six questions. Structured answers. AI-generated summary, recurring trends, prioritised next changes.
          </p>
        </div>
        <Button onClick={() => { setEditing(true); setOpenId(null); }} className="shadow-glow">
          <Plus className="w-4 h-4 mr-1" /> New debrief
        </Button>
      </header>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="min-w-[180px]">
          <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Car</Label>
          <Select value={carFilter} onValueChange={setCarFilter}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cars</SelectItem>
              {(carsQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-3">
        {/* List */}
        <section className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary px-1">
            Recent debriefs · {debriefsQ.data?.length ?? 0}
          </div>
          {(debriefsQ.data ?? []).length === 0 ? (
            <div className="border border-dashed border-border rounded-md p-6 text-center text-xs font-mono text-muted-foreground">
              No debriefs yet. After every session, run the workflow to lock in lessons.
            </div>
          ) : (
            <ul className="space-y-2">
              {debriefsQ.data!.map((d) => {
                const sess = sessionsQ.data?.find((s) => s.id === d.session_id);
                const car = carsQ.data?.find((c) => c.id === d.car_id);
                const active = openId === d.id;
                return (
                  <li key={d.id}>
                    <button
                      onClick={() => { setOpenId(d.id); setEditing(false); }}
                      className={`w-full text-left border rounded-md p-3 transition-colors ${
                        active ? "border-primary bg-primary/5" : "border-border bg-card/60 hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-display text-sm font-bold truncate">
                          {sess?.name ?? "Standalone debrief"}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1 truncate">
                        {car?.name ?? "—"} · {sess?.track ?? "no track"} · {new Date(d.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {d.ai_summary && <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-transparent">AI summary</Badge>}
                        {d.balance_issue && <Badge variant="outline" className="text-[9px]">balance</Badge>}
                        {d.tyre_issue && <Badge variant="outline" className="text-[9px]">tyre</Badge>}
                        {d.confidence_issue && <Badge variant="outline" className="text-[9px]">confidence</Badge>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Recurring trends */}
          <div className="mt-3 border border-border bg-card/60 rounded-md p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Recurring trends</span>
            </div>
            <TrendBlock label="Confidence" icon={<ShieldCheck className="w-3 h-3" />} data={trends.confidence} />
            <TrendBlock label="Tyres" icon={<Disc className="w-3 h-3" />} data={trends.tyre} />
            <TrendBlock label="Balance" icon={<Gauge className="w-3 h-3" />} data={trends.balance} />
            <TrendBlock label="Worsened" icon={<TrendingDown className="w-3 h-3" />} data={trends.worsened} />
          </div>
        </section>

        {/* Detail / editor */}
        <section className="min-w-0">
          {editing ? (
            <DebriefEditor
              userId={user!.id}
              cars={carsQ.data ?? []}
              sessions={sessionsQ.data ?? []}
              initialCarId={carFilter !== "all" ? carFilter : (carsQ.data?.[0]?.id ?? "")}
              initialSessionId={seedSessionId}
              onSaved={(id) => {
                qc.invalidateQueries({ queryKey: ["session-debriefs"] });
                setEditing(false);
                setOpenId(id);
                setSeedSessionId(undefined);
              }}
              onCancel={() => { setEditing(false); setSeedSessionId(undefined); }}
            />
          ) : opened ? (
            <DebriefDetail debrief={opened} sessions={sessionsQ.data ?? []} cars={carsQ.data ?? []} qc={qc} />
          ) : (
            <div className="border border-dashed border-border rounded-md p-10 text-center text-sm text-muted-foreground">
              Select a debrief or start a new one.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------------- Editor ---------------- */

const QUESTIONS: { key: keyof Form; label: string; placeholder: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { key: "improved",         label: "What improved?",          placeholder: "Better front end on entry, faster S1…", icon: TrendingUp,    tone: "text-emerald-400" },
  { key: "worsened",         label: "What got worse?",         placeholder: "Lost rear grip on long runs, brake fade…", icon: TrendingDown, tone: "text-destructive" },
  { key: "needs_work",       label: "What still needs work?",  placeholder: "Mid-corner rotation in slow corners…", icon: Wrench,        tone: "text-primary" },
  { key: "confidence_issue", label: "Biggest confidence issue?", placeholder: "Trail-braking into T4 — no front bite", icon: ShieldCheck,   tone: "text-accent" },
  { key: "tyre_issue",       label: "Biggest tyre issue?",     placeholder: "RR overheats after 6 laps", icon: Disc,          tone: "text-orange-400" },
  { key: "balance_issue",    label: "Biggest balance issue?",  placeholder: "Mid-corner understeer, snap on exit", icon: Gauge,         tone: "text-yellow-400" },
];

type Form = {
  improved: string; worsened: string; needs_work: string;
  confidence_issue: string; tyre_issue: string; balance_issue: string;
  suggested_changes: string; notes: string;
};
const EMPTY: Form = { improved: "", worsened: "", needs_work: "", confidence_issue: "", tyre_issue: "", balance_issue: "", suggested_changes: "", notes: "" };

function DebriefEditor({ userId, cars, sessions, initialCarId, initialSessionId, onSaved, onCancel }: {
  userId: string; cars: Car[]; sessions: Session[]; initialCarId: string; initialSessionId?: string;
  onSaved: (id: string) => void; onCancel: () => void;
}) {
  const [carId, setCarId] = useState(initialCarId);
  const [sessionId, setSessionId] = useState<string>(initialSessionId ?? "");
  const [form, setForm] = useState<Form>(EMPTY);

  useEffect(() => { if (!carId && cars[0]) setCarId(cars[0].id); }, [cars, carId]);
  // If we were deep-linked with a session, also lock the editor's car to it.
  useEffect(() => {
    if (!initialSessionId) return;
    const s = sessions.find((x) => x.id === initialSessionId);
    if (s) { setCarId(s.car_id); setSessionId(s.id); }
  }, [initialSessionId, sessions]);

  const carSessions = sessions.filter((s) => s.car_id === carId);

  const save = useMutation({
    mutationFn: async () => {
      if (!carId) throw new Error("Pick a car");
      const sess = sessions.find((s) => s.id === sessionId) ?? null;
      const payload = {
        user_id: userId,
        car_id: carId,
        session_id: sess?.id ?? null,
        setup_id: sess?.setup_id ?? null,
        ...trimAll(form),
      };
      const { data, error } = await supabase.from("session_debriefs").insert(payload).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => { toast.success("Debrief saved"); onSaved(id); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border border-border bg-card/60 rounded-md p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4 text-primary" />
        <h2 className="font-display text-lg font-bold uppercase tracking-wider">New debrief</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Car</Label>
          <Select value={carId} onValueChange={setCarId}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a car" /></SelectTrigger>
            <SelectContent>
              {cars.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Session</Label>
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Standalone (no session)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Standalone (no session)</SelectItem>
              {carSessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} · {new Date(s.started_at).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {QUESTIONS.map((q) => {
          const Icon = q.icon;
          return (
            <div key={q.key} className="space-y-1">
              <Label className="text-[11px] font-mono uppercase tracking-widest flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 ${q.tone}`} /> {q.label}
              </Label>
              <Textarea
                rows={2}
                value={form[q.key]}
                onChange={(e) => setForm((f) => ({ ...f, [q.key]: e.target.value }))}
                placeholder={q.placeholder}
              />
            </div>
          );
        })}
      </div>

      <div>
        <Label className="text-[11px] font-mono uppercase tracking-widest flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-primary" /> Engineer&apos;s suggested next changes
        </Label>
        <Textarea
          rows={3}
          value={form.suggested_changes}
          onChange={(e) => setForm((f) => ({ ...f, suggested_changes: e.target.value }))}
          placeholder="Soften rear rebound 2 clicks, drop RR cold pressure 1.5 psi…"
        />
      </div>
      <div>
        <Label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Free notes</Label>
        <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional context for this debrief" />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending || !carId} className="shadow-glow">
          {save.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Save debrief
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Detail with AI summary ---------------- */

function DebriefDetail({ debrief, sessions, cars, qc }: {
  debrief: Debrief; sessions: Session[]; cars: Car[]; qc: ReturnType<typeof useQueryClient>;
}) {
  const summarize = useServerFn(summarizeSessionDebrief);
  const [ai, setAi] = useState<SessionDebriefAI | null>(debrief.ai_summary);

  useEffect(() => { setAi(debrief.ai_summary); }, [debrief.id, debrief.ai_summary]);

  const gen = useMutation({
    mutationFn: async () => summarize({ data: { debriefId: debrief.id } }),
    onSuccess: (r) => { setAi(r); qc.invalidateQueries({ queryKey: ["session-debriefs"] }); toast.success("Summary ready"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("session_debriefs").delete().eq("id", debrief.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Debrief deleted"); qc.invalidateQueries({ queryKey: ["session-debriefs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sess = sessions.find((s) => s.id === debrief.session_id);
  const car = cars.find((c) => c.id === debrief.car_id);

  return (
    <div className="border border-border bg-card/60 rounded-md p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Debrief</div>
          <h2 className="font-display text-xl font-bold">{sess?.name ?? "Standalone"}</h2>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {car?.name} · {sess?.track ?? "no track"} · {new Date(debrief.created_at).toLocaleString()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => gen.mutate()} disabled={gen.isPending} className="shadow-glow">
            {gen.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            {ai ? "Regenerate summary" : "Generate AI summary"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this debrief?")) del.mutate(); }}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {QUESTIONS.map((q) => {
          const Icon = q.icon;
          const val = debrief[q.key as keyof Debrief] as string | null;
          return (
            <div key={q.key} className="border border-border rounded-md p-3 bg-muted/10">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest">
                <Icon className={`w-3.5 h-3.5 ${q.tone}`} /> {q.label}
              </div>
              <p className="text-sm mt-1 whitespace-pre-wrap">{val || <span className="text-muted-foreground">—</span>}</p>
            </div>
          );
        })}
      </div>

      {debrief.suggested_changes && (
        <div className="border-l-2 border-primary/60 pl-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary">Engineer&apos;s proposed changes</div>
          <p className="text-sm whitespace-pre-wrap">{debrief.suggested_changes}</p>
        </div>
      )}

      {ai && (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-display text-base font-bold uppercase tracking-wider">Engineering summary</h3>
          </div>
          {ai.summary && <p className="text-sm whitespace-pre-wrap">{ai.summary}</p>}

          {ai.recurring_trends?.length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Recurring trends</div>
              <ul className="text-sm space-y-1">
                {ai.recurring_trends.map((t, i) => (
                  <li key={i} className="flex gap-2"><TrendingUp className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /><span>{t}</span></li>
                ))}
              </ul>
            </div>
          )}

          {ai.next_changes?.length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Suggested next changes</div>
              <ul className="space-y-2">
                {ai.next_changes.map((a, i) => (
                  <li key={i} className="border border-border rounded p-2 bg-card/60">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] font-mono ${
                        a.priority === "high" ? "bg-destructive/15 text-destructive border-transparent" :
                        a.priority === "medium" ? "bg-accent/15 text-accent border-transparent" :
                        "bg-muted/40"
                      }`}>{a.priority}</Badge>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-primary">{a.area}</span>
                    </div>
                    <p className="text-sm mt-1">{a.advice}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Helpers ---------------- */

function trimAll(f: Form): Form {
  return Object.fromEntries(
    Object.entries(f).map(([k, v]) => [k, (v ?? "").trim()]),
  ) as Form;
}

function countWords(values: (string | null)[]): { word: string; count: number }[] {
  const stop = new Set(["the","and","a","an","of","to","is","in","on","at","for","with","or","it","this","that","very","still","still","more","less","but"]);
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    const words = v.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
    for (const w of words) {
      if (w.length < 4 || stop.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .filter((x) => x.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function TrendBlock({ label, icon, data }: { label: string; icon: React.ReactNode; data: { word: string; count: number }[] }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </div>
      {data.length === 0 ? (
        <div className="font-mono text-[10px] text-muted-foreground">no recurring pattern yet</div>
      ) : (
        <div className="flex gap-1 flex-wrap mt-1">
          {data.map((d) => (
            <span key={d.word} className="px-1.5 py-0.5 rounded bg-muted/40 font-mono text-[10px]">
              {d.word} <span className="text-primary">×{d.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Touch icon imports kept for tree-shaking awareness
void AlertTriangle;