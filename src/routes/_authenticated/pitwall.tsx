import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Gauge, Thermometer, Droplets, Fuel, Timer, CloudSun, Activity,
  Disc, TrendingDown, TrendingUp, Wind, Flame, ArrowRight, AlertTriangle,
} from "lucide-react";
import { GuidedTour } from "@/components/guided-tour";
import { StandaloneStopwatch } from "@/components/standalone-stopwatch";

export const Route = createFileRoute("/_authenticated/pitwall")({ component: PitWallPage });

type Car = { id: string; name: string };
type Session = {
  id: string; car_id: string; name: string; session_type: string;
  track: string | null; driver: string | null; weather: string | null;
  air_temp_c: number | null; track_temp_c: number | null;
  fuel_start_l: number | null; fuel_end_l: number | null;
  started_at: string;
};
type Lap = {
  id: string; session_id: string | null; car_id: string; setup_id: string;
  lap_number: number | null; lap_time_ms: number;
  sector_1_ms: number | null; sector_2_ms: number | null; sector_3_ms: number | null;
  recorded_at: string;
};
type Tire = {
  id: string; car_id: string; tire_set: string; compound: string | null;
  heat_cycles: number | null;
  cold_fl: number | null; cold_fr: number | null; cold_rl: number | null; cold_rr: number | null;
  hot_fl: number | null; hot_fr: number | null; hot_rl: number | null; hot_rr: number | null;
  tread_fl: number | null; tread_fr: number | null; tread_rl: number | null; tread_rr: number | null;
  ambient_c: number | null; track_c: number | null; recorded_at: string;
};
type Setup = { id: string; car_id: string; name: string; setup_data: Record<string, unknown>; updated_at: string };
type Priority = {
  id: string; title: string; category: string; priority: string;
  detail: string | null; last_observed_at: string;
};

function fmtLap(ms: number | null | undefined) {
  if (ms == null) return "—";
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3);
  return `${m}:${s.padStart(6, "0")}`;
}
function fmtDelta(ms: number) {
  const sign = ms > 0 ? "+" : ms < 0 ? "−" : "";
  const v = Math.abs(ms) / 1000;
  return `${sign}${v.toFixed(3)}`;
}
function num(v: unknown, d = 1): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—";
}
function getNum(rec: Record<string, unknown>, key: string): number | null {
  const v = rec[key];
  return typeof v === "number" ? v : (typeof v === "string" && v !== "" && !isNaN(+v) ? +v : null);
}

function PitWallPage() {
  const { user } = useAuth();
  const [carId, setCarId] = useState<string | "all">("all");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const carsQ = useQuery({
    queryKey: ["pw-cars", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id,name").order("created_at");
      if (error) throw error;
      return data as Car[];
    },
    enabled: !!user,
  });

  const sessionsQ = useQuery({
    queryKey: ["pw-sessions", user?.id, carId],
    queryFn: async () => {
      let q = supabase.from("sessions")
        .select("id,car_id,name,session_type,track,driver,weather,air_temp_c,track_temp_c,fuel_start_l,fuel_end_l,started_at")
        .order("started_at", { ascending: false }).limit(25);
      if (carId !== "all") q = q.eq("car_id", carId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Session[];
    },
    enabled: !!user,
  });

  const latestSession = sessionsQ.data?.[0];

  const lapsQ = useQuery({
    queryKey: ["pw-laps", user?.id, latestSession?.id],
    queryFn: async () => {
      if (!latestSession) return [];
      const { data, error } = await supabase.from("laps")
        .select("id,session_id,car_id,setup_id,lap_number,lap_time_ms,sector_1_ms,sector_2_ms,sector_3_ms,recorded_at")
        .eq("session_id", latestSession.id)
        .order("recorded_at", { ascending: true }).limit(80);
      if (error) throw error;
      return data as Lap[];
    },
    enabled: !!user && !!latestSession,
  });

  const tireQ = useQuery({
    queryKey: ["pw-tires", user?.id, carId],
    queryFn: async () => {
      let q = supabase.from("tire_logs")
        .select("id,car_id,tire_set,compound,heat_cycles,cold_fl,cold_fr,cold_rl,cold_rr,hot_fl,hot_fr,hot_rl,hot_rr,tread_fl,tread_fr,tread_rl,tread_rr,ambient_c,track_c,recorded_at")
        .order("recorded_at", { ascending: false }).limit(10);
      if (carId !== "all") q = q.eq("car_id", carId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Tire[];
    },
    enabled: !!user,
  });

  const setupsQ = useQuery({
    queryKey: ["pw-setups", user?.id, carId],
    queryFn: async () => {
      let q = supabase.from("setups")
        .select("id,car_id,name,setup_data,updated_at")
        .order("updated_at", { ascending: false }).limit(5);
      if (carId !== "all") q = q.eq("car_id", carId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Setup[];
    },
    enabled: !!user,
  });

  const prioritiesQ = useQuery({
    queryKey: ["pw-priorities", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineering_memory")
        .select("id,title,category,priority,detail,last_observed_at")
        .eq("status", "active")
        .in("priority", ["critical", "testing"])
        .order("last_observed_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data as Priority[];
    },
    enabled: !!user,
  });

  const latestTire = tireQ.data?.[0];
  const latestSetup = setupsQ.data?.[0];

  const lapStats = useMemo(() => {
    const laps = lapsQ.data ?? [];
    if (!laps.length) return null;
    const valid = laps.filter((l) => l.lap_time_ms > 0);
    if (!valid.length) return null;
    const best = valid.reduce((a, b) => (a.lap_time_ms < b.lap_time_ms ? a : b));
    const last = valid[valid.length - 1];
    const recent = valid.slice(-5);
    const avg = recent.reduce((s, l) => s + l.lap_time_ms, 0) / recent.length;
    const delta = last.lap_time_ms - best.lap_time_ms;
    const trend = recent.length >= 2 ? recent[recent.length - 1].lap_time_ms - recent[0].lap_time_ms : 0;
    return { best, last, avg, delta, trend, count: valid.length, recent };
  }, [lapsQ.data]);

  const fuelStats = useMemo(() => {
    const sessions = (sessionsQ.data ?? []).filter(
      (s) => s.fuel_start_l != null && s.fuel_end_l != null && s.fuel_start_l > s.fuel_end_l
    );
    if (!sessions.length) return null;
    // Use laps per session to estimate burn per lap
    const burns: number[] = [];
    for (const s of sessions.slice(0, 6)) {
      const used = (s.fuel_start_l ?? 0) - (s.fuel_end_l ?? 0);
      burns.push(used);
    }
    const totalUsed = burns.reduce((a, b) => a + b, 0);
    const avgPerSession = totalUsed / burns.length;
    // estimate per lap from latest session laps count
    const latestUsed = (latestSession?.fuel_start_l ?? 0) - (latestSession?.fuel_end_l ?? 0);
    const lapCount = (lapsQ.data?.length ?? 0) || 0;
    const perLap = lapCount > 0 && latestUsed > 0 ? latestUsed / lapCount : avgPerSession / 20;
    const tankAssumed = 60; // default assumption
    const remaining = latestSession?.fuel_end_l ?? null;
    const lapsRemaining = remaining != null && perLap > 0 ? Math.floor(remaining / perLap) : null;
    return { perLap, avgPerSession, remaining, lapsRemaining, tank: tankAssumed };
  }, [sessionsQ.data, lapsQ.data, latestSession]);

  const setupBalance = useMemo(() => {
    const sd = (latestSetup?.setup_data ?? {}) as Record<string, unknown>;
    const brakeBias = getNum(sd, "brake_bias") ?? getNum(sd, "brakeBias") ?? 55;
    const frontArb = getNum(sd, "arb_front") ?? getNum(sd, "front_arb") ?? null;
    const rearArb = getNum(sd, "arb_rear") ?? getNum(sd, "rear_arb") ?? null;
    // Balance: front-heavy ARB => understeer (positive), rear-heavy => oversteer (negative)
    let balance = 0;
    if (frontArb != null && rearArb != null && (frontArb + rearArb) > 0) {
      balance = ((frontArb - rearArb) / (frontArb + rearArb)) * 100;
    }
    const frontWing = getNum(sd, "front_wing") ?? getNum(sd, "wing_front") ?? null;
    const rearWing = getNum(sd, "rear_wing") ?? getNum(sd, "wing_rear") ?? null;
    return { brakeBias, frontArb, rearArb, balance, frontWing, rearWing };
  }, [latestSetup]);

  const cars = carsQ.data ?? [];
  const sessionElapsedMs = latestSession ? now - new Date(latestSession.started_at).getTime() : 0;
  const elapsedH = Math.floor(sessionElapsedMs / 3600000);
  const elapsedM = Math.floor((sessionElapsedMs % 3600000) / 60000);
  const elapsedS = Math.floor((sessionElapsedMs % 60000) / 1000);

  return (
    <div className="space-y-3">
      <GuidedTour tourKey="race-mode" />
      {/* WATCH — active critical/testing priorities, race-weekend triage */}
      {(prioritiesQ.data?.length ?? 0) > 0 && (
        <div className="border-[1.5px] border-destructive/40 bg-destructive/5 rounded-md">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-destructive/30">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-destructive">Watch · active priorities</span>
            <Link to="/engineer" className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary">
              Cockpit →
            </Link>
          </div>
          <ul className="divide-y divide-destructive/20">
            {(prioritiesQ.data ?? []).map((p) => (
              <li key={p.id} className="px-3 py-2 flex items-center gap-2">
                <span className={`inline-flex items-center px-1.5 h-5 rounded text-[10px] font-mono uppercase tracking-widest ${
                  p.priority === "critical"
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-accent/80 text-accent-foreground"
                }`}>{p.priority}</span>
                <span className="text-[13px] font-semibold truncate flex-1 min-w-0">{p.title}</span>
                <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground uppercase">{p.category}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pit-wall header strip */}
      <div className="border border-border bg-card/60 rounded-md">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Pit wall · Live</span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hidden md:inline">
              {new Date(now).toISOString().slice(11, 19)} UTC
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Car</span>
            <select
              value={carId}
              onChange={(e) => setCarId(e.target.value as string)}
              className="bg-muted/30 border border-border rounded px-2 py-1 text-xs font-mono"
            >
              <option value="all">ALL</option>
              {cars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 divide-x divide-border">
          <Stat label="Session" value={latestSession?.name ?? "—"} sub={latestSession?.session_type ?? ""} />
          <Stat label="Driver" value={latestSession?.driver ?? "—"} sub={latestSession?.track ?? ""} />
          <Stat label="Elapsed" value={`${String(elapsedH).padStart(2,"0")}:${String(elapsedM).padStart(2,"0")}:${String(elapsedS).padStart(2,"0")}`} sub="hh:mm:ss" mono />
          <Stat label="Best lap" value={fmtLap(lapStats?.best.lap_time_ms ?? null)} sub={lapStats?.best.lap_number ? `L${lapStats.best.lap_number}` : ""} mono accent />
          <Stat label="Last" value={fmtLap(lapStats?.last.lap_time_ms ?? null)} sub={lapStats ? fmtDelta(lapStats.delta) : ""} mono />
          <Stat label="Laps" value={String(lapStats?.count ?? 0)} sub="completed" mono />
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Lap delta widget */}
        <Panel title="Lap delta" icon={<Activity className="w-3.5 h-3.5" />} hint="vs personal best">
          {lapStats ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-3">
                <div className={`font-mono text-4xl tabular-nums ${lapStats.delta <= 0 ? "text-primary" : "text-destructive"}`}>
                  {fmtDelta(lapStats.delta)}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">sec</div>
              </div>
              <div className="h-16 flex items-end gap-1">
                {lapStats.recent.map((l, i) => {
                  const dms = l.lap_time_ms - lapStats.best.lap_time_ms;
                  const max = Math.max(...lapStats.recent.map((x) => x.lap_time_ms - lapStats.best.lap_time_ms), 1);
                  const h = 8 + (dms / max) * 56;
                  return (
                    <div key={l.id} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-sm ${dms === 0 ? "bg-primary" : dms < 250 ? "bg-primary/60" : dms < 750 ? "bg-accent/70" : "bg-destructive/70"}`}
                        style={{ height: `${h}px` }}
                        title={fmtLap(l.lap_time_ms)}
                      />
                      <span className="font-mono text-[9px] text-muted-foreground">{l.lap_number ?? i + 1}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <span>5-lap avg</span>
                <span>{fmtLap(lapStats.avg)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <span>Trend</span>
                <span className={lapStats.trend > 0 ? "text-destructive" : "text-primary"}>
                  {lapStats.trend > 0 ? <TrendingDown className="inline w-3 h-3 mr-1" /> : <TrendingUp className="inline w-3 h-3 mr-1" />}
                  {fmtDelta(lapStats.trend)}
                </span>
              </div>
            </div>
          ) : (
            <Empty hint="Log laps to populate the delta channel" />
          )}
        </Panel>

        {/* Fuel prediction */}
        <Panel title="Fuel prediction" icon={<Fuel className="w-3.5 h-3.5" />} hint="rolling burn">
          {fuelStats ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-3">
                <div className="font-mono text-4xl tabular-nums text-primary">
                  {fuelStats.remaining != null ? fuelStats.remaining.toFixed(1) : "—"}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">L remaining</div>
              </div>
              <BarMeter value={fuelStats.remaining ?? 0} max={fuelStats.tank} />
              <div className="grid grid-cols-3 gap-2 pt-1">
                <Mini label="L / lap" value={fuelStats.perLap.toFixed(2)} />
                <Mini label="Laps left" value={fuelStats.lapsRemaining != null ? String(fuelStats.lapsRemaining) : "—"} accent />
                <Mini label="Avg / sess" value={fuelStats.avgPerSession.toFixed(1)} />
              </div>
            </div>
          ) : (
            <Empty hint="Log fuel start / end to predict burn" />
          )}
        </Panel>

        {/* Weather */}
        <Panel title="Weather" icon={<CloudSun className="w-3.5 h-3.5" />} hint={latestTire?.recorded_at ? new Date(latestTire.recorded_at).toLocaleTimeString() : "latest"}>
          <div className="grid grid-cols-2 gap-3">
            <BigMetric label="Air" value={`${num(latestSession?.air_temp_c ?? latestTire?.ambient_c)}°`} icon={<Wind className="w-4 h-4" />} />
            <BigMetric label="Track" value={`${num(latestSession?.track_temp_c ?? latestTire?.track_c)}°`} icon={<Thermometer className="w-4 h-4" />} accent />
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between font-mono text-[11px]">
            <span className="text-muted-foreground uppercase tracking-widest text-[10px]">Conditions</span>
            <span className="text-foreground">{latestSession?.weather ?? "—"}</span>
          </div>
          <div className="mt-1 flex items-center justify-between font-mono text-[11px]">
            <span className="text-muted-foreground uppercase tracking-widest text-[10px]">Δ Track − Air</span>
            <span className="text-primary">
              {latestSession?.air_temp_c != null && latestSession?.track_temp_c != null
                ? `${(latestSession.track_temp_c - latestSession.air_temp_c).toFixed(1)}°`
                : "—"}
            </span>
          </div>
        </Panel>
      </div>

      {/* Tyre panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel title="Tyre pressures" icon={<Droplets className="w-3.5 h-3.5" />} hint={latestTire?.tire_set ?? "no set"}>
          {latestTire ? (
            <CornerGrid
              fl={latestTire.hot_fl ?? latestTire.cold_fl}
              fr={latestTire.hot_fr ?? latestTire.cold_fr}
              rl={latestTire.hot_rl ?? latestTire.cold_rl}
              rr={latestTire.hot_rr ?? latestTire.cold_rr}
              unit="psi"
              target={28}
              tol={1.5}
              decimals={1}
            />
          ) : <Empty hint="Log tyre pressures from the Tyres page" />}
          {latestTire && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono uppercase tracking-widest">
              <Mini label="Compound" value={latestTire.compound ?? "—"} />
              <Mini label="Cycles" value={String(latestTire.heat_cycles ?? 0)} />
            </div>
          )}
        </Panel>

        <Panel title="Tyre temperatures" icon={<Flame className="w-3.5 h-3.5" />} hint="hot reading">
          {latestTire ? (
            <CornerGrid
              fl={latestTire.hot_fl}
              fr={latestTire.hot_fr}
              rl={latestTire.hot_rl}
              rr={latestTire.hot_rr}
              unit="°C"
              target={85}
              tol={10}
              heatmap
              decimals={0}
            />
          ) : <Empty hint="Log hot temperatures to see heat map" />}
        </Panel>
      </div>

      {/* Setup / brake balance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel title="Brake balance" icon={<Disc className="w-3.5 h-3.5" />} hint={latestSetup?.name ?? "no setup"}>
          <div className="flex items-baseline gap-3 mb-3">
            <div className="font-mono text-4xl tabular-nums text-primary">{setupBalance.brakeBias.toFixed(1)}%</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">front bias</div>
          </div>
          <BiasBar value={setupBalance.brakeBias} />
          <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Front</span><span>Rear</span>
          </div>
        </Panel>

        <Panel title="Setup balance" icon={<Gauge className="w-3.5 h-3.5" />} hint="ARB delta">
          <div className="flex items-baseline gap-3 mb-3">
            <div className={`font-mono text-4xl tabular-nums ${Math.abs(setupBalance.balance) < 8 ? "text-primary" : "text-accent"}`}>
              {setupBalance.balance > 0 ? "+" : ""}{setupBalance.balance.toFixed(1)}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {setupBalance.balance > 4 ? "understeer" : setupBalance.balance < -4 ? "oversteer" : "neutral"}
            </div>
          </div>
          <CenterGauge value={setupBalance.balance} />
          <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] font-mono uppercase tracking-widest">
            <Mini label="ARB F" value={setupBalance.frontArb != null ? String(setupBalance.frontArb) : "—"} />
            <Mini label="ARB R" value={setupBalance.rearArb != null ? String(setupBalance.rearArb) : "—"} />
            <Mini label="Wing F" value={setupBalance.frontWing != null ? String(setupBalance.frontWing) : "—"} />
            <Mini label="Wing R" value={setupBalance.rearWing != null ? String(setupBalance.rearWing) : "—"} />
          </div>
        </Panel>
      </div>

      {/* Footer link strip */}
      <div className="flex flex-wrap gap-2 pt-1">
        <FootLink to="/sessions" label="Sessions" />
        <FootLink to="/tires" label="Tyre logs" />
        <FootLink to="/tyre-setup" label="Tyre setup" />
        <FootLink to="/analysis" label="Analysis" />
        <FootLink to="/weekends" label="Weekends" />
      </div>
    </div>
  );
}

function Stat({ label, value, sub, mono, accent }: { label: string; value: string; sub?: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 truncate ${mono ? "font-mono tabular-nums" : "font-semibold"} text-base ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
      {sub ? <div className="font-mono text-[10px] text-muted-foreground truncate">{sub}</div> : null}
    </div>
  );
}

function Panel({ title, icon, hint, children }: { title: string; icon: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border border-border bg-card/60 rounded-md">
      <header className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-primary">
          {icon}
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em]">{title}</h2>
        </div>
        {hint ? <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground truncate max-w-[55%]">{hint}</span> : null}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="h-32 flex items-center justify-center text-center">
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{hint}</p>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-border rounded px-2 py-1.5 bg-muted/20">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm tabular-nums ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function BigMetric({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className="border border-border rounded-md p-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className={accent ? "text-accent" : "text-primary"}>{icon}</span>
      </div>
      <div className={`mt-1 font-mono text-3xl tabular-nums ${accent ? "text-accent" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function BarMeter({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = pct < 15 ? "bg-destructive" : pct < 35 ? "bg-accent" : "bg-primary";
  return (
    <div className="space-y-1">
      <div className="h-2 w-full rounded-sm bg-muted/40 overflow-hidden border border-border">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>0 L</span><span>{max} L</span>
      </div>
    </div>
  );
}

function BiasBar({ value }: { value: number }) {
  const pct = Math.max(40, Math.min(70, value));
  return (
    <div className="relative h-3 w-full rounded-sm bg-muted/40 border border-border overflow-hidden">
      <div className="absolute inset-y-0 left-0 bg-primary/30" style={{ width: `${pct}%` }} />
      <div className="absolute top-0 bottom-0 w-[2px] bg-primary" style={{ left: `${pct}%` }} />
      <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/30" />
    </div>
  );
}

function CenterGauge({ value }: { value: number }) {
  // value in -50..50
  const clamped = Math.max(-50, Math.min(50, value));
  const pct = 50 + clamped; // 0..100
  return (
    <div className="relative h-3 w-full rounded-sm bg-muted/40 border border-border overflow-hidden">
      <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/40" />
      {clamped >= 0 ? (
        <div className="absolute inset-y-0 bg-accent/40" style={{ left: "50%", width: `${clamped}%` }} />
      ) : (
        <div className="absolute inset-y-0 bg-primary/40" style={{ left: `${pct}%`, width: `${-clamped}%` }} />
      )}
      <div className="absolute top-0 bottom-0 w-[2px] bg-primary" style={{ left: `${pct}%` }} />
      <div className="absolute inset-x-0 -bottom-4 flex justify-between font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        <span>OS</span><span>Neutral</span><span>US</span>
      </div>
    </div>
  );
}

function CornerGrid({
  fl, fr, rl, rr, unit, target, tol, heatmap, decimals = 1,
}: {
  fl: number | null; fr: number | null; rl: number | null; rr: number | null;
  unit: string; target: number; tol: number; heatmap?: boolean; decimals?: number;
}) {
  function cellClass(v: number | null) {
    if (v == null) return "border-border bg-muted/20 text-muted-foreground";
    const d = v - target;
    if (Math.abs(d) <= tol) return "border-primary/50 bg-primary/10 text-primary";
    if (heatmap) {
      if (d > tol * 2) return "border-destructive/50 bg-destructive/20 text-destructive";
      if (d > tol) return "border-accent/50 bg-accent/15 text-accent";
      if (d < -tol * 2) return "border-blue-500/40 bg-blue-500/10 text-blue-400";
      return "border-accent/30 bg-accent/10 text-accent";
    }
    return Math.abs(d) > tol * 2
      ? "border-destructive/50 bg-destructive/15 text-destructive"
      : "border-accent/40 bg-accent/10 text-accent";
  }
  function render(v: number | null) {
    return v == null ? "—" : v.toFixed(decimals);
  }
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
      <Corner label="FL" value={render(fl)} unit={unit} cls={cellClass(fl)} />
      <CarSilhouette />
      <Corner label="FR" value={render(fr)} unit={unit} cls={cellClass(fr)} />
      <Corner label="RL" value={render(rl)} unit={unit} cls={cellClass(rl)} />
      <div />
      <Corner label="RR" value={render(rr)} unit={unit} cls={cellClass(rr)} />
    </div>
  );
}

function Corner({ label, value, unit, cls }: { label: string; value: string; unit: string; cls: string }) {
  return (
    <div className={`border rounded-md px-3 py-2 ${cls}`}>
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest opacity-80">
        <span>{label}</span><span>{unit}</span>
      </div>
      <div className="font-mono text-2xl tabular-nums">{value}</div>
    </div>
  );
}

function CarSilhouette() {
  return (
    <div className="flex flex-col items-center justify-center text-muted-foreground/60 px-1">
      <div className="w-6 h-12 border border-current rounded-sm relative">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-5 border border-current rounded-[2px]" />
      </div>
    </div>
  );
}

function FootLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 border border-border bg-muted/20 px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary/40"
    >
      {label} <ArrowRight className="w-3 h-3" />
    </Link>
  );
}

// Suppress unused import warnings for icons reserved for future widgets
void Timer;