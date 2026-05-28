import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, ArrowLeft, Trophy, GitCompare, TrendingUp, History } from "lucide-react";
import { formatLapTime } from "@/lib/lap-time";

export const Route = createFileRoute("/_authenticated/analysis")({ component: AnalysisPage });

type Car = { id: string; name: string };
type Setup = { id: string; name: string; car_id: string; setup_data: Record<string, string | number | null>; updated_at: string; created_at: string };
type Lap = { id: string; lap_number: number | null; lap_time_ms: number; sector_1_ms: number | null; sector_2_ms: number | null; sector_3_ms: number | null; setup_id: string };

function AnalysisPage() {
  const { user } = useAuth();
  const [carId, setCarId] = useState<string>("");
  const [setupA, setSetupA] = useState<string>("");
  const [setupB, setSetupB] = useState<string>("");

  const carsQ = useQuery({
    queryKey: ["cars-min", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id, name").order("created_at");
      if (error) throw error;
      return data as Car[];
    }, enabled: !!user,
  });

  const setupsQ = useQuery({
    queryKey: ["setups-analysis", carId],
    enabled: !!carId,
    queryFn: async () => {
      const { data, error } = await supabase.from("setups").select("id, name, car_id, setup_data, created_at, updated_at").eq("car_id", carId).order("updated_at");
      if (error) throw error;
      return data as Setup[];
    },
  });

  const lapsQ = useQuery({
    queryKey: ["laps-analysis", carId],
    enabled: !!carId,
    queryFn: async () => {
      const { data, error } = await supabase.from("laps").select("id, lap_number, lap_time_ms, sector_1_ms, sector_2_ms, sector_3_ms, setup_id").eq("car_id", carId).order("recorded_at");
      if (error) throw error;
      return data as Lap[];
    },
  });

  const laps = lapsQ.data ?? [];
  const stats = useMemo(() => {
    if (laps.length === 0) return null;
    const times = laps.map((l) => l.lap_time_ms);
    const best = Math.min(...times);
    const bestS1 = Math.min(...laps.map((l) => l.sector_1_ms ?? Infinity));
    const bestS2 = Math.min(...laps.map((l) => l.sector_2_ms ?? Infinity));
    const bestS3 = Math.min(...laps.map((l) => l.sector_3_ms ?? Infinity));
    const theoretical = (isFinite(bestS1) && isFinite(bestS2) && isFinite(bestS3)) ? bestS1 + bestS2 + bestS3 : null;
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    return { best, avg, bestS1, bestS2, bestS3, theoretical, lossToTheoretical: theoretical ? best - theoretical : null };
  }, [laps]);

  const maxTime = laps.length ? Math.max(...laps.map((l) => l.lap_time_ms)) : 0;
  const minTime = laps.length ? Math.min(...laps.map((l) => l.lap_time_ms)) : 0;

  const setupAData = setupsQ.data?.find((s) => s.id === setupA);
  const setupBData = setupsQ.data?.find((s) => s.id === setupB);
  const deltaKeys = useMemo(() => {
    if (!setupAData || !setupBData) return [];
    const keys = new Set([...Object.keys(setupAData.setup_data || {}), ...Object.keys(setupBData.setup_data || {})]);
    return Array.from(keys).filter((k) => String(setupAData.setup_data?.[k] ?? "") !== String(setupBData.setup_data?.[k] ?? ""));
  }, [setupAData, setupBData]);

  // Setup × lap time scatter
  const setups = setupsQ.data ?? [];
  const numericKeys = useMemo(() => {
    const keys = new Map<string, number>();
    for (const s of setups) {
      for (const [k, v] of Object.entries(s.setup_data || {})) {
        const n = typeof v === "number" ? v : parseFloat(String(v));
        if (!isNaN(n) && isFinite(n)) keys.set(k, (keys.get(k) ?? 0) + 1);
      }
    }
    return Array.from(keys.entries()).filter(([, c]) => c >= 2).map(([k]) => k).sort();
  }, [setups]);
  const [scatterKey, setScatterKey] = useState<string>("");

  const scatterData = useMemo(() => {
    if (!scatterKey) return [];
    return setups.map((s) => {
      const v = s.setup_data?.[scatterKey];
      const n = typeof v === "number" ? v : parseFloat(String(v));
      const sLaps = laps.filter((l) => l.setup_id === s.id);
      if (isNaN(n) || sLaps.length === 0) return null;
      const best = Math.min(...sLaps.map((l) => l.lap_time_ms));
      return { name: s.name, x: n, ms: best, count: sLaps.length };
    }).filter(Boolean) as { name: string; x: number; ms: number; count: number }[];
  }, [scatterKey, setups, laps]);

  // Setup change timeline (diff vs previous setup)
  const timeline = useMemo(() => {
    const sorted = [...setups].sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
    return sorted.map((s, i) => {
      const prev = sorted[i - 1];
      if (!prev) return { setup: s, changes: [] as { k: string; from: string; to: string }[] };
      const keys = new Set([...Object.keys(prev.setup_data || {}), ...Object.keys(s.setup_data || {})]);
      const changes: { k: string; from: string; to: string }[] = [];
      keys.forEach((k) => {
        const a = String(prev.setup_data?.[k] ?? "—");
        const b = String(s.setup_data?.[k] ?? "—");
        if (a !== b) changes.push({ k, from: a, to: b });
      });
      return { setup: s, changes };
    });
  }, [setups]);

  return (
    <div>
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>
      <div className="mt-4">
        <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Insights</div>
        <h1 className="font-display text-4xl font-bold mt-1">Analysis</h1>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-5">
        <Label>Car</Label>
        <Select value={carId} onValueChange={setCarId}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a car to analyze" /></SelectTrigger>
          <SelectContent>{(carsQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {carId && (
        <>
          {stats && (
            <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Total laps" value={String(laps.length)} />
              <Stat label="Best lap" value={formatLapTime(stats.best)} icon={<Trophy className="w-4 h-4 text-primary" />} />
              <Stat label="Theoretical best" value={stats.theoretical ? formatLapTime(stats.theoretical) : "—"} />
              <Stat label="Time on table" value={stats.lossToTheoretical ? `+${(stats.lossToTheoretical / 1000).toFixed(3)}s` : "—"} />
            </div>
          )}

          {laps.length > 0 && (
            <div className="mt-6 rounded-lg border border-border bg-card p-5">
              <h2 className="font-display text-lg font-bold uppercase tracking-wider mb-3">Lap times</h2>
              <div className="space-y-1">
                {laps.map((l, i) => {
                  const pct = maxTime > minTime ? ((maxTime - l.lap_time_ms) / (maxTime - minTime)) * 100 : 100;
                  const isBest = l.lap_time_ms === minTime;
                  return (
                    <div key={l.id} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground w-8">{i + 1}</span>
                      <div className="flex-1 h-5 bg-muted rounded overflow-hidden relative">
                        <div className={"h-full " + (isBest ? "bg-primary" : "bg-accent")} style={{ width: `${pct}%` }} />
                        <span className={"absolute inset-0 flex items-center px-2 font-mono " + (isBest ? "text-primary-foreground font-bold" : "")}>
                          {formatLapTime(l.lap_time_ms)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <GitCompare className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg font-bold uppercase tracking-wider">Setup delta</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Setup A</Label>
                <Select value={setupA} onValueChange={setSetupA}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Pick" /></SelectTrigger>
                  <SelectContent>{(setupsQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Setup B</Label>
                <Select value={setupB} onValueChange={setSetupB}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Pick" /></SelectTrigger>
                  <SelectContent>{(setupsQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {setupAData && setupBData && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Field</th><th className="py-2 pr-3">{setupAData.name}</th><th className="py-2 pr-3">{setupBData.name}</th>
                  </tr></thead>
                  <tbody>
                    {deltaKeys.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">No differences.</td></tr>}
                    {deltaKeys.map((k) => (
                      <tr key={k} className="border-b border-border/50">
                        <td className="py-2 pr-3 font-mono text-xs">{k}</td>
                        <td className="py-2 pr-3 font-mono">{String(setupAData.setup_data?.[k] ?? "—")}</td>
                        <td className="py-2 pr-3 font-mono text-primary">{String(setupBData.setup_data?.[k] ?? "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg font-bold uppercase tracking-wider">Setup value vs best lap</h2>
            </div>
            {numericKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">Need at least 2 setups with numeric values in their data to chart.</p>
            ) : (
              <>
                <div className="max-w-xs">
                  <Label>Setup field</Label>
                  <Select value={scatterKey} onValueChange={setScatterKey}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a numeric field" /></SelectTrigger>
                    <SelectContent>{numericKeys.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {scatterKey && <Scatter data={scatterData} xLabel={scatterKey} />}
              </>
            )}
          </div>

          <div className="mt-6 rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg font-bold uppercase tracking-wider">Setup change timeline</h2>
            </div>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No setups for this car yet.</p>
            ) : (
              <ol className="relative border-l border-border ml-3 space-y-4">
                {timeline.slice().reverse().map(({ setup, changes }) => (
                  <li key={setup.id} className="ml-4">
                    <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-primary shadow-glow" />
                    <div className="flex items-baseline justify-between flex-wrap gap-2">
                      <div className="font-display font-bold">{setup.name}</div>
                      <span className="font-mono text-xs text-muted-foreground">{new Date(setup.updated_at).toLocaleString()}</span>
                    </div>
                    {changes.length === 0 ? (
                      <div className="text-xs text-muted-foreground mt-1">Baseline / no diff vs prior.</div>
                    ) : (
                      <ul className="mt-2 space-y-1 text-sm">
                        {changes.map((c) => (
                          <li key={c.k} className="font-mono text-xs flex flex-wrap items-center gap-2">
                            <span className="text-muted-foreground">{c.k}:</span>
                            <span className="line-through text-destructive/80">{c.from}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-primary font-bold">{c.to}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Scatter({ data, xLabel }: { data: { name: string; x: number; ms: number }[]; xLabel: string }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground mt-3">No setups have both a value for "{xLabel}" and recorded laps.</p>;
  const W = 520, H = 240, P = 36;
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.ms);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rngX = maxX - minX || 1, rngY = maxY - minY || 1;
  const px = (x: number) => P + ((x - minX) / rngX) * (W - 2 * P);
  const py = (y: number) => H - P - ((y - minY) / rngY) * (H - 2 * P);
  return (
    <div className="mt-4 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl">
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="currentColor" className="text-border" />
        <line x1={P} y1={P} x2={P} y2={H - P} stroke="currentColor" className="text-border" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={px(d.x)} cy={py(d.ms)} r={5} className="fill-primary" />
            <text x={px(d.x) + 7} y={py(d.ms) - 7} className="fill-current text-[10px] font-mono text-muted-foreground">{d.name}</text>
          </g>
        ))}
        <text x={W / 2} y={H - 6} textAnchor="middle" className="fill-current text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{xLabel}</text>
        <text x={10} y={P - 8} className="fill-current text-[10px] font-mono uppercase tracking-widest text-muted-foreground">best lap (faster ↑)</text>
        <text x={P} y={H - P + 14} className="fill-current text-[9px] font-mono text-muted-foreground">{minX}</text>
        <text x={W - P} y={H - P + 14} textAnchor="end" className="fill-current text-[9px] font-mono text-muted-foreground">{maxX}</text>
        <text x={P - 4} y={H - P} textAnchor="end" className="fill-current text-[9px] font-mono text-muted-foreground">{formatLapTime(maxY)}</text>
        <text x={P - 4} y={P + 8} textAnchor="end" className="fill-current text-[9px] font-mono text-muted-foreground">{formatLapTime(minY)}</text>
      </svg>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
      {icon}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-display text-2xl font-bold">{value}</div>
      </div>
    </div>
  );
}