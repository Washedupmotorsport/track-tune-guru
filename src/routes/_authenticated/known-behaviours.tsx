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
import {
  ArrowLeft, Brain, Plus, Trash2, Pencil, Save, X, Pin, PinOff, Repeat,
  Archive, ArchiveRestore, Disc, Gauge, AlertTriangle, CloudRain, Sliders, MapPin, Flame,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/known-behaviours")({
  component: KnownBehavioursPage,
});

type Car = { id: string; name: string };
type Setup = { id: string; name: string; car_id: string };
type Category =
  | "handling"
  | "tyre"
  | "braking"
  | "traction"
  | "rotation"
  | "aero"
  | "weather"
  | "setup_sensitivity";

type Severity = "info" | "minor" | "major" | "critical";

type Behaviour = {
  id: string;
  user_id: string;
  car_id: string;
  title: string;
  description: string | null;
  category: Category;
  severity: Severity;
  triggers: string[];
  tags: string[];
  track: string | null;
  compound: string | null;
  weather: string | null;
  fuel_state: string | null;
  temp_min_c: number | null;
  temp_max_c: number | null;
  setup_id: string | null;
  status: "active" | "archived";
  pinned: boolean;
  occurrences: number;
  confidence: number;
  workaround: string | null;
  last_observed_at: string;
  created_at: string;
  updated_at: string;
};

const CATEGORIES: { key: Category; label: string; icon: typeof Disc; hint: string }[] = [
  { key: "handling",           label: "Handling",          icon: Gauge,         hint: "Nervous over kerbs, lazy turn-in" },
  { key: "tyre",               label: "Tyre",              icon: Disc,          hint: "Front fronts pressure-sensitive" },
  { key: "braking",            label: "Braking",           icon: AlertTriangle, hint: "Unstable under trail braking" },
  { key: "traction",           label: "Traction",          icon: Flame,         hint: "Rear traction temperature-sensitive" },
  { key: "rotation",           label: "Rotation",          icon: Repeat,        hint: "Strong rotation on low fuel" },
  { key: "aero",               label: "Aero",              icon: Sliders,       hint: "Loses front in dirty air" },
  { key: "weather",            label: "Weather",           icon: CloudRain,     hint: "Understeer in cool ambient" },
  { key: "setup_sensitivity",  label: "Setup sensitivity", icon: Sliders,       hint: "0.5° camber moves balance a lot" },
];
const CAT_META = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<Category, (typeof CATEGORIES)[number]>;

const SEVERITIES: { key: Severity; label: string; cls: string }[] = [
  { key: "info",     label: "Info",     cls: "border-border bg-muted/40 text-muted-foreground" },
  { key: "minor",    label: "Minor",    cls: "border-primary/40 bg-primary/10 text-primary" },
  { key: "major",    label: "Major",    cls: "border-accent/50 bg-accent/10 text-accent" },
  { key: "critical", label: "Critical", cls: "border-destructive/50 bg-destructive/10 text-destructive" },
];

const COMPOUNDS = ["Soft", "Medium", "Hard", "Inter", "Wet"];
const WEATHERS = ["Dry", "Damp", "Light rain", "Heavy rain", "Hot", "Cold"];
const FUEL_STATES = ["Low fuel", "Mid fuel", "Heavy fuel"];

function KnownBehavioursPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [carFilter, setCarFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Behaviour | null>(null);
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
    queryKey: ["setups-lite", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("setups").select("id, name, car_id").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Setup[];
    },
    enabled: !!user,
  });

  const listQ = useQuery({
    queryKey: ["known_behaviours", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("known_behaviours" as never)
        .select("*")
        .order("pinned", { ascending: false })
        .order("last_observed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Behaviour[];
    },
    enabled: !!user,
  });

  const carName = (id: string) => carsQ.data?.find((c) => c.id === id)?.name ?? "—";
  const setupName = (id: string | null) => (id ? setupsQ.data?.find((s) => s.id === id)?.name ?? "—" : null);

  const filtered = useMemo(() => {
    const list = listQ.data ?? [];
    const s = search.trim().toLowerCase();
    return list.filter((b) => {
      if (!showArchived && b.status === "archived") return false;
      if (showArchived && b.status !== "archived") return false;
      if (carFilter !== "all" && b.car_id !== carFilter) return false;
      if (catFilter !== "all" && b.category !== catFilter) return false;
      if (s) {
        const hay = [
          b.title, b.description ?? "", (b.tags ?? []).join(" "), (b.triggers ?? []).join(" "),
          b.track ?? "", b.compound ?? "", b.weather ?? "", b.fuel_state ?? "",
        ].join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [listQ.data, search, showArchived, carFilter, catFilter]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: 0 };
    for (const b of listQ.data ?? []) {
      if (b.status === "archived") continue;
      out.all++;
      out[b.category] = (out[b.category] ?? 0) + 1;
    }
    return out;
  }, [listQ.data]);

  const patch = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Behaviour> }) => {
      const { error } = await supabase.from("known_behaviours" as never).update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["known_behaviours"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("known_behaviours" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["known_behaviours"] });
      toast.success("Removed");
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
            <Brain className="w-3 h-3" /> Known behaviours
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Car DNA database</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Recurring car characteristics linked to setup, track, compound and weather. Build a digital
            engineering knowledge base for every car — so the next session starts with everything you've already learned.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setCreating(true); }} disabled={!(carsQ.data?.length)}>
          <Plus className="w-4 h-4 mr-1" /> New behaviour
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-6 rounded-lg border border-border bg-card p-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
        <Input placeholder="Search title, triggers, conditions…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
          {showArchived ? "Archived" : "Active"}
        </Button>
      </div>

      {/* Category chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        <CatChip active={catFilter === "all"} onClick={() => setCatFilter("all")} label="All" count={counts.all ?? 0} />
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <CatChip
              key={c.key}
              active={catFilter === c.key}
              onClick={() => setCatFilter(c.key)}
              label={c.label}
              count={counts[c.key] ?? 0}
              icon={<Icon className="w-3.5 h-3.5" />}
            />
          );
        })}
      </div>

      {(creating || editing) && (
        <div className="mt-6">
          <BehaviourEditor
            entry={editing}
            cars={carsQ.data ?? []}
            setups={setupsQ.data ?? []}
            userId={user!.id}
            defaultCarId={carFilter !== "all" ? carFilter : undefined}
            onDone={() => { setCreating(false); setEditing(null); qc.invalidateQueries({ queryKey: ["known_behaviours"] }); }}
            onCancel={() => { setCreating(false); setEditing(null); }}
          />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {listQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!listQ.isLoading && filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Brain className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {showArchived ? "Nothing archived." : "No behaviours logged yet. Capture what the car keeps doing."}
            </p>
            {!showArchived && (
              <p className="text-xs text-muted-foreground/80 mt-2">
                Examples: <em>“Nervous over kerbs”</em> · <em>“Rear traction sensitive to track temp”</em> · <em>“Strong rotation on low fuel”</em>
              </p>
            )}
          </div>
        )}
        {filtered.map((b) => {
          const meta = CAT_META[b.category] ?? CAT_META.handling;
          const Icon = meta.icon;
          const sev = SEVERITIES.find((s) => s.key === b.severity) ?? SEVERITIES[0];
          const sname = setupName(b.setup_id);
          return (
            <article
              key={b.id}
              className={`rounded-lg border bg-card p-5 shadow-card transition ${
                b.pinned ? "border-primary/60 ring-1 ring-primary/20" : "border-border"
              }`}
            >
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-primary">
                      <Icon className="w-3.5 h-3.5" /> {meta.label}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">· {carName(b.car_id)}</span>
                    <span className={`inline-flex items-center px-1.5 h-4 rounded border font-mono text-[9px] uppercase tracking-widest ${sev.cls}`}>
                      {sev.label}
                    </span>
                    {b.pinned && (
                      <Badge variant="outline" className="font-mono text-[9px] border-primary/50 text-primary">
                        <Pin className="w-2.5 h-2.5 mr-1" /> pinned
                      </Badge>
                    )}
                  </div>
                  <h2 className="font-display text-lg font-bold mt-1 leading-tight">{b.title}</h2>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" title={b.pinned ? "Unpin" : "Pin"}
                    onClick={() => patch.mutate({ id: b.id, patch: { pinned: !b.pinned } })}>
                    {b.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" title="Saw it again"
                    onClick={() => patch.mutate({ id: b.id, patch: { occurrences: b.occurrences + 1, last_observed_at: new Date().toISOString() } })}>
                    <Repeat className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" title={b.status === "archived" ? "Restore" : "Archive"}
                    onClick={() => patch.mutate({ id: b.id, patch: { status: b.status === "archived" ? "active" : "archived" } })}>
                    {b.status === "archived" ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setCreating(false); setEditing(b); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove this behaviour?")) del.mutate(b.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </header>

              {b.description && <p className="mt-3 text-sm whitespace-pre-wrap leading-relaxed">{b.description}</p>}

              {b.workaround && (
                <div className="mt-3 rounded border border-primary/30 bg-primary/5 p-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-primary">Workaround</div>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{b.workaround}</p>
                </div>
              )}

              {b.triggers && b.triggers.length > 0 && (
                <div className="mt-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Triggers</div>
                  <div className="flex flex-wrap gap-1">
                    {b.triggers.map((t) => (
                      <Badge key={t} variant="outline" className="font-mono text-[10px] border-accent/40 text-accent">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-mono uppercase tracking-widest">
                <Stat label="Track"    value={b.track || "any"}     icon={<MapPin className="w-3 h-3" />} />
                <Stat label="Compound" value={b.compound || "any"}  icon={<Disc className="w-3 h-3" />} />
                <Stat label="Weather"  value={b.weather || "any"}   icon={<CloudRain className="w-3 h-3" />} />
                <Stat label="Fuel"     value={b.fuel_state || "any"} icon={<Gauge className="w-3 h-3" />} />
                <Stat label="Temp °C"  value={tempRange(b.temp_min_c, b.temp_max_c)} />
                <Stat label="Setup"    value={sname || "any"} />
                <Stat label="Confidence" value={"●".repeat(b.confidence) + "○".repeat(Math.max(0, 5 - b.confidence))} />
                <Stat label="Seen"     value={`${b.occurrences}× · ${new Date(b.last_observed_at).toLocaleDateString()}`} />
              </div>

              {b.tags && b.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {b.tags.map((t) => (
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

function tempRange(mn: number | null, mx: number | null) {
  if (mn == null && mx == null) return "any";
  if (mn != null && mx != null) return `${mn}–${mx}`;
  if (mn != null) return `≥ ${mn}`;
  return `≤ ${mx}`;
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded border border-border/60 bg-background/30 px-2 py-1.5">
      <div className="text-muted-foreground text-[9px] flex items-center gap-1">{icon}{label}</div>
      <div className="text-foreground normal-case tracking-normal font-mono text-xs mt-0.5 truncate">{value}</div>
    </div>
  );
}

function CatChip({ active, onClick, label, count, icon }: {
  active: boolean; onClick: () => void; label: string; count: number; icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border font-mono text-[11px] uppercase tracking-widest transition active:scale-[0.97] ${
        active ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:text-primary hover:border-primary/40"
      }`}
    >
      {icon} {label}
      <span className="ml-1 opacity-70">{count}</span>
    </button>
  );
}

function BehaviourEditor({
  entry, cars, setups, userId, defaultCarId, onDone, onCancel,
}: {
  entry: Behaviour | null;
  cars: Car[];
  setups: Setup[];
  userId: string;
  defaultCarId?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [carId, setCarId] = useState<string>(entry?.car_id ?? defaultCarId ?? cars[0]?.id ?? "");
  const [category, setCategory] = useState<Category>(entry?.category ?? "handling");
  const [severity, setSeverity] = useState<Severity>(entry?.severity ?? "info");
  const [title, setTitle] = useState(entry?.title ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [workaround, setWorkaround] = useState(entry?.workaround ?? "");
  const [triggersInput, setTriggersInput] = useState((entry?.triggers ?? []).join(", "));
  const [tagsInput, setTagsInput] = useState((entry?.tags ?? []).join(", "));
  const [track, setTrack] = useState(entry?.track ?? "");
  const [compound, setCompound] = useState(entry?.compound ?? "any");
  const [weather, setWeather] = useState(entry?.weather ?? "any");
  const [fuelState, setFuelState] = useState(entry?.fuel_state ?? "any");
  const [tempMin, setTempMin] = useState<string>(entry?.temp_min_c?.toString() ?? "");
  const [tempMax, setTempMax] = useState<string>(entry?.temp_max_c?.toString() ?? "");
  const [setupId, setSetupId] = useState<string>(entry?.setup_id ?? "any");
  const [confidence, setConfidence] = useState<number>(entry?.confidence ?? 3);
  const [pinned, setPinned] = useState<boolean>(entry?.pinned ?? false);
  const [saving, setSaving] = useState(false);

  const meta = CAT_META[category];
  const carSetups = setups.filter((s) => s.car_id === carId);

  const save = async () => {
    if (!carId) { toast.error("Pick a car"); return; }
    if (!title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    const triggers = triggersInput.split(",").map((t) => t.trim()).filter(Boolean);
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      car_id: carId,
      category,
      severity,
      title: title.trim(),
      description: description.trim() || null,
      workaround: workaround.trim() || null,
      triggers,
      tags,
      track: track.trim() || null,
      compound: compound === "any" ? null : compound,
      weather: weather === "any" ? null : weather,
      fuel_state: fuelState === "any" ? null : fuelState,
      temp_min_c: tempMin ? Number(tempMin) : null,
      temp_max_c: tempMax ? Number(tempMax) : null,
      setup_id: setupId === "any" ? null : setupId,
      confidence: Math.max(1, Math.min(5, confidence)),
      pinned,
    };
    try {
      if (entry) {
        const { error } = await supabase.from("known_behaviours" as never).update(payload as never).eq("id", entry.id);
        if (error) throw error;
        toast.success("Behaviour updated");
      } else {
        const { error } = await supabase.from("known_behaviours" as never).insert({ ...payload, user_id: userId } as never);
        if (error) throw error;
        toast.success("Behaviour saved");
      }
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/40 bg-card p-5 shadow-glow">
      <div className="flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-widest text-primary">
          {entry ? "Edit behaviour" : "New behaviour"}
        </div>
        <Button size="icon" variant="ghost" onClick={onCancel}><X className="w-4 h-4" /></Button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <Label>Car</Label>
          <Select value={carId} onValueChange={setCarId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {cars.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-[10px] text-muted-foreground mt-1">e.g. {meta.hint}</div>
        </div>
      </div>

      <div className="mt-4">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Nervous over kerbs in T8" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <Label>What happens</Label>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the recurring behaviour…" />
        </div>
        <div>
          <Label>Workaround / mitigation</Label>
          <Textarea rows={3} value={workaround} onChange={(e) => setWorkaround(e.target.value)}
            placeholder="e.g. Lift bump-stop 2mm; +1 click rear comp" />
        </div>
      </div>

      <div className="mt-4">
        <Label>Triggers (comma-separated)</Label>
        <Input value={triggersInput} onChange={(e) => setTriggersInput(e.target.value)}
          placeholder="trail braking, kerb strike, low fuel, hot rears" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <Label>Severity</Label>
          <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEVERITIES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Confidence (1–5)</Label>
          <Input type="number" min={1} max={5} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} />
        </div>
        <div className="flex items-end">
          <Button type="button" variant={pinned ? "default" : "outline"} className="w-full"
            onClick={() => setPinned((v) => !v)}>
            {pinned ? <Pin className="w-4 h-4 mr-1" /> : <PinOff className="w-4 h-4 mr-1" />}
            {pinned ? "Pinned" : "Pin to top"}
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded border border-border/60 bg-background/30 p-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Conditions where it shows up</div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Track</Label>
            <Input value={track} onChange={(e) => setTrack(e.target.value)} placeholder="any · Monza · Spa…" />
          </div>
          <div>
            <Label>Compound</Label>
            <Select value={compound} onValueChange={setCompound}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {COMPOUNDS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Weather</Label>
            <Select value={weather} onValueChange={setWeather}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {WEATHERS.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fuel state</Label>
            <Select value={fuelState} onValueChange={setFuelState}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {FUEL_STATES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Temp min (°C)</Label>
            <Input type="number" value={tempMin} onChange={(e) => setTempMin(e.target.value)} placeholder="—" />
          </div>
          <div>
            <Label>Temp max (°C)</Label>
            <Input type="number" value={tempMax} onChange={(e) => setTempMax(e.target.value)} placeholder="—" />
          </div>
          <div className="md:col-span-3">
            <Label>Linked setup</Label>
            <Select value={setupId} onValueChange={setSetupId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any setup</SelectItem>
                {carSetups.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Label>Tags (comma-separated)</Label>
        <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
          placeholder="kerbs, qualifying, cold tyres" />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}><X className="w-4 h-4 mr-1" /> Cancel</Button>
        <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save behaviour"}</Button>
      </div>
    </div>
  );
}