import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, BookOpen, Plus, Trash2, Pencil, X, Save, Pin, PinOff,
  Disc, Sliders, User, AlertTriangle, CloudRain, Gauge, Archive, ArchiveRestore, Repeat,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/engineering-memory")({
  component: EngineeringMemoryPage,
});

type Car = { id: string; name: string };
type Entry = {
  id: string;
  user_id: string;
  car_id: string;
  category: Category;
  title: string;
  detail: string | null;
  tags: string[] | null;
  confidence: number;
  occurrences: number;
  last_observed_at: string;
  conditions: string | null;
  status: "active" | "archived";
  pinned: boolean;
  priority: Priority;
  session_id: string | null;
  setup_id: string | null;
  created_at: string;
  updated_at: string;
};

type Category =
  | "handling"
  | "tyre"
  | "setup_sensitivity"
  | "driver_pref"
  | "recurring_issue"
  | "weather";

type Priority = "critical" | "testing" | "monitor" | "resolved";

const PRIORITIES: { key: Priority; label: string; cls: string }[] = [
  { key: "critical", label: "Critical", cls: "border-destructive/50 bg-destructive/10 text-destructive" },
  { key: "testing",  label: "Testing",  cls: "border-accent/50 bg-accent/10 text-accent" },
  { key: "monitor",  label: "Monitor",  cls: "border-primary/40 bg-primary/10 text-primary" },
  { key: "resolved", label: "Resolved", cls: "border-border bg-muted/40 text-muted-foreground" },
];

const CATEGORIES: { key: Category; label: string; icon: typeof Disc; tone: string; hint: string }[] = [
  { key: "handling",          label: "Handling trait",     icon: Gauge,         tone: "text-primary",     hint: "e.g. Nervous over kerbs, lazy turn-in T7" },
  { key: "tyre",              label: "Tyre behaviour",     icon: Disc,          tone: "text-primary",     hint: "e.g. Rear tyres sensitive to overheating" },
  { key: "setup_sensitivity", label: "Setup sensitivity",  icon: Sliders,       tone: "text-primary",     hint: "e.g. ±0.5° front camber moves balance a lot" },
  { key: "driver_pref",       label: "Driver preference",  icon: User,          tone: "text-primary",     hint: "e.g. Prefers stable rear over rotation" },
  { key: "recurring_issue",   label: "Recurring issue",    icon: AlertTriangle, tone: "text-destructive", hint: "e.g. Brake bias drift after 10 laps" },
  { key: "weather",           label: "Weather sensitivity",icon: CloudRain,     tone: "text-primary",     hint: "e.g. Better rotation with lower fuel in cool conditions" },
];

const CAT_META = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<Category, (typeof CATEGORIES)[number]>;

function EngineeringMemoryPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [carFilter, setCarFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
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

  const entriesQ = useQuery({
    queryKey: ["engineering_memory", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineering_memory" as never)
        .select("*")
        .order("pinned", { ascending: false })
        .order("last_observed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Entry[];
    },
    enabled: !!user,
  });

  const carName = (id: string) => carsQ.data?.find((c) => c.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const list = entriesQ.data ?? [];
    const s = search.trim().toLowerCase();
    return list.filter((e) => {
      if (!showArchived && e.status === "archived") return false;
      if (showArchived && e.status !== "archived") return false;
      if (carFilter !== "all" && e.car_id !== carFilter) return false;
      if (catFilter !== "all" && e.category !== catFilter) return false;
      if (s) {
        const hay = [e.title, e.detail ?? "", (e.tags ?? []).join(" "), e.conditions ?? ""].join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [entriesQ.data, search, showArchived, carFilter, catFilter]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: 0 };
    for (const e of entriesQ.data ?? []) {
      if (e.status === "archived") continue;
      out.all++;
      out[e.category] = (out[e.category] ?? 0) + 1;
    }
    return out;
  }, [entriesQ.data]);

  const patch = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Entry> }) => {
      const { error } = await supabase.from("engineering_memory" as never).update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["engineering_memory"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("engineering_memory" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engineering_memory"] });
      toast.success("Removed from notebook");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="pb-24">
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>

      <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> Engineering notebook
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Long-term memory</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Recurring traits, sensitivities, driver preferences and lessons learned. Every entry is a piece of
            persistent engineering knowledge about this car — accumulate it across seasons.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setCreating(true); }} disabled={!(carsQ.data?.length)}>
          <Plus className="w-4 h-4 mr-1" /> New entry
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-6 rounded-lg border border-border bg-card p-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
        <Input placeholder="Search title, detail, tags…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={carFilter} onValueChange={setCarFilter}>
          <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cars</SelectItem>
            {carsQ.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={(v) => setCatFilter(v as Category | "all")}>
          <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? <ArchiveRestore className="w-4 h-4 mr-1" /> : <Archive className="w-4 h-4 mr-1" />}
          {showArchived ? "Showing archived" : "Active only"}
        </Button>
      </div>

      {/* Category quick chips */}
      <Tabs value={catFilter} onValueChange={(v) => setCatFilter(v as Category | "all")} className="mt-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All <span className="ml-2 font-mono text-[10px] opacity-70">{counts.all ?? 0}</span></TabsTrigger>
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <TabsTrigger key={c.key} value={c.key} className="gap-1">
                <Icon className="w-3.5 h-3.5" /> {c.label}
                <span className="ml-1 font-mono text-[10px] opacity-70">{counts[c.key] ?? 0}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {(creating || editing) && (
        <div className="mt-6">
          <EntryEditor
            entry={editing}
            cars={carsQ.data ?? []}
            userId={user!.id}
            defaultCarId={carFilter !== "all" ? carFilter : undefined}
            onDone={() => { setCreating(false); setEditing(null); qc.invalidateQueries({ queryKey: ["engineering_memory"] }); }}
            onCancel={() => { setCreating(false); setEditing(null); }}
          />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {entriesQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!entriesQ.isLoading && filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <BookOpen className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {showArchived ? "Nothing archived." : "Notebook is empty. Start logging what the car keeps doing."}
            </p>
            {!showArchived && (
              <p className="text-xs text-muted-foreground/80 mt-2">
                Tips: <em>“Rear tyres sensitive to overheating”</em> · <em>“Nervous over kerbs”</em> · <em>“Better rotation with lower fuel load”</em>
              </p>
            )}
          </div>
        )}
        {filtered.map((e) => {
          const meta = CAT_META[e.category] ?? CAT_META.handling;
          const Icon = meta.icon;
          return (
            <article
              key={e.id}
              className={`rounded-lg border bg-card p-5 shadow-card transition ${
                e.pinned ? "border-primary/60 ring-1 ring-primary/20" : "border-border"
              }`}
            >
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest ${meta.tone}`}>
                      <Icon className="w-3.5 h-3.5" /> {meta.label}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      · {carName(e.car_id)}
                    </span>
                    <span className={`inline-flex items-center px-1.5 h-4 rounded border font-mono text-[9px] uppercase tracking-widest ${PRIORITIES.find(p=>p.key===e.priority)?.cls ?? "border-border bg-muted/30 text-muted-foreground"}`}>
                      {e.priority ?? "monitor"}
                    </span>
                    {e.pinned && (
                      <Badge variant="outline" className="font-mono text-[9px] border-primary/50 text-primary">
                        <Pin className="w-2.5 h-2.5 mr-1" /> pinned
                      </Badge>
                    )}
                  </div>
                  <h2 className="font-display text-lg font-bold mt-1 leading-tight">{e.title}</h2>
                  <div className="mt-2 flex items-center gap-1 flex-wrap">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mr-1">Set status</span>
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => patch.mutate({ id: e.id, patch: { priority: p.key, ...(p.key === "resolved" ? { status: "archived" as const } : {}) } })}
                        className={`inline-flex items-center px-1.5 h-5 rounded border font-mono text-[9px] uppercase tracking-widest transition ${e.priority === p.key ? p.cls : "border-border bg-background/40 text-muted-foreground hover:border-primary/50"}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" title={e.pinned ? "Unpin" : "Pin"}
                    onClick={() => patch.mutate({ id: e.id, patch: { pinned: !e.pinned } })}>
                    {e.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" title="Log another occurrence"
                    onClick={() => patch.mutate({ id: e.id, patch: { occurrences: e.occurrences + 1, last_observed_at: new Date().toISOString() } })}>
                    <Repeat className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" title={e.status === "archived" ? "Restore" : "Archive"}
                    onClick={() => patch.mutate({ id: e.id, patch: { status: e.status === "archived" ? "active" : "archived" } })}>
                    {e.status === "archived" ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setCreating(false); setEditing(e); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove from notebook?")) del.mutate(e.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </header>

              {e.detail && <p className="mt-3 text-sm whitespace-pre-wrap leading-relaxed">{e.detail}</p>}

              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-mono uppercase tracking-widest">
                <Stat label="Confidence" value={"●".repeat(e.confidence) + "○".repeat(Math.max(0, 5 - e.confidence))} />
                <Stat label="Occurrences" value={String(e.occurrences)} />
                <Stat label="Last seen" value={new Date(e.last_observed_at).toLocaleDateString()} />
                <Stat label="Conditions" value={e.conditions || "—"} />
              </div>

              {e.tags && e.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {e.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="font-mono text-[10px]">{t}</Badge>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/60 bg-background/30 px-2 py-1.5">
      <div className="text-muted-foreground text-[9px]">{label}</div>
      <div className="text-foreground normal-case tracking-normal font-mono text-xs mt-0.5 truncate">{value}</div>
    </div>
  );
}

function EntryEditor({
  entry, cars, userId, defaultCarId, onDone, onCancel,
}: {
  entry: Entry | null;
  cars: Car[];
  userId: string;
  defaultCarId?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<Category>(entry?.category ?? "handling");
  const [carId, setCarId] = useState<string>(entry?.car_id ?? defaultCarId ?? cars[0]?.id ?? "");
  const [title, setTitle] = useState(entry?.title ?? "");
  const [detail, setDetail] = useState(entry?.detail ?? "");
  const [conditions, setConditions] = useState(entry?.conditions ?? "");
  const [confidence, setConfidence] = useState<number>(entry?.confidence ?? 3);
  const [tagsInput, setTagsInput] = useState((entry?.tags ?? []).join(", "));
  const [pinned, setPinned] = useState<boolean>(entry?.pinned ?? false);
  const [saving, setSaving] = useState(false);

  const meta = CAT_META[category];

  const save = async () => {
    if (!carId) { toast.error("Pick a car"); return; }
    if (!title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      car_id: carId,
      category,
      title: title.trim(),
      detail: detail.trim() || null,
      conditions: conditions.trim() || null,
      confidence: Math.max(1, Math.min(5, confidence)),
      tags,
      pinned,
    };
    try {
      if (entry) {
        const { error } = await supabase.from("engineering_memory" as never).update(payload as never).eq("id", entry.id);
        if (error) throw error;
        toast.success("Entry updated");
      } else {
        const { error } = await supabase.from("engineering_memory" as never).insert({ ...payload, user_id: userId } as never);
        if (error) throw error;
        toast.success("Logged to notebook");
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
          {entry ? "Edit entry" : "New notebook entry"}
        </h2>
        <Button size="icon" variant="ghost" onClick={onCancel}><X className="w-4 h-4" /></Button>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Category</Label>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const active = c.key === category;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  className={`flex items-start gap-2 text-left p-3 rounded-md border-[1.5px] transition ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/30 hover:border-primary/40"
                  }`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-widest">{c.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{c.hint}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Car</Label>
            <Select value={carId} onValueChange={setCarId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a car" /></SelectTrigger>
              <SelectContent>
                {cars.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Confidence — how sure are you? ({confidence}/5)
            </Label>
            <input type="range" min={1} max={5} step={1} value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="mt-3 w-full accent-primary" />
          </div>
        </div>

        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Trait / insight</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1"
            placeholder={meta.hint} />
        </div>

        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Detail</Label>
          <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={4} className="mt-1"
            placeholder="What pattern have you seen? When does it appear? What helps?" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Conditions / context
            </Label>
            <Input value={conditions} onChange={(e) => setConditions(e.target.value)} className="mt-1"
              placeholder="hot track, low fuel, soft compound…" />
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Tags <span className="text-primary">(comma separated)</span>
            </Label>
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="mt-1 font-mono"
              placeholder="rear, overheating, kerbs" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={pinned}
            onChange={(e) => setPinned(e.target.checked)} />
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Pin to top of notebook
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {entry ? "Update" : "Log it"}
          </Button>
        </div>
      </div>
    </div>
  );
}