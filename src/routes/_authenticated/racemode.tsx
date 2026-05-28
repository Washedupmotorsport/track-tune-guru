import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatLapTime } from "@/lib/lap-time";
import {
  Flag, Fuel, Disc, Timer as TimerIcon, Play, Square, Plus, Minus,
  Maximize2, Settings2, X, ChevronDown, Radio,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/racemode")({
  component: RaceModePage,
  head: () => ({
    meta: [
      { title: "Race Mode — My Race Engineer" },
      { name: "description", content: "Trackside pitboard with giant readouts, tyre and fuel targets, pit-lane stopwatch and session countdown. Sunlight readable, glove friendly." },
    ],
  }),
});

// ---------------- types ----------------

type Sess = {
  id: string; name: string; started_at: string; session_type: string;
  track: string | null; driver: string | null;
  fuel_start_l: number | null; fuel_end_l: number | null;
  air_temp_c: number | null; track_temp_c: number | null;
  car_id: string;
};
type Lap = { id: string; session_id: string | null; lap_time_ms: number; lap_number: number | null; recorded_at: string };
type Tire = {
  id: string; session_id: string | null; recorded_at: string;
  tire_set: string;
  hot_fl: number | null; hot_fr: number | null; hot_rl: number | null; hot_rr: number | null;
};

// ---------------- targets (local persistence) ----------------

type Targets = {
  tyreTarget: number;   // psi hot target
  tyreTol: number;      // ± psi
  fuelPerLap: number;   // L/lap
  fuelReserve: number;  // L
  sessionLen: number;   // minutes
};
const DEFAULT_TARGETS: Targets = { tyreTarget: 31, tyreTol: 0.5, fuelPerLap: 2.4, fuelReserve: 1.5, sessionLen: 30 };

function useTargets(sessionId: string | null) {
  const key = sessionId ? `racemode:targets:${sessionId}` : null;
  const [t, setT] = useState<Targets>(DEFAULT_TARGETS);
  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setT({ ...DEFAULT_TARGETS, ...JSON.parse(raw) });
      else setT(DEFAULT_TARGETS);
    } catch { /* ignore */ }
  }, [key]);
  const save = (next: Targets) => {
    setT(next);
    if (key) try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
  };
  return [t, save] as const;
}

// Wake-lock to keep screen on
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let lock: { release: () => Promise<void> } | null = null;
    const acquire = async () => {
      try {
        // @ts-expect-error - experimental API
        if (navigator.wakeLock?.request) lock = await navigator.wakeLock.request("screen");
      } catch { /* ignore */ }
    };
    acquire();
    const onVis = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); lock?.release?.().catch(() => {}); };
  }, [active]);
}

// ---------------- page ----------------

function RaceModePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [tick, setTick] = useState(0);

  // 1s heartbeat for countdowns
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(id); }, []);
  // 5s poll for laps
  const [poll, setPoll] = useState(0);
  useEffect(() => { const id = setInterval(() => setPoll((p) => p + 1), 5000); return () => clearInterval(id); }, []);

  useWakeLock(true);

  const sessionsQ = useQuery({
    queryKey: ["racemode-sessions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions")
        .select("id, name, started_at, session_type, track, driver, fuel_start_l, fuel_end_l, air_temp_c, track_temp_c, car_id")
        .order("started_at", { ascending: false }).limit(25);
      if (error) throw error;
      return data as Sess[];
    },
  });
  const sessions = sessionsQ.data ?? [];
  const activeId = sessionId || sessions[0]?.id || "";
  const session = sessions.find((s) => s.id === activeId) ?? null;

  const [targets, setTargets] = useTargets(activeId || null);

  const lapsQ = useQuery({
    queryKey: ["racemode-laps", activeId, poll],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("laps")
        .select("id, session_id, lap_time_ms, lap_number, recorded_at")
        .eq("session_id", activeId).order("recorded_at");
      if (error) throw error;
      return data as Lap[];
    },
  });
  const laps = lapsQ.data ?? [];
  const last = laps[laps.length - 1] ?? null;
  const best = laps.length ? Math.min(...laps.map((l) => l.lap_time_ms)) : null;
  const prev = laps.length >= 2 ? laps[laps.length - 2] : null;
  const delta = last && best ? last.lap_time_ms - best : null;
  const avg5 = laps.length ? Math.round(laps.slice(-5).reduce((s, l) => s + l.lap_time_ms, 0) / Math.min(5, laps.length)) : null;

  const tireQ = useQuery({
    queryKey: ["racemode-tire", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("tire_logs")
        .select("id, session_id, recorded_at, tire_set, hot_fl, hot_fr, hot_rl, hot_rr")
        .eq("session_id", activeId).order("recorded_at", { ascending: false }).limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as Tire | null;
    },
  });
  const tire = tireQ.data;

  // Stopwatch (pit-lane / running lap timer)
  const [swStart, setSwStart] = useState<number | null>(null);
  const [swElapsedFrozen, setSwElapsedFrozen] = useState<number>(0);
  const swMs = swStart != null ? Date.now() - swStart : swElapsedFrozen;
  useEffect(() => { /* re-render via tick */ }, [tick]);

  // Lap logging
  const logLap = useMutation({
    mutationFn: async (ms: number) => {
      if (!session || !user) throw new Error("No session");
      // pull setup_id from session
      const { data: s } = await supabase.from("sessions").select("setup_id, car_id").eq("id", session.id).single();
      const payload: Record<string, unknown> = {
        session_id: session.id, car_id: session.car_id,
        setup_id: s?.setup_id ?? null,
        user_id: user.id,
        lap_time_ms: Math.max(1, Math.round(ms)),
        lap_number: (laps[laps.length - 1]?.lap_number ?? laps.length) + 1,
      };
      const { error } = await supabase.from("laps").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["racemode-laps", activeId] });
      toast.success("Lap logged");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Session countdown
  const sessionStartMs = session ? new Date(session.started_at).getTime() : 0;
  const sessionEndMs = sessionStartMs + targets.sessionLen * 60_000;
  const remainingMs = Math.max(0, sessionEndMs - Date.now());
  // tick reference (forces refresh)
  void tick;

  // Fuel projection
  const lapsRemaining = useMemo(() => {
    if (!session?.fuel_start_l || !targets.fuelPerLap) return null;
    const usedFromLaps = laps.length * targets.fuelPerLap;
    const fuelNow = Math.max(0, session.fuel_start_l - usedFromLaps);
    const usable = Math.max(0, fuelNow - targets.fuelReserve);
    return Math.floor(usable / targets.fuelPerLap);
  }, [session, laps.length, targets.fuelPerLap, targets.fuelReserve]);

  // Tyre check
  const tyreState = useMemo(() => {
    if (!tire) return null;
    const corners = [
      { k: "FL", v: tire.hot_fl }, { k: "FR", v: tire.hot_fr },
      { k: "RL", v: tire.hot_rl }, { k: "RR", v: tire.hot_rr },
    ];
    return corners.map((c) => {
      if (c.v == null) return { ...c, status: "na" as const, delta: null };
      const d = c.v - targets.tyreTarget;
      const status = Math.abs(d) <= targets.tyreTol ? "ok" : Math.abs(d) <= targets.tyreTol * 2 ? "warn" : "bad";
      return { ...c, status, delta: d };
    });
  }, [tire, targets.tyreTarget, targets.tyreTol]);

  const requestFs = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };

  // ---------------- render ----------------

  return (
    <div className="-mx-4 -my-4 min-h-[100vh] bg-black text-white select-none touch-manipulation"
         style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.2em] text-[#ffe600]">
            <Radio className="w-3 h-3" /> Race mode
          </span>
          <select
            value={activeId}
            onChange={(e) => setSessionId(e.target.value)}
            className="bg-transparent text-sm font-mono uppercase tracking-wider text-white/80 outline-none truncate max-w-[260px]"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id} className="bg-black">
                {s.name} {s.track ? `· ${s.track}` : ""}
              </option>
            ))}
            {sessions.length === 0 && <option value="">No sessions</option>}
          </select>
          <ChevronDown className="w-3 h-3 text-white/40" />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSettings(true)} aria-label="Targets"
                  className="h-11 w-11 rounded-md border border-white/10 active:bg-white/10 flex items-center justify-center">
            <Settings2 className="w-5 h-5" />
          </button>
          <button onClick={requestFs} aria-label="Fullscreen"
                  className="h-11 w-11 rounded-md border border-white/10 active:bg-white/10 flex items-center justify-center">
            <Maximize2 className="w-5 h-5" />
          </button>
          <Link to="/pitwall" aria-label="Exit"
                  className="h-11 w-11 rounded-md border border-white/10 active:bg-white/10 flex items-center justify-center">
            <X className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {!session ? (
        <div className="p-10 text-center text-white/60">
          No session selected. Start one from the{" "}
          <Link to="/sessions" className="underline">sessions list</Link>.
        </div>
      ) : (
        <div className="px-3 py-3 space-y-3">
          {/* HERO row: last lap + delta + session timer */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
            <div className="rounded-xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 p-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/50">Last lap</div>
              <div className="flex items-baseline gap-4 flex-wrap mt-1">
                <div className="font-mono tabular-nums leading-none font-semibold"
                     style={{ fontSize: "clamp(56px, 12vw, 140px)" }}>
                  {last ? formatLapTime(last.lap_time_ms) : "--:--.---"}
                </div>
                <div className="font-mono tabular-nums leading-none"
                     style={{ fontSize: "clamp(28px, 6vw, 64px)",
                              color: delta == null ? "rgba(255,255,255,0.4)"
                                   : delta === 0 ? "#22ff7a"
                                   : delta > 0 ? "#ff3b3b" : "#22ff7a" }}>
                  {delta == null ? "Δ —" : delta === 0 ? "★ BEST" : `${delta > 0 ? "+" : ""}${(delta / 1000).toFixed(3)}`}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <Stat label="Best"  value={best != null ? formatLapTime(best) : "—"} tone="text-[#22ff7a]" />
                <Stat label="Avg 5" value={avg5 != null ? formatLapTime(avg5) : "—"} />
                <Stat label="Laps"  value={String(laps.length)} />
              </div>
            </div>

            <div className="rounded-xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 p-4 flex flex-col">
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/50 flex items-center gap-1">
                <Flag className="w-3 h-3" /> Session countdown
              </div>
              <div className="font-mono tabular-nums leading-none font-semibold mt-1"
                   style={{ fontSize: "clamp(48px, 11vw, 120px)",
                            color: remainingMs < 60_000 ? "#ff3b3b" : remainingMs < 300_000 ? "#ffe600" : "white" }}>
                {fmtMmSs(remainingMs)}
              </div>
              <div className="mt-2 h-2 rounded bg-white/10 overflow-hidden">
                <div className="h-full bg-[#ffe600]"
                     style={{ width: `${100 - Math.min(100, (remainingMs / (targets.sessionLen * 60_000)) * 100)}%` }} />
              </div>
              <div className="mt-2 text-[11px] font-mono uppercase tracking-[0.2em] text-white/60">
                {session.driver ?? "Driver"} · {session.track ?? "Track"} · {targets.sessionLen} min
              </div>
            </div>
          </div>

          {/* Stopwatch + lap button */}
          <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr] gap-2 items-stretch">
            <div className="rounded-lg bg-black/50 border border-white/10 p-3">
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/50 flex items-center gap-1">
                <TimerIcon className="w-3 h-3" /> Stopwatch · pit / lap
              </div>
              <div className="font-mono tabular-nums leading-none font-semibold mt-1"
                   style={{ fontSize: "clamp(40px, 9vw, 96px)",
                            color: swStart != null ? "#22ff7a" : "white" }}>
                {fmtStopwatch(swMs)}
              </div>
            </div>
            <button
              onClick={() => {
                if (swStart == null) { setSwStart(Date.now()); setSwElapsedFrozen(0); }
                else { setSwElapsedFrozen(Date.now() - swStart); setSwStart(null); }
              }}
              className="rounded-lg text-xl font-mono uppercase tracking-[0.2em] active:scale-[0.98] transition-transform border-2"
              style={{
                background: swStart != null ? "#ff3b3b" : "#22ff7a",
                color: "black", borderColor: "rgba(0,0,0,0.2)", minHeight: 96,
              }}
            >
              {swStart != null ? <span className="inline-flex items-center gap-2"><Square className="w-6 h-6" /> Stop</span>
                                : <span className="inline-flex items-center gap-2"><Play className="w-6 h-6" /> Start</span>}
            </button>
            <button
              disabled={swMs <= 0 || logLap.isPending}
              onClick={() => {
                const ms = swMs;
                logLap.mutate(ms);
                setSwStart(Date.now()); setSwElapsedFrozen(0);
              }}
              className="rounded-lg text-xl font-mono uppercase tracking-[0.2em] active:scale-[0.98] transition-transform border-2 disabled:opacity-40"
              style={{ background: "#ffe600", color: "black", borderColor: "rgba(0,0,0,0.2)", minHeight: 96 }}
            >
              <span className="inline-flex items-center gap-2"><Plus className="w-6 h-6" /> Log lap</span>
            </button>
          </div>

          {/* Tyres + Fuel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Tyres */}
            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/50 flex items-center gap-1">
                  <Disc className="w-3 h-3" /> Tyre target · {targets.tyreTarget.toFixed(1)} ± {targets.tyreTol.toFixed(1)} psi
                </div>
                {tire?.tire_set && (
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/60">{tire.tire_set}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(tyreState ?? [
                  { k: "FL", v: null, status: "na" as const, delta: null },
                  { k: "FR", v: null, status: "na" as const, delta: null },
                  { k: "RL", v: null, status: "na" as const, delta: null },
                  { k: "RR", v: null, status: "na" as const, delta: null },
                ]).map((c) => (
                  <TyreTile key={c.k} corner={c.k} value={c.v} status={c.status} delta={c.delta} />
                ))}
              </div>
            </div>

            {/* Fuel */}
            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/50 flex items-center gap-1">
                  <Fuel className="w-3 h-3" /> Fuel target · {targets.fuelPerLap.toFixed(2)} L/lap · reserve {targets.fuelReserve.toFixed(1)} L
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <BigStat label="Laps remaining"
                         value={lapsRemaining != null ? String(lapsRemaining) : "—"}
                         tone={lapsRemaining != null && lapsRemaining <= 2 ? "#ff3b3b" : lapsRemaining != null && lapsRemaining <= 5 ? "#ffe600" : "#22ff7a"} />
                <BigStat label="Fuel start"
                         value={session.fuel_start_l != null ? `${session.fuel_start_l.toFixed(1)} L` : "—"} />
                <BigStat label="Used"
                         value={`${(laps.length * targets.fuelPerLap).toFixed(1)} L`} />
                <BigStat label="Est. now"
                         value={session.fuel_start_l != null ? `${Math.max(0, session.fuel_start_l - laps.length * targets.fuelPerLap).toFixed(1)} L` : "—"} />
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsSheet targets={targets} onSave={setTargets} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

// ---------------- subcomponents ----------------

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-black/40 border border-white/10 px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/50">{label}</div>
      <div className={`font-mono tabular-nums text-2xl mt-0.5 ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function BigStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-black/40 border border-white/10 p-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/50">{label}</div>
      <div className="font-mono tabular-nums font-semibold leading-none mt-1"
           style={{ fontSize: "clamp(28px, 5vw, 48px)", color: tone ?? "white" }}>{value}</div>
    </div>
  );
}

function TyreTile({ corner, value, status, delta }:
  { corner: string; value: number | null; status: "ok" | "warn" | "bad" | "na"; delta: number | null }) {
  const colorMap: Record<typeof status, string> = {
    ok: "#22ff7a", warn: "#ffe600", bad: "#ff3b3b", na: "rgba(255,255,255,0.4)",
  };
  const col = colorMap[status];
  return (
    <div className="rounded-lg bg-black/40 border border-white/10 p-3 relative overflow-hidden">
      <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/50">{corner}</div>
      <div className="font-mono tabular-nums font-semibold leading-none mt-1"
           style={{ fontSize: "clamp(36px, 7vw, 64px)", color: col }}>
        {value != null ? value.toFixed(1) : "—"}
      </div>
      <div className="text-[11px] font-mono uppercase tracking-[0.2em] mt-1" style={{ color: col }}>
        {delta == null ? "no data" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} psi`}
      </div>
      <div className="absolute right-2 top-2 w-2 h-2 rounded-full" style={{ background: col }} />
    </div>
  );
}

function SettingsSheet({ targets, onSave, onClose }:
  { targets: Targets; onSave: (t: Targets) => void; onClose: () => void }) {
  const [t, setT] = useState<Targets>(targets);
  const bump = (k: keyof Targets, d: number) => setT((p) => ({ ...p, [k]: Math.max(0, +(p[k] + d).toFixed(2)) }));
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-neutral-950 border border-white/20 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-4"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Targets</h3>
          <button onClick={onClose} className="h-11 w-11 flex items-center justify-center rounded-md border border-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <StepperRow label="Tyre target (psi)"  value={t.tyreTarget.toFixed(1)} onDec={() => bump("tyreTarget", -0.5)} onInc={() => bump("tyreTarget", 0.5)} />
          <StepperRow label="Tyre tolerance ±"   value={t.tyreTol.toFixed(1)}   onDec={() => bump("tyreTol", -0.1)}    onInc={() => bump("tyreTol", 0.1)} />
          <StepperRow label="Fuel L per lap"     value={t.fuelPerLap.toFixed(2)} onDec={() => bump("fuelPerLap", -0.1)} onInc={() => bump("fuelPerLap", 0.1)} />
          <StepperRow label="Fuel reserve (L)"   value={t.fuelReserve.toFixed(1)} onDec={() => bump("fuelReserve", -0.5)} onInc={() => bump("fuelReserve", 0.5)} />
          <StepperRow label="Session length (min)" value={String(t.sessionLen)}   onDec={() => bump("sessionLen", -5)}    onInc={() => bump("sessionLen", 5)} />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={onClose} className="h-14 rounded-lg border border-white/20 font-mono uppercase tracking-wider">Cancel</button>
          <button onClick={() => { onSave(t); onClose(); toast.success("Targets saved"); }}
                  className="h-14 rounded-lg font-mono uppercase tracking-wider" style={{ background: "#ffe600", color: "black" }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function StepperRow({ label, value, onDec, onInc }:
  { label: string; value: string; onDec: () => void; onInc: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/70">{label}</div>
      <div className="flex items-center gap-2">
        <button onClick={onDec} className="h-12 w-12 rounded-md border border-white/20 flex items-center justify-center active:bg-white/10">
          <Minus className="w-5 h-5" />
        </button>
        <div className="min-w-[88px] text-center text-2xl font-mono tabular-nums">{value}</div>
        <button onClick={onInc} className="h-12 w-12 rounded-md border border-white/20 flex items-center justify-center active:bg-white/10">
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// ---------------- formatters ----------------

function fmtMmSs(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function fmtStopwatch(ms: number) {
  const total = Math.floor(ms / 10); // 1/100
  const cs = total % 100;
  const sTotal = Math.floor(total / 100);
  const s = sTotal % 60;
  const m = Math.floor(sTotal / 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}