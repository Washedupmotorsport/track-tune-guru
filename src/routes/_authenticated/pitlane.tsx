import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Play, Pause, RotateCcw, Plus, Minus, Save, Fuel, Disc,
  Sliders, NotebookPen, Timer, ArrowLeft, Flag,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pitlane")({
  head: () => ({
    meta: [
      { title: "Pit Lane — My Race Engineer" },
      { name: "description", content: "High-contrast pit lane mode: giant readouts, huge touch targets, tyre pressures, fuel calc, brake bias, stopwatch." },
    ],
  }),
  component: PitLaneMode,
});

type Car = { id: string; name: string };
type Setup = { id: string; name: string; setup_data: Record<string, number | string | null> };
type TireLog = {
  id: string; tire_set: string; compound: string | null;
  hot_fl: number | null; hot_fr: number | null; hot_rl: number | null; hot_rr: number | null;
  cold_fl: number | null; cold_fr: number | null; cold_rl: number | null; cold_rr: number | null;
};
type Lap = { lap_time_ms: number; recorded_at: string; lap_number: number | null };

const CORNERS = [
  { key: "hot_fl", label: "FL" },
  { key: "hot_fr", label: "FR" },
  { key: "hot_rl", label: "RL" },
  { key: "hot_rr", label: "RR" },
] as const;

function fmtLap(ms: number | null | undefined) {
  if (!ms || ms <= 0) return "—:——.———";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const t = ms % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(t).padStart(3, "0")}`;
}

function PitLaneMode() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // ---------- Data ----------
  const carsQ = useQuery({
    queryKey: ["pitlane-cars", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cars").select("id,name").order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Car[];
    },
  });

  const [carId, setCarId] = useState<string | null>(null);
  useEffect(() => {
    if (!carId && carsQ.data?.[0]) setCarId(carsQ.data[0].id);
  }, [carsQ.data, carId]);

  const setupQ = useQuery({
    queryKey: ["pitlane-setup", carId],
    enabled: !!carId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setups").select("id,name,setup_data")
        .eq("car_id", carId!).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return (data ?? null) as Setup | null;
    },
  });

  const tireQ = useQuery({
    queryKey: ["pitlane-tires", carId],
    enabled: !!carId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tire_logs")
        .select("id,tire_set,compound,hot_fl,hot_fr,hot_rl,hot_rr,cold_fl,cold_fr,cold_rl,cold_rr")
        .eq("car_id", carId!).order("recorded_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return (data ?? null) as TireLog | null;
    },
  });

  const lapsQ = useQuery({
    queryKey: ["pitlane-laps", carId],
    enabled: !!carId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("laps").select("lap_time_ms,recorded_at,lap_number")
        .eq("car_id", carId!).order("recorded_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as Lap[];
    },
  });

  // Local stopwatch laps are declared below; combine with persisted laps
  // so the top readouts reflect what the user is timing right now.

  // ---------- Local editable state ----------
  const [press, setPress] = useState<Record<string, number>>({ hot_fl: 0, hot_fr: 0, hot_rl: 0, hot_rr: 0 });
  useEffect(() => {
    if (tireQ.data) {
      setPress({
        hot_fl: Number(tireQ.data.hot_fl ?? 0),
        hot_fr: Number(tireQ.data.hot_fr ?? 0),
        hot_rl: Number(tireQ.data.hot_rl ?? 0),
        hot_rr: Number(tireQ.data.hot_rr ?? 0),
      });
    }
  }, [tireQ.data]);

  const [bias, setBias] = useState<number>(55);
  useEffect(() => {
    const b = Number(setupQ.data?.setup_data?.brake_bias ?? 55);
    setBias(Number.isFinite(b) && b > 0 ? b : 55);
  }, [setupQ.data]);

  // Fuel calculator
  const [fuelL, setFuelL] = useState<number>(40);
  const [consL, setConsL] = useState<number>(2.6);
  const lapsLeft = consL > 0 ? fuelL / consL : 0;

  // Stopwatch / session timer
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const [lapStart, setLapStart] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);

  const lastLap = laps[0] ?? lapsQ.data?.[0]?.lap_time_ms ?? null;
  const bestLap = useMemo(() => {
    const all = [...laps, ...((lapsQ.data ?? []).map((l) => l.lap_time_ms))];
    return all.reduce<number | null>((b, ms) => (b === null || ms < b ? ms : b), null);
  }, [laps, lapsQ.data]);
  const lastDelta = lastLap !== null && bestLap !== null ? lastLap - bestLap : null;
  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now() - elapsed;
    const id = window.setInterval(() => {
      if (startRef.current !== null) setElapsed(Date.now() - startRef.current);
    }, 73);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const handleStartStop = () => {
    setRunning((r) => {
      if (!r && elapsed === 0) setLapStart(0);
      return !r;
    });
  };
  const handleReset = () => {
    setRunning(false);
    setElapsed(0);
    setLapStart(0);
    setLaps([]);
  };
  const handleLap = () => {
    if (!running) return;
    const lapTime = elapsed - lapStart;
    if (lapTime <= 0) return;
    setLaps((l) => [lapTime, ...l]);
    setLapStart(elapsed);
    toast.success(`Lap ${laps.length + 1}: ${fmtLap(lapTime)}`);
  };

  // Quick note
  const [note, setNote] = useState("");

  // ---------- Mutations ----------
  const savePressures = useMutation({
    mutationFn: async () => {
      if (!user || !carId) throw new Error("No car");
      const base = tireQ.data;
      const payload = {
        user_id: user.id,
        car_id: carId,
        setup_id: setupQ.data?.id ?? null,
        tire_set: base?.tire_set ?? "Pit edit",
        compound: base?.compound ?? null,
        hot_fl: press.hot_fl, hot_fr: press.hot_fr, hot_rl: press.hot_rl, hot_rr: press.hot_rr,
        cold_fl: base?.cold_fl ?? null, cold_fr: base?.cold_fr ?? null,
        cold_rl: base?.cold_rl ?? null, cold_rr: base?.cold_rr ?? null,
        notes: "Pit lane quick edit",
      };
      const { error } = await supabase.from("tire_logs").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pressures logged");
      qc.invalidateQueries({ queryKey: ["pitlane-tires", carId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveBias = useMutation({
    mutationFn: async () => {
      if (!setupQ.data) throw new Error("No setup");
      const next = { ...(setupQ.data.setup_data || {}), brake_bias: bias };
      const { error } = await supabase.from("setups").update({ setup_data: next }).eq("id", setupQ.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Bias saved: ${bias.toFixed(1)}% F`);
      qc.invalidateQueries({ queryKey: ["pitlane-setup", carId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNote = useMutation({
    mutationFn: async () => {
      if (!user || !note.trim()) throw new Error("Empty note");
      const { error } = await supabase.from("driver_notes").insert({
        user_id: user.id, car_id: carId, setup_id: setupQ.data?.id ?? null,
        title: `Pit note ${new Date().toLocaleTimeString()}`, body: note.trim(), tags: ["pit-lane"],
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Note saved"); setNote(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const car = carsQ.data?.find((c) => c.id === carId);

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-black text-white">
      {/* Top bar — slim, high-contrast */}
      <header className="sticky top-12 z-20 bg-black border-b-4 border-yellow-400 px-3 py-2 flex items-center justify-between gap-2">
        <Link
          to="/pitwall"
          className="inline-flex items-center gap-2 h-12 px-4 rounded-md bg-white/10 hover:bg-white/20 text-base font-mono uppercase tracking-widest active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" /> Exit
        </Link>
        <div className="flex items-center gap-2 font-mono uppercase tracking-widest text-yellow-400 text-sm">
          <Flag className="w-4 h-4" /> Pit Lane Mode
        </div>
        <select
          value={carId ?? ""}
          onChange={(e) => setCarId(e.target.value)}
          className="h-12 rounded-md bg-white/10 text-white text-base font-mono uppercase px-3 border border-white/20"
        >
          {(carsQ.data ?? []).map((c) => (
            <option key={c.id} value={c.id} className="bg-black">{c.name}</option>
          ))}
        </select>
      </header>

      <div className="p-3 grid gap-3 md:grid-cols-2">
        {/* Telemetry — giant numbers */}
        <section className="md:col-span-2 rounded-xl bg-zinc-900 border-2 border-white/10 p-4">
          <div className="grid grid-cols-3 gap-3">
            <Readout label="Last lap" value={fmtLap(lastLap)} accent="text-yellow-300" />
            <Readout label="Best lap" value={fmtLap(bestLap)} accent="text-green-400" />
            <Readout
              label="Δ Best"
              value={lastDelta === null ? "—" : `${lastDelta >= 0 ? "+" : ""}${(lastDelta / 1000).toFixed(3)}s`}
              accent={lastDelta === null ? "text-white" : lastDelta <= 0 ? "text-green-400" : "text-red-400"}
            />
          </div>
          {car && <div className="mt-3 text-center text-xs font-mono uppercase tracking-[0.3em] text-white/50">{car.name} · {setupQ.data?.name ?? "no setup"}</div>}
        </section>

        {/* Stopwatch */}
        <section className="rounded-xl bg-zinc-900 border-2 border-white/10 p-4">
          <SectionTitle icon={Timer}>Session timer</SectionTitle>
          <div className="text-center font-mono tabular-nums text-6xl md:text-7xl font-black tracking-tight text-yellow-300 py-3">
            {fmtLap(elapsed)}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <BigBtn onClick={handleStartStop} tone={running ? "danger" : "primary"}>
              {running ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7" />}
              {running ? "Stop" : "Start"}
            </BigBtn>
            <BigBtn onClick={handleReset} tone="neutral">
              <RotateCcw className="w-7 h-7" /> Reset
            </BigBtn>
            <BigBtn onClick={handleLap} tone="neutral">
              <Flag className="w-7 h-7" /> Lap
            </BigBtn>
          </div>
          {laps.length > 0 && (
            <div className="mt-3 max-h-40 overflow-y-auto border-t border-white/10 pt-2">
              <table className="w-full text-sm font-mono">
                <tbody>
                  {laps.map((ms, i) => {
                    const n = laps.length - i;
                    return (
                      <tr key={n} className="border-b border-white/5">
                        <td className="py-1 text-white/50 w-12">#{n}</td>
                        <td className="py-1 text-right tabular-nums text-yellow-300">{fmtLap(ms)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Fuel calculator */}
        <section className="rounded-xl bg-zinc-900 border-2 border-white/10 p-4">
          <SectionTitle icon={Fuel}>Fuel</SectionTitle>
          <div className="text-center text-7xl font-mono tabular-nums font-black text-green-400 py-3">
            {lapsLeft.toFixed(1)}
            <span className="text-2xl ml-2 text-white/50">laps</span>
          </div>
          <Stepper label="Fuel (L)" value={fuelL} step={1} onChange={setFuelL} fmt={(v) => v.toFixed(0)} />
          <Stepper label="L / lap" value={consL} step={0.1} onChange={setConsL} fmt={(v) => v.toFixed(2)} />
        </section>

        {/* Tyre pressures */}
        <section className="md:col-span-2 rounded-xl bg-zinc-900 border-2 border-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <SectionTitle icon={Disc}>Tyre pressures (hot)</SectionTitle>
            <BigBtn onClick={() => savePressures.mutate()} tone="primary" compact>
              <Save className="w-6 h-6" /> Log
            </BigBtn>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {CORNERS.map((c) => (
              <PressurePad
                key={c.key}
                label={c.label}
                value={press[c.key]}
                onChange={(v) => setPress((p) => ({ ...p, [c.key]: v }))}
              />
            ))}
          </div>
        </section>

        {/* Brake bias */}
        <section className="rounded-xl bg-zinc-900 border-2 border-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <SectionTitle icon={Sliders}>Brake bias</SectionTitle>
            <BigBtn onClick={() => saveBias.mutate()} tone="primary" compact>
              <Save className="w-6 h-6" /> Save
            </BigBtn>
          </div>
          <div className="text-center text-7xl font-mono tabular-nums font-black py-3">
            <span className="text-yellow-300">{bias.toFixed(1)}</span>
            <span className="text-2xl text-white/50 ml-1">% F</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <BigBtn onClick={() => setBias((b) => Math.max(40, +(b - 1).toFixed(1)))} tone="neutral">−1.0</BigBtn>
            <BigBtn onClick={() => setBias((b) => Math.max(40, +(b - 0.1).toFixed(1)))} tone="neutral">−0.1</BigBtn>
            <BigBtn onClick={() => setBias((b) => Math.min(70, +(b + 0.1).toFixed(1)))} tone="neutral">+0.1</BigBtn>
            <BigBtn onClick={() => setBias((b) => Math.min(70, +(b + 1).toFixed(1)))} tone="neutral">+1.0</BigBtn>
          </div>
        </section>

        {/* Quick note */}
        <section className="rounded-xl bg-zinc-900 border-2 border-white/10 p-4">
          <SectionTitle icon={NotebookPen}>Quick setup note</SectionTitle>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Front locking T4, raise bias 0.5%…"
            className="w-full h-28 rounded-md bg-black text-white text-xl font-mono p-3 border-2 border-white/20 focus:border-yellow-400 outline-none"
          />
          <div className="mt-2">
            <BigBtn onClick={() => saveNote.mutate()} tone="primary" full>
              <Save className="w-7 h-7" /> Save note
            </BigBtn>
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------- Primitives ----------
function Readout({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] md:text-xs font-mono uppercase tracking-[0.3em] text-white/50">{label}</div>
      <div className={`font-mono tabular-nums font-black text-4xl md:text-6xl leading-none mt-1 ${accent}`}>{value}</div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-mono uppercase tracking-[0.3em] text-white/70">
      <Icon className="w-4 h-4 text-yellow-400" /> {children}
    </h2>
  );
}

function BigBtn({
  children, onClick, tone = "neutral", compact = false, full = false,
}: {
  children: React.ReactNode; onClick?: () => void;
  tone?: "primary" | "danger" | "neutral"; compact?: boolean; full?: boolean;
}) {
  const toneCls =
    tone === "primary" ? "bg-yellow-400 text-black hover:bg-yellow-300"
    : tone === "danger" ? "bg-red-500 text-white hover:bg-red-400"
    : "bg-white/10 text-white hover:bg-white/20 border border-white/20";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 ${compact ? "h-12 px-4 text-base" : "h-16 px-3 text-lg"} ${full ? "w-full" : ""} rounded-lg font-mono uppercase tracking-widest font-bold active:scale-95 transition ${toneCls}`}
    >
      {children}
    </button>
  );
}

function Stepper({
  label, value, step, onChange, fmt,
}: {
  label: string; value: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <div className="mt-2">
      <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-white/50 mb-1">{label}</div>
      <div className="grid grid-cols-[64px_1fr_64px] gap-2 items-stretch">
        <button
          onClick={() => onChange(Math.max(0, +(value - step).toFixed(2)))}
          className="rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="w-7 h-7" />
        </button>
        <div className="rounded-lg bg-black border-2 border-white/20 flex items-center justify-center text-4xl font-mono tabular-nums font-black">
          {fmt(value)}
        </div>
        <button
          onClick={() => onChange(+(value + step).toFixed(2))}
          className="rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center"
          aria-label={`Increase ${label}`}
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}

function PressurePad({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-lg bg-black border-2 border-white/20 p-3">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-mono font-black text-yellow-300">{label}</div>
        <div className="text-5xl font-mono tabular-nums font-black">{value.toFixed(1)}</div>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-2">
        <button onClick={() => onChange(+(value - 1).toFixed(1))} className="h-14 rounded-md bg-white/10 hover:bg-white/20 active:scale-95 text-xl font-mono font-bold">−1.0</button>
        <button onClick={() => onChange(+(value - 0.1).toFixed(1))} className="h-14 rounded-md bg-white/10 hover:bg-white/20 active:scale-95 text-xl font-mono font-bold">−0.1</button>
        <button onClick={() => onChange(+(value + 0.1).toFixed(1))} className="h-14 rounded-md bg-white/10 hover:bg-white/20 active:scale-95 text-xl font-mono font-bold">+0.1</button>
        <button onClick={() => onChange(+(value + 1).toFixed(1))} className="h-14 rounded-md bg-white/10 hover:bg-white/20 active:scale-95 text-xl font-mono font-bold">+1.0</button>
      </div>
    </div>
  );
}