import { createFileRoute, Link } from "@tanstack/react-router";
import { GuidedTour } from "@/components/guided-tour";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookMarked, Pin, Trophy, Gauge, Cloud, Flame, Shield, Zap, Wand2, Search, Star } from "lucide-react";
import { formatLapTime } from "@/lib/lap-time";
import { SetupWorkspaceNav } from "@/components/setup-workspace-nav";

export const Route = createFileRoute("/_authenticated/setup-library")({
  component: SetupLibrary,
});

type PresetType =
  | "none" | "baseline" | "qualifying" | "endurance" | "wet"
  | "hot_weather" | "conservative" | "aggressive_rotation";

export const PRESET_TYPES: { value: PresetType; label: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { value: "baseline",             label: "Baseline",             icon: Wand2,  tone: "bg-muted text-foreground" },
  { value: "qualifying",           label: "Qualifying",           icon: Trophy, tone: "bg-primary/15 text-primary" },
  { value: "endurance",            label: "Endurance",            icon: Gauge,  tone: "bg-blue-500/15 text-blue-400" },
  { value: "wet",                  label: "Wet",                  icon: Cloud,  tone: "bg-cyan-500/15 text-cyan-400" },
  { value: "hot_weather",          label: "Hot weather",          icon: Flame,  tone: "bg-orange-500/15 text-orange-400" },
  { value: "conservative",         label: "Conservative",         icon: Shield, tone: "bg-emerald-500/15 text-emerald-400" },
  { value: "aggressive_rotation",  label: "Aggressive rotation",  icon: Zap,    tone: "bg-pink-500/15 text-pink-400" },
];

export const presetMeta = (v: string) =>
  PRESET_TYPES.find((p) => p.value === v) ?? null;

type SetupRow = {
  id: string; name: string; track: string | null; conditions: string | null;
  discipline: string; car_id: string; updated_at: string;
  preset_type: string; ideal_conditions: string | null; is_baseline: boolean;
};
type Car = { id: string; name: string };

function SetupLibrary() {
  const { user } = useAuth();
  const [carId, setCarId] = useState<string>("all");
  const [preset, setPreset] = useState<string>("all");
  const [search, setSearch] = useState("");

  const carsQ = useQuery({
    queryKey: ["cars-mini", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id,name").order("created_at");
      if (error) throw error;
      return data as Car[];
    },
    enabled: !!user,
  });

  const setupsQ = useQuery({
    queryKey: ["setup-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setups")
        .select("id,name,track,conditions,discipline,car_id,updated_at,preset_type,ideal_conditions,is_baseline")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as SetupRow[];
    },
  });

  // Stats: best lap per setup + avg confidence
  const lapsQ = useQuery({
    queryKey: ["setup-library-laps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("laps").select("setup_id,lap_time_ms");
      if (error) throw error;
      return data as { setup_id: string; lap_time_ms: number }[];
    },
  });
  const confQ = useQuery({
    queryKey: ["setup-library-conf"],
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_confidence").select("setup_id,overall");
      if (error) throw error;
      return data as { setup_id: string | null; overall: number }[];
    },
  });
  const tyreQ = useQuery({
    queryKey: ["setup-library-tyre"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tire_logs").select("setup_id,compound,hot_fl,hot_fr,hot_rl,hot_rr");
      if (error) throw error;
      return data as { setup_id: string | null; compound: string | null; hot_fl: number | null; hot_fr: number | null; hot_rl: number | null; hot_rr: number | null }[];
    },
  });

  const stats = useMemo(() => {
    const m = new Map<string, { bestMs: number | null; avgConf: number | null; tyreNote: string | null }>();
    const laps = lapsQ.data ?? [];
    const confs = confQ.data ?? [];
    const tyres = tyreQ.data ?? [];
    const byBest = new Map<string, number>();
    for (const l of laps) {
      if (!l.setup_id || !l.lap_time_ms) continue;
      const cur = byBest.get(l.setup_id);
      if (cur == null || l.lap_time_ms < cur) byBest.set(l.setup_id, l.lap_time_ms);
    }
    const byConf = new Map<string, number[]>();
    for (const c of confs) {
      if (!c.setup_id || c.overall == null) continue;
      const arr = byConf.get(c.setup_id) ?? [];
      arr.push(c.overall); byConf.set(c.setup_id, arr);
    }
    const byTyre = new Map<string, { compound?: string; hotMax: number }>();
    for (const t of tyres) {
      if (!t.setup_id) continue;
      const hots = [t.hot_fl, t.hot_fr, t.hot_rl, t.hot_rr].filter((x): x is number => x != null);
      const hotMax = hots.length ? Math.max(...hots) : 0;
      const prev = byTyre.get(t.setup_id);
      if (!prev || hotMax > prev.hotMax) byTyre.set(t.setup_id, { compound: t.compound ?? prev?.compound, hotMax });
    }
    const allIds = new Set<string>([...byBest.keys(), ...byConf.keys(), ...byTyre.keys()]);
    for (const id of allIds) {
      const confArr = byConf.get(id) ?? [];
      const avg = confArr.length ? confArr.reduce((a, b) => a + b, 0) / confArr.length : null;
      const ty = byTyre.get(id);
      const tyreNote = ty
        ? `${ty.compound ?? "tyre"} · peak ${ty.hotMax ? Math.round(ty.hotMax) + "psi" : "—"}`
        : null;
      m.set(id, { bestMs: byBest.get(id) ?? null, avgConf: avg, tyreNote });
    }
    return m;
  }, [lapsQ.data, confQ.data, tyreQ.data]);

  const filtered = useMemo(() => {
    const list = (setupsQ.data ?? []).filter((s) => {
      if (carId !== "all" && s.car_id !== carId) return false;
      if (preset === "presets" && (s.preset_type === "none" && !s.is_baseline)) return false;
      if (preset !== "all" && preset !== "presets" && s.preset_type !== preset) return false;
      if (search) {
        const q = search.toLowerCase();
        if (![s.name, s.track ?? "", s.conditions ?? "", s.ideal_conditions ?? ""].some((x) => x.toLowerCase().includes(q))) return false;
      }
      return true;
    });
    // baselines pinned first
    return list.sort((a, b) => Number(b.is_baseline) - Number(a.is_baseline));
  }, [setupsQ.data, carId, preset, search]);

  // Grouped by preset for the overview
  const grouped = useMemo(() => {
    const groups = new Map<string, SetupRow[]>();
    for (const s of filtered) {
      const key = s.preset_type === "none" && s.is_baseline ? "baseline" : s.preset_type;
      const k = key === "none" ? "uncategorised" : key;
      const arr = groups.get(k) ?? []; arr.push(s); groups.set(k, arr);
    }
    return groups;
  }, [filtered]);

  const carName = (id: string) => carsQ.data?.find((c) => c.id === id)?.name ?? "—";

  return (
    <div>
      <GuidedTour tourKey="setup" />
      <SetupWorkspaceNav />
      <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
        <BookMarked className="w-3 h-3" /> Setup library
      </div>
      <h1 className="font-display text-4xl font-bold mt-1">Engineering setup library</h1>
      <p className="text-muted-foreground text-sm mt-1">
        Your saved setup philosophies — qualifying, endurance, wet, hot, conservative, aggressive rotation — with best laps, tyre behaviour and driver confidence pulled from every session that used them.
      </p>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex-1 min-w-[180px]">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Search</div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, track, conditions…" className="pl-8" />
          </div>
        </div>
        <div className="min-w-[160px]">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Car</div>
          <Select value={carId} onValueChange={setCarId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cars</SelectItem>
              {(carsQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Type</div>
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All setups</SelectItem>
              <SelectItem value="presets">Tagged presets only</SelectItem>
              {PRESET_TYPES.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          <BookMarked className="w-8 h-8 mx-auto mb-3 opacity-60" />
          No setups match. Tag your existing setups (Qualifying, Wet, Endurance…) from the setup detail page to build your library.
        </div>
      )}

      {/* Groups */}
      <div className="mt-6 space-y-6">
        {[...grouped.entries()].map(([key, items]) => {
          const meta = presetMeta(key);
          const Icon = meta?.icon ?? BookMarked;
          return (
            <section key={key}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-primary" />
                <h2 className="font-display text-lg font-bold uppercase tracking-wider">
                  {meta?.label ?? "Uncategorised"}
                </h2>
                <span className="text-xs font-mono text-muted-foreground">· {items.length}</span>
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {items.map((s) => {
                  const st = stats.get(s.id);
                  const m = presetMeta(s.preset_type);
                  return (
                    <Link
                      key={s.id}
                      to="/setups/$setupId"
                      params={{ setupId: s.id }}
                      className="block rounded-lg border border-border bg-card p-4 hover:border-primary/60 shadow-card transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {s.is_baseline && <Pin className="w-3.5 h-3.5 text-primary" />}
                            <div className="font-display font-bold truncate">{s.name}</div>
                          </div>
                          <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground truncate">
                            {carName(s.car_id)} · {s.track || "no track"}
                          </div>
                        </div>
                        {m && (
                          <Badge variant="outline" className={`text-[10px] font-mono ${m.tone} border-transparent shrink-0`}>
                            {m.label}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <Stat
                          label="Best lap"
                          value={st?.bestMs ? formatLapTime(st.bestMs) : "—"}
                        />
                        <Stat
                          label="Confidence"
                          value={st?.avgConf != null ? `${st.avgConf.toFixed(1)}/10` : "—"}
                          icon={st?.avgConf != null ? <Star className="w-3 h-3 inline -mt-0.5 mr-0.5 text-primary" /> : null}
                        />
                        <Stat
                          label="Tyres"
                          value={st?.tyreNote ?? "—"}
                        />
                      </div>

                      {s.ideal_conditions && (
                        <div className="mt-3 text-xs text-muted-foreground border-l-2 border-primary/40 pl-2 italic line-clamp-2">
                          Ideal: {s.ideal_conditions}
                        </div>
                      )}
                      {s.conditions && !s.ideal_conditions && (
                        <div className="mt-3 text-xs text-muted-foreground truncate">
                          {s.conditions}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-8 text-xs text-muted-foreground">
        Tip: tag any setup from its detail page using the <strong>Library</strong> panel to make it appear here.
      </div>
      <div className="mt-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/baseline"><Wand2 className="w-4 h-4 mr-1" /> Generate new baseline</Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-sm font-bold truncate">{icon}{value}</div>
    </div>
  );
}
