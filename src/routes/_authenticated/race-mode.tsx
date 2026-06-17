import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useActiveWeekend } from "@/lib/active-weekend";
import { NoActiveWeekendEmpty } from "@/components/no-active-weekend-empty";
import { formatLapTime } from "@/lib/lap-time";
import {
  Radio, Flag, Disc, Fuel, MessageSquare, AlertTriangle,
  Timer as TimerIcon, Play, Square, Plus, Minus, Save, Maximize2, X,
  ChevronDown, Settings2, Loader2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/race-mode")({
  component: RaceModePage,
  head: () => ({
    meta: [
      { title: "Race Mode — My Race Engineer" },
      { name: "description", content: "One race-day operating screen for engineers and drivers — live timing, tyres, fuel, driver feedback and engineering priorities." },
    ],
  }),
});

type TabKey = "live" | "tyres" | "fuel" | "feedback" | "priorities";

// ─────────────── shared types ───────────────
type Sess = {
  id: string; name: string; started_at: string; ended_at: string | null; session_type: string;
  track: string | null; driver: string | null; weather: string | null;
  fuel_start_l: number | null; fuel_end_l: number | null;
  air_temp_c: number | null; track_temp_c: number | null;
  car_id: string; event_id: string | null; setup_id: string | null;
};
type Lap = { id: string; session_id: string | null; lap_time_ms: number; lap_number: number | null; recorded_at: string };
type Tire = {
  id: string; tire_set: string; compound: string | null;
  cold_fl: number | null; cold_fr: number | null; cold_rl: number | null; cold_rr: number | null;
  hot_fl: number | null; hot_fr: number | null; hot_rl: number | null; hot_rr: number | null;
  recorded_at: string;
};
type Feedback = {
  id: string; description: string; category: string; severity: string;
  balance: string | null; recorded_at: string;
};
type Priority = {
  id: string; title: string; category: string; priority: string;
  detail: string | null; last_observed_at: string;
};

// ─────────────── targets persistence ───────────────
type Targets = {
  tyreTarget: number; tyreTol: number;
  fuelPerLap: number; fuelReserve: number;
  sessionLen: number;
};
const DEFAULT_TARGETS: Targets = { tyreTarget: 31, tyreTol: 0.5, fuelPerLap: 2.4, fuelReserve: 1.5, sessionLen: 30 };

function useTargets(sessionId: string | null) {
  const key = sessionId ? `race-mode:targets:${sessionId}` : null;
  const [t, setT] = useState<Targets>(DEFAULT_TARGETS);
  useEffect(() => {
    if (!key) { setT(DEFAULT_TARGETS); return; }
    try {
      const raw = localStorage.getItem(key);
      setT(raw ? { ...DEFAULT_TARGETS, ...JSON.parse(raw) } : DEFAULT_TARGETS);
    } catch { setT(DEFAULT_TARGETS); }
  }, [key]);
  const save = (next: Targets) => {
    setT(next);
    if (key) { try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ } }
  };
  return [t, save] as const;
}

// keep screen awake during race day
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let lock: { release: () => Promise<void> } | null = null;
    const acquire = async () => {
      try {
        const nav = navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } };
        if (nav.wakeLock?.request) lock = await nav.wakeLock.request("screen");
      } catch { /* ignore */ }
    };
    acquire();
    const onVis = () => { if (document.visibilityState === "visible") acquire(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); lock?.release?.().catch(() => {}); };
  }, [active]);
}

// ─────────────── page ───────────────
function RaceModePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { activeWeekend, activeCar, activeSession } = useActiveWeekend();
  const [tab, setTab] = useState<TabKey>("live");
  const [showSettings, setShowSettings] = useState(false);
  const [manualSessionId, setManualSessionId] = useState<string | "">("");
  const [, setTick] = useState(0);

  useWakeLock(true);
  // Slow tick for countdown / general re-render
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(id); }, []);

  // Sessions for the active weekend (fallback: latest 15 if no weekend)
  const sessionsQ = useQuery({
    queryKey: ["rm-sessions", user?.id, activeWeekend?.id ?? null, activeCar?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("sessions")
        .select("id,name,started_at,ended_at,session_type,track,driver,weather,fuel_start_l,fuel_end_l,air_temp_c,track_temp_c,car_id,event_id,setup_id")
        .order("started_at", { ascending: false }).limit(25);
      if (activeWeekend?.id) q = q.eq("event_id", activeWeekend.id);
      if (activeCar?.id) q = q.eq("car_id", activeCar.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Sess[];
    },
  });
  const sessions = sessionsQ.data ?? [];
  const session = useMemo<Sess | null>(() => {
    if (manualSessionId) return sessions.find((s) => s.id === manualSessionId) ?? null;
    if (activeSession?.id) return sessions.find((s) => s.id === activeSession.id) ?? sessions[0] ?? null;
    return sessions[0] ?? null;
  }, [sessions, manualSessionId, activeSession?.id]);

  const sessionId = session?.id ?? "";
  const [targets, setTargets] = useTargets(sessionId || null);

  // Live laps poll
  const lapsQ = useQuery({
    queryKey: ["rm-laps", sessionId],
    enabled: !!sessionId,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase.from("laps")
        .select("id,session_id,lap_time_ms,lap_number,recorded_at")
        .eq("session_id", sessionId).order("recorded_at");
      if (error) throw error;
      return data as Lap[];
    },
  });
  const laps = lapsQ.data ?? [];
  const last = laps[laps.length - 1] ?? null;
  const best = laps.length ? Math.min(...laps.map((l) => l.lap_time_ms)) : null;
  const delta = last && best ? last.lap_time_ms - best : null;
  const avg5 = laps.length ? Math.round(laps.slice(-5).reduce((s, l) => s + l.lap_time_ms, 0) / Math.min(5, laps.length)) : null;

  // Latest tyre log for context
  const tireQ = useQuery({
    queryKey: ["rm-tire", sessionId, activeCar?.id ?? null],
    enabled: !!user && !!(sessionId || activeCar?.id),
    queryFn: async () => {
      let q = supabase.from("tire_logs")
        .select("id,tire_set,compound,cold_fl,cold_fr,cold_rl,cold_rr,hot_fl,hot_fr,hot_rl,hot_rr,recorded_at")
        .order("recorded_at", { ascending: false }).limit(1);
      if (sessionId) q = q.eq("session_id", sessionId);
      else if (activeCar?.id) q = q.eq("car_id", activeCar.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data?.[0] ?? null) as Tire | null;
    },
  });
  const tire = tireQ.data;

  // Feedback for active session
  const feedbackQ = useQuery({
    queryKey: ["rm-feedback", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_feedback")
        .select("id,description,category,severity,balance,recorded_at")
        .eq("session_id", sessionId).order("recorded_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data as Feedback[];
    },
  });

  // Engineering priorities
  const prioritiesQ = useQuery({
    queryKey: ["rm-priorities", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("engineering_memory")
        .select("id,title,category,priority,detail,last_observed_at")
        .eq("status", "active")
        .in("priority", ["critical", "testing"])
        .order("last_observed_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data as Priority[];
    },
  });

  // ─────────── stopwatch + log lap ───────────
  const [swStart, setSwStart] = useState<number | null>(null);
  const [swFrozen, setSwFrozen] = useState(0);
  const swMs = swStart != null ? Date.now() - swStart : swFrozen;

  // Smooth re-render while the stopwatch is running so the tenths/hundredths
  // don't jump in 1s steps from the slow page tick.
  useEffect(() => {
    if (swStart == null) return;
    let raf = 0;
    const loop = () => { setTick((t) => t + 1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [swStart]);

  const logLap = useMutation({
    mutationFn: async (ms: number) => {
      if (!session || !user) throw new Error("No active session");
      const payload = {
        session_id: session.id, car_id: session.car_id,
        setup_id: session.setup_id ?? null, user_id: user.id,
        lap_time_ms: Math.max(1, Math.round(ms)),
        lap_number: (laps[laps.length - 1]?.lap_number ?? laps.length) + 1,
      };
      const { error } = await supabase.from("laps").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rm-laps", sessionId] });
      toast.success("Lap logged");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─────────── session countdown / fuel projection ───────────
  const sessionStart = session ? new Date(session.started_at).getTime() : 0;
  const sessionEnd = sessionStart + targets.sessionLen * 60_000;
  const remainingMs = Math.max(0, sessionEnd - Date.now());
  const lapsRemaining = useMemo(() => {
    if (!session?.fuel_start_l || !targets.fuelPerLap) return null;
    const used = laps.length * targets.fuelPerLap;
    const fuelNow = Math.max(0, session.fuel_start_l - used);
    return Math.floor(Math.max(0, fuelNow - targets.fuelReserve) / targets.fuelPerLap);
  }, [session, laps.length, targets.fuelPerLap, targets.fuelReserve]);

  const requestFs = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };

  // ─────────── render ───────────
  return (
    <div className="-mx-4 -my-4 min-h-[100vh] bg-black text-white select-none touch-manipulation"
         style={{ paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      {/* Top bar */}
      <div className="sticky top-12 z-30 bg-black/95 backdrop-blur border-b-2 border-[#ffe600] px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.2em] text-[#ffe600] shrink-0">
            <Radio className="w-3 h-3" /> Race mode
          </span>
          {sessions.length > 0 ? (
            <div className="flex items-center gap-1 min-w-0">
              <select
                value={session?.id ?? ""}
                onChange={(e) => setManualSessionId(e.target.value)}
                className="bg-transparent text-sm font-mono uppercase tracking-wider text-white/85 outline-none truncate max-w-[180px] sm:max-w-[260px]"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id} className="bg-black">
                    {s.name}{s.track ? ` · ${s.track}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-white/40 shrink-0" />
            </div>
          ) : (
            <span className="text-[11px] font-mono uppercase tracking-widest text-white/40 truncate">
              {activeWeekend ? "No sessions yet" : "No active weekend"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setShowSettings(true)} aria-label="Targets"
                  className="h-11 w-11 rounded-md border border-white/10 active:bg-white/10 flex items-center justify-center">
            <Settings2 className="w-5 h-5" />
          </button>
          <button onClick={requestFs} aria-label="Fullscreen"
                  className="h-11 w-11 rounded-md border border-white/10 active:bg-white/10 flex items-center justify-center">
            <Maximize2 className="w-5 h-5" />
          </button>
          <Link to="/weekends" aria-label="Exit"
                className="h-11 w-11 rounded-md border border-white/10 active:bg-white/10 flex items-center justify-center">
            <X className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Active-context strip */}
      <div className="px-3 py-1.5 border-b border-white/10 text-[10px] font-mono uppercase tracking-[0.2em] text-white/50 truncate">
        {activeWeekend ? (
          <>
            <span className="text-[#ffe600]">Wknd:</span>{" "}{activeWeekend.title}
            {activeCar?.name && <> · <span className="text-[#ffe600]">Car:</span> {activeCar.name}</>}
            {session?.driver && <> · <span className="text-[#ffe600]">Drv:</span> {session.driver}</>}
          </>
        ) : "No active weekend selected"}
      </div>

      {/* Body */}
      <div className="px-3 py-3">
        {!activeWeekend ? (
          <div className="mt-6 -mx-3 px-3">
            <NoActiveWeekendEmpty hint="Race Mode locks onto your active weekend. Pick or create one to start." />
          </div>
        ) : !session ? (
          <div className="mt-6 text-center text-white/60 text-sm">
            No session for this weekend yet.{" "}
            <Link to="/sessions" className="underline text-[#ffe600]">Start one</Link>.
          </div>
        ) : (
          <>
            {tab === "live" && (
              <LiveTab
                session={session} last={last} best={best} delta={delta}
                avg5={avg5} lapsCount={laps.length}
                remainingMs={remainingMs} sessionLenMin={targets.sessionLen}
                swMs={swMs} swRunning={swStart != null}
                onStartStop={() => {
                  if (swStart == null) { setSwStart(Date.now()); setSwFrozen(0); }
                  else { setSwFrozen(Date.now() - swStart); setSwStart(null); }
                }}
                onLogLap={() => {
                  const ms = swMs;
                  if (ms <= 0) return;
                  logLap.mutate(ms);
                  setSwStart(Date.now()); setSwFrozen(0);
                }}
                logging={logLap.isPending}
              />
            )}
            {tab === "tyres" && (
              <TyresTab session={session} tire={tire ?? null} targets={targets} userId={user!.id}
                        onSaved={() => qc.invalidateQueries({ queryKey: ["rm-tire"] })} />
            )}
            {tab === "fuel" && (
              <FuelTab session={session} targets={targets} setTargets={setTargets}
                       lapsCount={laps.length} lapsRemaining={lapsRemaining}
                       onFuelStartChange={() => qc.invalidateQueries({ queryKey: ["rm-sessions"] })} />
            )}
            {tab === "feedback" && (
              <FeedbackTab session={session} userId={user!.id}
                           items={feedbackQ.data ?? []} loading={feedbackQ.isLoading}
                           onSaved={() => qc.invalidateQueries({ queryKey: ["rm-feedback", sessionId] })} />
            )}
            {tab === "priorities" && (
              <PrioritiesTab items={prioritiesQ.data ?? []} loading={prioritiesQ.isLoading}
                             onChanged={() => qc.invalidateQueries({ queryKey: ["rm-priorities"] })} />
            )}
          </>
        )}
      </div>

      {/* Sticky bottom tab bar — thumb-reach, one-handed */}
      <nav
        aria-label="Race Mode tabs"
        className="fixed bottom-0 inset-x-0 z-40 bg-black border-t-2 border-[#ffe600]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="grid grid-cols-5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <li key={t.key}>
                <button
                  onClick={() => setTab(t.key)}
                  aria-current={active ? "page" : undefined}
                  className={`w-full flex flex-col items-center justify-center gap-1 h-[72px] text-[10px] font-mono uppercase tracking-widest active:bg-white/10 transition ${
                    active ? "text-[#ffe600]" : "text-white/55"
                  }`}
                >
                  {active && <span aria-hidden className="absolute top-0 h-[3px] w-10 rounded-b bg-[#ffe600]" />}
                  <Icon className="w-6 h-6" />
                  <span>{t.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {showSettings && (
        <SettingsSheet targets={targets} onSave={setTargets} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

const TABS: Array<{ key: TabKey; label: string; icon: typeof Flag }> = [
  { key: "live",       label: "Live",      icon: Flag },
  { key: "tyres",      label: "Tyres",     icon: Disc },
  { key: "fuel",       label: "Fuel",      icon: Fuel },
  { key: "feedback",   label: "Feedback",  icon: MessageSquare },
  { key: "priorities", label: "Priorities", icon: AlertTriangle },
];

// ─────────────── Live tab ───────────────
function LiveTab(props: {
  session: Sess; last: Lap | null; best: number | null; delta: number | null;
  avg5: number | null; lapsCount: number;
  remainingMs: number; sessionLenMin: number;
  swMs: number; swRunning: boolean;
  onStartStop: () => void; onLogLap: () => void; logging: boolean;
}) {
  const { session, last, best, delta, avg5, lapsCount, remainingMs, sessionLenMin, swMs, swRunning, onStartStop, onLogLap, logging } = props;
  return (
    <div className="space-y-3">
      {/* Hero — last lap + delta */}
      <div className="rounded-xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 p-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/50">Last lap</div>
        <div className="flex items-baseline gap-4 flex-wrap mt-1">
          <div className="font-mono tabular-nums leading-none font-semibold"
               style={{ fontSize: "clamp(56px, 14vw, 140px)" }}>
            {last ? formatLapTime(last.lap_time_ms) : "--:--.---"}
          </div>
          <div className="font-mono tabular-nums leading-none"
               style={{ fontSize: "clamp(28px, 7vw, 64px)",
                        color: delta == null ? "rgba(255,255,255,0.4)"
                             : delta === 0 ? "#22ff7a" : delta > 0 ? "#ff3b3b" : "#22ff7a" }}>
            {delta == null ? "Δ —" : delta === 0 ? "★ BEST" : `${delta > 0 ? "+" : ""}${(delta / 1000).toFixed(3)}`}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Stat label="Best" value={best != null ? formatLapTime(best) : "—"} tone="#22ff7a" />
          <Stat label="Avg 5" value={avg5 != null ? formatLapTime(avg5) : "—"} />
          <Stat label="Laps" value={String(lapsCount)} />
        </div>
      </div>

      {/* Countdown */}
      <div className="rounded-xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 p-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/50 flex items-center gap-1">
          <Flag className="w-3 h-3" /> Session countdown
        </div>
        <div className="font-mono tabular-nums leading-none font-semibold mt-1"
             style={{ fontSize: "clamp(48px, 13vw, 120px)",
                      color: remainingMs < 60_000 ? "#ff3b3b" : remainingMs < 300_000 ? "#ffe600" : "white" }}>
          {fmtMmSs(remainingMs)}
        </div>
        <div className="mt-2 h-2 rounded bg-white/10 overflow-hidden">
          <div className="h-full bg-[#ffe600]"
               style={{ width: `${100 - Math.min(100, (remainingMs / (sessionLenMin * 60_000)) * 100)}%` }} />
        </div>
        <div className="mt-2 text-[11px] font-mono uppercase tracking-[0.15em] text-white/60 truncate">
          {session.driver ?? "Driver"} · {session.track ?? "Track"} · {sessionLenMin} min
        </div>
      </div>

      {/* Stopwatch + log lap */}
      <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 grid grid-cols-1 gap-2">
        <div className="rounded-lg bg-black/50 border border-white/10 p-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/50 flex items-center gap-1">
            <TimerIcon className="w-3 h-3" /> Stopwatch · pit / lap
          </div>
          <div className="font-mono tabular-nums leading-none font-semibold mt-1 text-center"
               style={{ fontSize: "clamp(48px, 11vw, 96px)", color: swRunning ? "#22ff7a" : "white" }}>
            {fmtStopwatch(swMs)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onStartStop}
            className="rounded-lg text-xl font-mono uppercase tracking-[0.2em] active:scale-[0.98] transition-transform border-2"
            style={{
              background: swRunning ? "#ff3b3b" : "#22ff7a",
              color: "black", borderColor: "rgba(0,0,0,0.2)", minHeight: 88,
            }}
          >
            {swRunning
              ? <span className="inline-flex items-center gap-2"><Square className="w-6 h-6" /> Stop</span>
              : <span className="inline-flex items-center gap-2"><Play className="w-6 h-6" /> Start</span>}
          </button>
          <button
            disabled={swMs <= 0 || logging}
            onClick={onLogLap}
            className="rounded-lg text-xl font-mono uppercase tracking-[0.2em] active:scale-[0.98] transition-transform border-2 disabled:opacity-40"
            style={{ background: "#ffe600", color: "black", borderColor: "rgba(0,0,0,0.2)", minHeight: 88 }}
          >
            {logging
              ? <Loader2 className="w-6 h-6 animate-spin" />
              : <span className="inline-flex items-center gap-2"><Plus className="w-6 h-6" /> Log lap</span>}
          </button>
        </div>
      </div>

      {/* Weather strip */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Air" value={session.air_temp_c != null ? `${session.air_temp_c.toFixed(0)}°` : "—"} />
        <Stat label="Track" value={session.track_temp_c != null ? `${session.track_temp_c.toFixed(0)}°` : "—"} />
        <Stat label="Weather" value={session.weather ?? "—"} />
      </div>
    </div>
  );
}

// ─────────────── Tyres tab ───────────────
function TyresTab({ session, tire, targets, userId, onSaved }: {
  session: Sess; tire: Tire | null; targets: Targets; userId: string; onSaved: () => void;
}) {
  const initial = useMemo(() => ({
    hot_fl: tire?.hot_fl ?? targets.tyreTarget,
    hot_fr: tire?.hot_fr ?? targets.tyreTarget,
    hot_rl: tire?.hot_rl ?? targets.tyreTarget,
    hot_rr: tire?.hot_rr ?? targets.tyreTarget,
  }), [tire, targets.tyreTarget]);
  const [press, setPress] = useState<Record<string, number>>(initial);
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current && tire == null) return;
    initRef.current = true;
    setPress(initial);
  }, [initial, tire]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: userId, car_id: session.car_id,
        session_id: session.id,
        event_id: session.event_id ?? null,
        setup_id: session.setup_id ?? null,
        tire_set: tire?.tire_set ?? "Race mode log",
        compound: tire?.compound ?? null,
        hot_fl: press.hot_fl, hot_fr: press.hot_fr, hot_rl: press.hot_rl, hot_rr: press.hot_rr,
        cold_fl: tire?.cold_fl ?? null, cold_fr: tire?.cold_fr ?? null,
        cold_rl: tire?.cold_rl ?? null, cold_rr: tire?.cold_rr ?? null,
        notes: "Logged from Race Mode",
      };
      const { error } = await supabase.from("tire_logs").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pressures logged"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/60 flex items-center gap-1 min-w-0 truncate">
          <Disc className="w-3 h-3 shrink-0" /> Target {targets.tyreTarget.toFixed(1)} ± {targets.tyreTol.toFixed(1)} psi
          {tire?.tire_set && <span className="ml-2 text-white/40 truncate">· {tire.tire_set}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {([
          { k: "hot_fl", label: "FL" }, { k: "hot_fr", label: "FR" },
          { k: "hot_rl", label: "RL" }, { k: "hot_rr", label: "RR" },
        ] as const).map((c) => {
          const v = press[c.k];
          const d = v - targets.tyreTarget;
          const tone = Math.abs(d) <= targets.tyreTol ? "#22ff7a"
                     : Math.abs(d) <= targets.tyreTol * 2 ? "#ffe600" : "#ff3b3b";
          return (
            <div key={c.k} className="rounded-lg bg-black/50 border border-white/10 p-3">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-mono font-black text-[#ffe600]">{c.label}</div>
                <div className="text-4xl font-mono tabular-nums font-black" style={{ color: tone }}>
                  {v.toFixed(1)}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[-1, -0.1, 0.1, 1].map((step) => (
                  <button key={step}
                    onClick={() => setPress((p) => ({ ...p, [c.k]: +(p[c.k] + step).toFixed(2) }))}
                    className="h-12 rounded-md bg-white/10 active:bg-white/20 text-base font-mono font-bold">
                    {step > 0 ? "+" : ""}{step}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[10px] font-mono uppercase tracking-widest text-white/40 text-right">
                Δ {d > 0 ? "+" : ""}{d.toFixed(1)} psi
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={() => save.mutate()} disabled={save.isPending}
        className="w-full h-16 rounded-lg font-mono uppercase tracking-widest font-bold active:scale-[0.98] transition disabled:opacity-50"
        style={{ background: "#ffe600", color: "black" }}>
        {save.isPending ? <Loader2 className="w-6 h-6 animate-spin inline" />
          : <span className="inline-flex items-center gap-2"><Save className="w-6 h-6" /> Log to tyre history</span>}
      </button>
    </div>
  );
}

// ─────────────── Fuel tab ───────────────
function FuelTab({ session, targets, setTargets, lapsCount, lapsRemaining, onFuelStartChange }: {
  session: Sess; targets: Targets; setTargets: (t: Targets) => void;
  lapsCount: number; lapsRemaining: number | null; onFuelStartChange: () => void;
}) {
  const [fuelStart, setFuelStart] = useState<number>(session.fuel_start_l ?? 40);
  useEffect(() => { setFuelStart(session.fuel_start_l ?? 40); }, [session.id, session.fuel_start_l]);
  const used = lapsCount * targets.fuelPerLap;
  const estNow = Math.max(0, fuelStart - used);

  const saveStart = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sessions").update({ fuel_start_l: fuelStart }).eq("id", session.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Fuel start saved"); onFuelStartChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const tone = lapsRemaining == null ? "white"
    : lapsRemaining <= 2 ? "#ff3b3b" : lapsRemaining <= 5 ? "#ffe600" : "#22ff7a";

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 p-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/50">Laps remaining</div>
        <div className="font-mono tabular-nums leading-none font-black mt-1 text-center"
             style={{ fontSize: "clamp(72px, 22vw, 180px)", color: tone }}>
          {lapsRemaining != null ? lapsRemaining : "—"}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Stat label="Used" value={`${used.toFixed(1)} L`} />
          <Stat label="Est now" value={`${estNow.toFixed(1)} L`} />
          <Stat label="L/lap" value={targets.fuelPerLap.toFixed(2)} />
        </div>
      </div>

      <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 space-y-3">
        <FuelStepper label="Fuel start (L)" value={fuelStart} step={1} fineStep={0.5}
                     onChange={(v) => setFuelStart(Math.max(0, v))} fmt={(v) => v.toFixed(1)} />
        <button onClick={() => saveStart.mutate()} disabled={saveStart.isPending}
          className="w-full h-12 rounded-md font-mono uppercase tracking-widest text-sm font-bold active:scale-[0.98] disabled:opacity-50"
          style={{ background: "#ffe600", color: "black" }}>
          {saveStart.isPending ? <Loader2 className="w-5 h-5 animate-spin inline" />
            : <span className="inline-flex items-center gap-2"><Save className="w-5 h-5" /> Save to session</span>}
        </button>
      </div>

      <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/50">Targets</div>
        <FuelStepper label="L per lap" value={targets.fuelPerLap} step={0.1} fineStep={0.05}
                     onChange={(v) => setTargets({ ...targets, fuelPerLap: Math.max(0, +v.toFixed(2)) })} fmt={(v) => v.toFixed(2)} />
        <FuelStepper label="Reserve (L)" value={targets.fuelReserve} step={0.5} fineStep={0.1}
                     onChange={(v) => setTargets({ ...targets, fuelReserve: Math.max(0, +v.toFixed(1)) })} fmt={(v) => v.toFixed(1)} />
      </div>
    </div>
  );
}

function FuelStepper({ label, value, step, fineStep, onChange, fmt }: {
  label: string; value: number; step: number; fineStep: number;
  onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <div>
      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/60 mb-1">{label}</div>
      <div className="grid grid-cols-[56px_56px_1fr_56px_56px] gap-2 items-stretch">
        <button onClick={() => onChange(value - step)} className="h-14 rounded-md bg-white/10 active:bg-white/20 flex items-center justify-center text-base font-mono">−{step}</button>
        <button onClick={() => onChange(value - fineStep)} className="h-14 rounded-md bg-white/10 active:bg-white/20 flex items-center justify-center text-xs font-mono">−{fineStep}</button>
        <div className="rounded-md bg-black border-2 border-white/20 flex items-center justify-center text-3xl font-mono tabular-nums font-black">{fmt(value)}</div>
        <button onClick={() => onChange(value + fineStep)} className="h-14 rounded-md bg-white/10 active:bg-white/20 flex items-center justify-center text-xs font-mono">+{fineStep}</button>
        <button onClick={() => onChange(value + step)} className="h-14 rounded-md bg-white/10 active:bg-white/20 flex items-center justify-center text-base font-mono">+{step}</button>
      </div>
    </div>
  );
}

// ─────────────── Feedback tab ───────────────
const FB_CATEGORIES = ["balance", "tyres", "brakes", "engine", "aero", "other"] as const;
const FB_SEVERITY = ["info", "minor", "major"] as const;
const FB_BALANCE = ["understeer", "neutral", "oversteer"] as const;

function FeedbackTab({ session, userId, items, loading, onSaved }: {
  session: Sess; userId: string; items: Feedback[]; loading: boolean; onSaved: () => void;
}) {
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState<(typeof FB_CATEGORIES)[number]>("balance");
  const [sev, setSev] = useState<(typeof FB_SEVERITY)[number]>("info");
  const [bal, setBal] = useState<"" | (typeof FB_BALANCE)[number]>("");

  const save = useMutation({
    mutationFn: async () => {
      const text = desc.trim();
      if (!text) throw new Error("Add a quick description");
      const payload = {
        user_id: userId, car_id: session.car_id,
        session_id: session.id, setup_id: session.setup_id ?? null,
        category: cat, severity: sev, balance: bal || null,
        description: text, tags: ["race-mode"],
      };
      const { error } = await supabase.from("driver_feedback").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Feedback logged"); setDesc(""); setBal(""); setSev("info"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <textarea
        value={desc} onChange={(e) => setDesc(e.target.value)}
        placeholder="e.g. Locking FL into T4 on entry. Push the bias rearward 0.5%."
        className="w-full h-32 rounded-lg bg-black border-2 border-white/20 focus:border-[#ffe600] outline-none p-3 text-lg font-mono"
      />

      <ChipRow label="Category" value={cat} options={FB_CATEGORIES} onChange={setCat} />
      <ChipRow label="Severity" value={sev} options={FB_SEVERITY} onChange={setSev}
               toneFor={(o) => o === "major" ? "#ff3b3b" : o === "minor" ? "#ffe600" : undefined} />
      <ChipRow label="Balance" value={bal} options={["", ...FB_BALANCE] as const}
               onChange={(v) => setBal(v as typeof bal)} labelFor={(o) => o === "" ? "—" : o} />

      <button onClick={() => save.mutate()} disabled={save.isPending || !desc.trim()}
        className="w-full h-16 rounded-lg font-mono uppercase tracking-widest font-bold active:scale-[0.98] transition disabled:opacity-40"
        style={{ background: "#ffe600", color: "black" }}>
        {save.isPending ? <Loader2 className="w-6 h-6 animate-spin inline" />
          : <span className="inline-flex items-center gap-2"><Save className="w-6 h-6" /> Log to debrief</span>}
      </button>

      <div className="pt-2">
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/50 mb-2">
          This session ({items.length})
        </div>
        {loading ? (
          <div className="text-white/40 text-sm font-mono">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-white/40 text-sm font-mono">No feedback yet</div>
        ) : (
          <ul className="space-y-2">
            {items.map((f) => (
              <li key={f.id} className="rounded-md border border-white/10 bg-black/40 p-2.5">
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-white/50">
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/80">{f.category}</span>
                  <span style={{ color: f.severity === "major" ? "#ff3b3b" : f.severity === "minor" ? "#ffe600" : "white" }}>{f.severity}</span>
                  {f.balance && <span>· {f.balance}</span>}
                  <span className="ml-auto">{new Date(f.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="mt-1 text-sm leading-snug">{f.description}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ChipRow<T extends string>({ label, value, options, onChange, labelFor, toneFor }: {
  label: string; value: T; options: readonly T[]; onChange: (v: T) => void;
  labelFor?: (o: T) => string; toneFor?: (o: T) => string | undefined;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/50 mb-1">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o === value;
          const tone = toneFor?.(o);
          return (
            <button key={o} onClick={() => onChange(o)}
              className={`h-11 px-4 rounded-md font-mono text-sm uppercase tracking-widest border ${
                active ? "border-[#ffe600] bg-[#ffe600] text-black" : "border-white/15 bg-white/[0.04] text-white/80 active:bg-white/10"
              }`}
              style={!active && tone ? { color: tone, borderColor: `${tone}66` } : undefined}>
              {labelFor ? labelFor(o) : o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────── Priorities tab ───────────────
function PrioritiesTab({ items, loading, onChanged }: {
  items: Priority[]; loading: boolean; onChanged: () => void;
}) {
  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("engineering_memory").update({ status: "resolved" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marked resolved"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="text-white/40 text-sm font-mono">Loading…</div>;
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto text-white/30" />
        <div className="mt-3 text-sm text-white/60 font-mono">No active priorities</div>
        <div className="mt-1 text-xs text-white/40">Things flagged critical or under test land here.</div>
        <Link to="/engineering-memory"
              className="inline-block mt-4 px-4 py-2 rounded-md bg-[#ffe600] text-black font-mono text-xs uppercase tracking-widest">
          Open memory
        </Link>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((p) => (
        <li key={p.id} className={`rounded-lg border p-3 ${
          p.priority === "critical" ? "border-[#ff3b3b]/50 bg-[#ff3b3b]/[0.06]" : "border-[#ffe600]/40 bg-[#ffe600]/[0.05]"
        }`}>
          <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest ${
              p.priority === "critical" ? "bg-[#ff3b3b] text-black" : "bg-[#ffe600] text-black"
            }`}>{p.priority}</span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/50">{p.category}</span>
          </div>
          <div className="mt-1 font-semibold text-base leading-snug">{p.title}</div>
          {p.detail && <p className="mt-1 text-sm text-white/70 leading-snug">{p.detail}</p>}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
              Seen {new Date(p.last_observed_at).toLocaleDateString()}
            </span>
            <button onClick={() => resolve.mutate(p.id)} disabled={resolve.isPending}
              className="h-10 px-4 rounded-md bg-white/10 active:bg-white/20 text-xs font-mono uppercase tracking-widest disabled:opacity-50">
              Resolve
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─────────────── Settings sheet ───────────────
function SettingsSheet({ targets, onSave, onClose }: {
  targets: Targets; onSave: (t: Targets) => void; onClose: () => void;
}) {
  const [t, setT] = useState<Targets>(targets);
  const bump = (k: keyof Targets, d: number) => setT((p) => ({ ...p, [k]: Math.max(0, +(p[k] + d).toFixed(2)) }));
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-neutral-950 border border-white/20 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-4 text-white"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Targets</h3>
          <button onClick={onClose} className="h-11 w-11 flex items-center justify-center rounded-md border border-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <StepperRow label="Tyre target (psi)"   value={t.tyreTarget.toFixed(1)}  onDec={() => bump("tyreTarget", -0.5)}  onInc={() => bump("tyreTarget", 0.5)} />
          <StepperRow label="Tyre tolerance ±"    value={t.tyreTol.toFixed(1)}     onDec={() => bump("tyreTol", -0.1)}     onInc={() => bump("tyreTol", 0.1)} />
          <StepperRow label="Fuel L per lap"      value={t.fuelPerLap.toFixed(2)}  onDec={() => bump("fuelPerLap", -0.1)}  onInc={() => bump("fuelPerLap", 0.1)} />
          <StepperRow label="Fuel reserve (L)"    value={t.fuelReserve.toFixed(1)} onDec={() => bump("fuelReserve", -0.5)} onInc={() => bump("fuelReserve", 0.5)} />
          <StepperRow label="Session length (min)" value={String(t.sessionLen)}    onDec={() => bump("sessionLen", -5)}    onInc={() => bump("sessionLen", 5)} />
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

// ─────────────── shared bits ───────────────
function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-black/40 border border-white/10 px-3 py-2">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/50">{label}</div>
      <div className="font-mono tabular-nums text-2xl mt-0.5 truncate" style={{ color: tone }}>{value}</div>
    </div>
  );
}

function fmtMmSs(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function fmtStopwatch(ms: number) {
  const total = Math.floor(ms / 10);
  const cs = total % 100;
  const sT = Math.floor(total / 100);
  const s = sT % 60;
  const m = Math.floor(sT / 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}