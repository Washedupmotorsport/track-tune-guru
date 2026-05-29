import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ClipboardList, Plus, Trash2, Tag, Pencil, X, Save, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { SetupWorkspaceNav } from "@/components/setup-workspace-nav";

export const Route = createFileRoute("/_authenticated/notes")({
  component: NotesPage,
});

type Car = { id: string; name: string };
type Setup = { id: string; name: string; car_id: string };
type Session = { id: string; name: string; car_id: string; started_at: string; track: string | null };
type Note = {
  id: string;
  user_id: string;
  car_id: string | null;
  setup_id: string | null;
  session_id: string | null;
  corner: string | null;
  phase: string | null;
  severity: string;
  category: string;
  title: string;
  body: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

const CATEGORIES = ["handling", "tyres", "brakes", "aero", "powertrain", "electronics", "driver", "strategy", "reliability"] as const;
const PHASES = ["entry", "mid-corner", "exit", "braking", "turn-in", "traction", "straight", "kerbs"] as const;
const SEVERITIES = [
  { value: "info", label: "Info", tone: "bg-muted text-muted-foreground" },
  { value: "low", label: "Low", tone: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  { value: "medium", label: "Medium", tone: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  { value: "high", label: "High", tone: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  { value: "critical", label: "Critical", tone: "bg-red-500/25 text-red-300 border-red-500/50" },
] as const;

const severityTone = (s: string) => SEVERITIES.find((x) => x.value === s)?.tone ?? "bg-muted";

function NotesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [filterCar, setFilterCar] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);
  const [creating, setCreating] = useState(false);

  const carsQ = useQuery({
    queryKey: ["cars", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id, name").order("created_at");
      if (error) throw error;
      return data as Car[];
    },
    enabled: !!user,
  });

  const setupsQ = useQuery({
    queryKey: ["setups-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("setups").select("id, name, car_id").order("created_at");
      if (error) throw error;
      return data as Setup[];
    },
    enabled: !!user,
  });

  const sessionsQ = useQuery({
    queryKey: ["sessions-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, name, car_id, started_at, track")
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Session[];
    },
    enabled: !!user,
  });

  const notesQ = useQuery({
    queryKey: ["driver_notes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_notes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
    enabled: !!user,
  });

  const carName = (id: string | null) => carsQ.data?.find((c) => c.id === id)?.name;
  const setupName = (id: string | null) => setupsQ.data?.find((s) => s.id === id)?.name;
  const sessionLabel = (id: string | null) => {
    const s = sessionsQ.data?.find((x) => x.id === id);
    if (!s) return null;
    const d = new Date(s.started_at).toLocaleDateString();
    return `${s.name} · ${s.track ?? "—"} · ${d}`;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (notesQ.data ?? []).filter((n) => {
      if (filterCar !== "all" && n.car_id !== filterCar) return false;
      if (filterSeverity !== "all" && n.severity !== filterSeverity) return false;
      if (filterCategory !== "all" && n.category !== filterCategory) return false;
      if (!q) return true;
      return [n.title, n.body, n.corner, n.phase, n.category, ...(n.tags ?? [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [notesQ.data, filterCar, filterSeverity, filterCategory, search]);

  const stats = useMemo(() => {
    const all = notesQ.data ?? [];
    const open = all.filter((n) => n.severity === "high" || n.severity === "critical").length;
    const cornerCounts = new Map<string, number>();
    all.forEach((n) => {
      if (n.corner) cornerCounts.set(n.corner, (cornerCounts.get(n.corner) ?? 0) + 1);
    });
    const recurring = [...cornerCounts.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return { total: all.length, open, recurring };
  }, [notesQ.data]);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("driver_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver_notes"] });
      toast.success("Entry deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <SetupWorkspaceNav />
      <Link to="/engineer" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to cockpit
      </Link>

      <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
            <ClipboardList className="w-3 h-3" /> Engineering Log
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Engineering log</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Structured engineering entries — anchored to session, setup, corner and phase. Every entry feeds the engineering memory.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setCreating(true); }}>
          <Plus className="w-4 h-4 mr-1" /> New entry
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Total entries</div>
          <div className="font-display text-2xl font-bold mt-1">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Open flags</div>
          <div className="font-display text-2xl font-bold mt-1 flex items-center gap-1">
            {stats.open > 0 && <AlertTriangle className="w-4 h-4 text-orange-400" />}
            {stats.open}
          </div>
        </div>
        <div className="md:col-span-2 rounded-lg border border-border bg-card p-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Recurring corners</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {stats.recurring.length === 0
              ? <span className="text-xs text-muted-foreground">No recurring issues yet.</span>
              : stats.recurring.map(([c, n]) => (
                  <Badge key={c} variant="outline" className="font-mono text-[10px]">
                    {c} ×{n}
                  </Badge>
                ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-2">
        <div className="md:col-span-5 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8"
            placeholder="Search title, body, corner, tag…" />
        </div>
        <Select value={filterCar} onValueChange={setFilterCar}>
          <SelectTrigger className="md:col-span-3"><SelectValue placeholder="Car" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cars</SelectItem>
            {carsQ.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="md:col-span-2"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="md:col-span-2"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severity</SelectItem>
            {SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {(creating || editing) && (
        <div className="mt-6">
          <EntryEditor
            note={editing}
            cars={carsQ.data ?? []}
            setups={setupsQ.data ?? []}
            sessions={sessionsQ.data ?? []}
            userId={user!.id}
            onDone={() => { setCreating(false); setEditing(null); qc.invalidateQueries({ queryKey: ["driver_notes"] }); }}
            onCancel={() => { setCreating(false); setEditing(null); }}
          />
        </div>
      )}

      <div className="mt-6 space-y-2">
        {notesQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!notesQ.isLoading && filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <ClipboardList className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No engineering entries match these filters.</p>
          </div>
        )}
        {filtered.map((n) => (
          <article key={n.id} className="rounded-lg border border-border bg-card p-4 shadow-card">
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={"font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border " + severityTone(n.severity)}>
                    {n.severity}
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">{n.category}</Badge>
                  {n.corner && <Badge variant="secondary" className="font-mono text-[10px]">{n.corner}</Badge>}
                  {n.phase && <Badge variant="secondary" className="font-mono text-[10px]">{n.phase}</Badge>}
                </div>
                <h2 className="font-display text-base font-bold mt-1.5 truncate">{n.title}</h2>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                  <span>{new Date(n.created_at).toLocaleString()}</span>
                  {n.car_id && <span>· car: {carName(n.car_id) ?? "—"}</span>}
                  {n.setup_id && <span>· setup: {setupName(n.setup_id) ?? "—"}</span>}
                  {n.session_id && <span>· session: {sessionLabel(n.session_id) ?? "—"}</span>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => { setCreating(false); setEditing(n); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => {
                  if (confirm("Delete this entry?")) deleteMut.mutate(n.id);
                }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </header>
            {n.body && (
              <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">{n.body}</p>
            )}
            {n.tags && n.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {n.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="font-mono text-[10px]">
                    <Tag className="w-3 h-3 mr-1" /> {t}
                  </Badge>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function EntryEditor({
  note, cars, setups, sessions, userId, onDone, onCancel,
}: {
  note: Note | null;
  cars: Car[];
  setups: Setup[];
  sessions: Session[];
  userId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [carId, setCarId] = useState<string>(note?.car_id ?? "none");
  const [setupId, setSetupId] = useState<string>(note?.setup_id ?? "none");
  const [sessionId, setSessionId] = useState<string>(note?.session_id ?? "none");
  const [corner, setCorner] = useState<string>(note?.corner ?? "");
  const [phase, setPhase] = useState<string>(note?.phase ?? "none");
  const [severity, setSeverity] = useState<string>(note?.severity ?? "info");
  const [category, setCategory] = useState<string>(note?.category ?? "handling");
  const [tagsInput, setTagsInput] = useState((note?.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);

  const filteredSetups = carId !== "none" ? setups.filter((s) => s.car_id === carId) : setups;
  const filteredSessions = carId !== "none" ? sessions.filter((s) => s.car_id === carId) : sessions;

  const save = async () => {
    if (!title.trim()) {
      toast.error("Title required (e.g. 'Rear instability exit T6')");
      return;
    }
    setSaving(true);
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      title: title.trim(),
      body: body.trim() || null,
      car_id: carId === "none" ? null : carId,
      setup_id: setupId === "none" ? null : setupId,
      session_id: sessionId === "none" ? null : sessionId,
      corner: corner.trim() || null,
      phase: phase === "none" ? null : phase,
      severity,
      category,
      tags,
    };
    try {
      if (note) {
        const { error } = await supabase.from("driver_notes").update(payload).eq("id", note.id);
        if (error) throw error;
        toast.success("Entry updated");
      } else {
        const { error } = await supabase.from("driver_notes").insert({ ...payload, user_id: userId });
        if (error) throw error;
        toast.success("Entry logged");
      }
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/40 bg-card p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-bold uppercase tracking-wider">
          {note ? "Edit entry" : "New engineering entry"}
        </h2>
        <Button size="icon" variant="ghost" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Headline</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1"
            placeholder="e.g. Rear instability exit T6" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
            Format: {`{phase} {issue} {corner}`} · keep it short, searchable
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Corner ref</Label>
            <Input value={corner} onChange={(e) => setCorner(e.target.value)} className="mt-1 font-mono"
              placeholder="T3, T6, T11a" />
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Phase</Label>
            <Select value={phase} onValueChange={setPhase}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— none —</SelectItem>
                {PHASES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Car</Label>
            <Select value={carId} onValueChange={(v) => { setCarId(v); setSetupId("none"); setSessionId("none"); }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— standalone —</SelectItem>
                {cars.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Setup version</Label>
            <Select value={setupId} onValueChange={setSetupId} disabled={filteredSetups.length === 0}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— none —</SelectItem>
                {filteredSetups.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Session</Label>
            <Select value={sessionId} onValueChange={setSessionId} disabled={filteredSessions.length === 0}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— none —</SelectItem>
                {filteredSessions.slice(0, 50).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.track ?? "—"} · {new Date(s.started_at).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Observation / action</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="mt-1"
            placeholder="What the car did. What was changed. Expected vs actual. Next step." />
        </div>

        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Tags <span className="text-primary">(comma separated)</span>
          </Label>
          <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="mt-1 font-mono"
            placeholder="wet, oversteer, rear-arb, kerb-strike" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {note ? "Update entry" : "Log entry"}
          </Button>
        </div>
      </div>
    </div>
  );
}