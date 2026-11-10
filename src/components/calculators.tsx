import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWeekend } from "@/lib/active-weekend";
import {
  fuelCalc,
  lapsOnFuel,
  pressureCalc,
  wheelRate,
  suspensionFrequencyHz,
  rideHeightChangeMm,
  overallRatio,
  speedAtRpmKmh,
  speedDifferenceKmh,
  psiToKpa,
  kpaToPsi,
  parseGearbox,
  EMPTY_GEARBOX,
  type GearboxSpec,
} from "@/lib/calculators";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Fuel, Gauge, Cog, MoveVertical, Save } from "lucide-react";
import { toast } from "sonner";

// Shared bits ────────────────────────────────────────────────

function Num({
  label,
  value,
  onChange,
  unit,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="relative mt-1">
        <Input
          inputMode="decimal"
          value={value}
          placeholder={placeholder ?? "—"}
          onChange={(e) => onChange(e.target.value)}
          className={unit ? "pr-10" : undefined}
        />
        {unit && (
          <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">{unit}</span>
        )}
      </div>
    </label>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-mono text-muted-foreground rounded-md bg-muted/40 px-2 py-1.5">
      {children}
    </div>
  );
}

function Result({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="font-display text-sm font-bold">{value ?? "—"}</div>
    </div>
  );
}

const num = (s: string): number | null => {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const fmt = (v: number | null, dp = 2) => (v == null ? null : v.toFixed(dp));

// ───────────────────────── Fuel ─────────────────────────

export function FuelCalculator() {
  const [used, setUsed] = useState("");
  const [laps, setLaps] = useState("");
  const [length, setLength] = useState("");
  const [planned, setPlanned] = useState("");
  const [reserve, setReserve] = useState("");
  const [inTank, setInTank] = useState("");

  const r = useMemo(() => {
    const fuelUsedL = num(used),
      lapsCompleted = num(laps),
      plannedRaceLaps = num(planned),
      reserveL = num(reserve);
    if (fuelUsedL == null || lapsCompleted == null || plannedRaceLaps == null || reserveL == null)
      return null;
    return fuelCalc({
      fuelUsedL,
      lapsCompleted,
      circuitLengthKm: num(length),
      plannedRaceLaps,
      reserveL,
    });
  }, [used, laps, length, planned, reserve]);

  const remaining = useMemo(() => {
    const t = num(inTank);
    if (t == null || !r) return null;
    return lapsOnFuel(t, num(reserve) ?? 0, r.avgPerLapL);
  }, [inTank, reserve, r]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Num label="Fuel used" unit="L" value={used} onChange={setUsed} />
        <Num label="Laps completed" value={laps} onChange={setLaps} />
        <Num label="Circuit length" unit="km" value={length} onChange={setLength} />
        <Num label="Planned race laps" value={planned} onChange={setPlanned} />
        <Num label="Fuel reserve" unit="L" value={reserve} onChange={setReserve} />
        <Num label="Fuel in tank (optional)" unit="L" value={inTank} onChange={setInTank} />
      </div>
      <Formula>
        avg/lap = used ÷ laps · per km = used ÷ (laps × length) · race fuel = avg × planned +
        reserve · min reserve = 1 lap
      </Formula>
      {r ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Result label="Avg per lap" value={`${fmt(r.avgPerLapL)} L`} />
          <Result label="Per km" value={r.perKmL != null ? `${fmt(r.perKmL, 3)} L` : "no length"} />
          <Result label="Race fuel needed" value={`${fmt(r.raceRequirementL, 1)} L`} />
          <Result label="Min reserve" value={`${fmt(r.minReserveL)} L`} />
          <Result label="Race laps left" value={String(r.remainingRaceLaps)} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Enter fuel used, laps completed, planned laps and reserve to see results.
        </p>
      )}
      {remaining != null && (
        <div className="text-sm">
          Estimated laps on the fuel in the tank (above reserve): <strong>{remaining}</strong>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Tyre pressures ─────────────────────────

type Unit = "psi" | "kPa";

export function TyreCalculator() {
  const [unit, setUnit] = useState<Unit>("psi");
  const [vals, setVals] = useState<Record<string, { cold: string; hot: string }>>({
    FL: { cold: "", hot: "" },
    FR: { cold: "", hot: "" },
    RL: { cold: "", hot: "" },
    RR: { cold: "", hot: "" },
  });

  const r = useMemo(() => {
    const corners = Object.entries(vals).map(([label, v]) => ({
      label,
      cold: num(v.cold),
      hot: num(v.hot),
    }));
    if (!corners.some((c) => c.cold != null || c.hot != null)) return null;
    return pressureCalc(corners);
  }, [vals]);

  const convert = (target: Unit) => {
    if (target === unit) return;
    const f = target === "kPa" ? psiToKpa : kpaToPsi;
    setVals((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [
          k,
          {
            cold: v.cold && num(v.cold) != null ? f(Number(v.cold)).toFixed(1) : v.cold,
            hot: v.hot && num(v.hot) != null ? f(Number(v.hot)).toFixed(1) : v.hot,
          },
        ]),
      ),
    );
    setUnit(target);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Units
        </span>
        {(["psi", "kPa"] as Unit[]).map((u) => (
          <Button
            key={u}
            size="sm"
            variant={unit === u ? "default" : "outline"}
            onClick={() => convert(u)}
          >
            {u}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(["FL", "FR", "RL", "RR"] as const).map((c) => (
          <div key={c} className="rounded-md border border-border p-2 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {c}
            </div>
            <Num
              label={`Cold (${unit})`}
              value={vals[c].cold}
              onChange={(v) => setVals((p) => ({ ...p, [c]: { ...p[c], cold: v } }))}
            />
            <Num
              label={`Hot (${unit})`}
              value={vals[c].hot}
              onChange={(v) => setVals((p) => ({ ...p, [c]: { ...p[c], hot: v } }))}
            />
          </div>
        ))}
      </div>
      <Formula>
        gain = hot − cold · % increase = gain ÷ cold × 100 · spread = max − min across corners
      </Formula>
      {r ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {r.corners.map((c) => (
              <Result
                key={c.label}
                label={`${c.label} gain`}
                value={c.gain != null ? `+${fmt(c.gain, 1)} ${unit} (${fmt(c.gainPct, 1)}%)` : null}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Result
              label="Cold spread"
              value={r.maxColdSpread != null ? `${fmt(r.maxColdSpread, 1)} ${unit}` : null}
            />
            <Result
              label="Hot spread"
              value={r.maxHotSpread != null ? `${fmt(r.maxHotSpread, 1)} ${unit}` : null}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Enter at least one cold/hot pair. Target pressures are never predicted without
          tyre-specific data.
        </p>
      )}
    </div>
  );
}

// ───────────────────────── Suspension ─────────────────────────

function SuspensionCalculator() {
  const [spring, setSpring] = useState("");
  const [mr, setMr] = useState("");
  const [mass, setMass] = useState("");
  const [perch, setPerch] = useState("");

  const wr = useMemo(() => {
    const s = num(spring),
      m = num(mr);
    return s != null && m != null ? wheelRate(s, m) : null;
  }, [spring, mr]);

  const freq = useMemo(() => {
    const kg = num(mass);
    return wr != null && kg != null ? suspensionFrequencyHz(wr, kg) : null;
  }, [wr, mass]);

  const ride = useMemo(() => {
    const p = num(perch),
      m = num(mr);
    return p != null && m != null ? rideHeightChangeMm(p, m) : null;
  }, [perch, mr]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Num label="Spring rate" unit="N/mm" value={spring} onChange={setSpring} />
        <Num label="Motion ratio" value={mr} onChange={setMr} placeholder="e.g. 0.9" />
        <Num label="Sprung mass (corner)" unit="kg" value={mass} onChange={setMass} />
        <Num label="Perch adjustment" unit="mm" value={perch} onChange={setPerch} />
      </div>
      <Formula>
        wheel rate = spring × MR² · frequency = (1/2π)√(wheel rate ÷ sprung mass) · ride change =
        perch ÷ MR
      </Formula>
      <p className="text-[11px] text-muted-foreground">
        Assumptions: single-wheel model, damping ignored, linear spring. Sprung mass is the corner's
        share of sprung weight — measure or estimate it; it is never invented.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Result label="Wheel rate" value={wr != null ? `${fmt(wr)} N/mm` : null} />
        <Result label="Suspension freq" value={freq != null ? `${fmt(freq)} Hz` : null} />
        <Result label="Ride change @ wheel" value={ride != null ? `${fmt(ride, 1)} mm` : null} />
      </div>
    </div>
  );
}

// ───────────────────────── Gearing ─────────────────────────

function GearingCalculator() {
  const { activeCar } = useActiveWeekend();
  return <GearingForCar key={activeCar?.id ?? "none"} activeCar={activeCar} />;
}

function GearingForCar({ activeCar }: { activeCar: { id: string; name: string | null } | null }) {
  const qc = useQueryClient();
  const [spec, setSpec] = useState<GearboxSpec>(EMPTY_GEARBOX);
  const [rpm, setRpm] = useState("");
  const [gearA, setGearA] = useState("1");
  const [gearB, setGearB] = useState("2");

  const gearboxQ = useQuery({
    queryKey: ["car-gearbox", activeCar?.id],
    enabled: !!activeCar?.id,
    queryFn: async () => {
      if (!activeCar) return EMPTY_GEARBOX;
      const { data, error } = await supabase
        .from("cars")
        .select("gearbox")
        .eq("id", activeCar.id)
        .single();
      if (error) throw error;
      return parseGearbox(data?.gearbox);
    },
  });

  useEffect(() => {
    if (gearboxQ.data) setSpec(gearboxQ.data);
  }, [gearboxQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!activeCar || gearboxQ.isLoading || gearboxQ.isError)
        throw new Error("Wait for the selected car gearbox to load");
      const { error } = await supabase
        .from("cars")
        .update({ gearbox: spec })
        .eq("id", activeCar.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gearbox saved");
      qc.invalidateQueries({ queryKey: ["car-gearbox", activeCar?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const setGear = (i: number, ratio: string) =>
    setSpec((s) => ({
      ...s,
      gears: s.gears.map((g, gi) => (gi === i ? { ...g, ratio: num(ratio) } : g)),
    }));

  const validGears = spec.gears.map((g, i) => ({ ...g, i })).filter((g) => g.ratio != null);
  const selA = spec.gears[Number(gearA)] ?? null;
  const selB = spec.gears[Number(gearB)] ?? null;

  const speeds = useMemo(() => {
    const r = num(rpm);
    if (r == null || spec.finalDrive == null || spec.tyreDiameterMm == null) return null;
    const one = (g: { ratio: number | null }) => {
      if (g.ratio == null) return null;
      if (spec.finalDrive == null || spec.tyreDiameterMm == null) return null;
      const o = overallRatio(g.ratio, spec.finalDrive);
      return o != null ? speedAtRpmKmh(r, o, spec.tyreDiameterMm) : null;
    };
    const diff =
      selA?.ratio != null && selB?.ratio != null
        ? speedDifferenceKmh(r, selA.ratio, selB.ratio, spec.finalDrive, spec.tyreDiameterMm)
        : null;
    return { perGear: spec.gears.map(one), diff };
  }, [rpm, spec, selA, selB]);

  if (!activeCar) {
    return (
      <p className="text-xs text-muted-foreground">
        Select a car to save and reuse its gearbox and differential information.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Num
          label="Final drive"
          value={spec.finalDrive?.toString() ?? ""}
          onChange={(v) => setSpec((s) => ({ ...s, finalDrive: num(v) }))}
          placeholder="e.g. 3.9"
        />
        <Num
          label="Tyre diameter"
          unit="mm"
          value={spec.tyreDiameterMm?.toString() ?? ""}
          onChange={(v) => setSpec((s) => ({ ...s, tyreDiameterMm: num(v) }))}
        />
        <Num label="RPM" value={rpm} onChange={setRpm} placeholder="e.g. 7000" />
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {spec.gears.map((g, i) => (
          <Num
            key={g.label}
            label={g.label}
            value={g.ratio?.toString() ?? ""}
            onChange={(v) => setGear(i, v)}
          />
        ))}
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => save.mutate()}
        disabled={save.isPending || gearboxQ.isLoading || gearboxQ.isError}
      >
        <Save className="w-3.5 h-3.5 mr-1" /> Save gearbox for {activeCar.name}
      </Button>
      <Formula>
        overall = gear × final drive · speed = rpm × 60 × π × tyre Ø ÷ (overall × 10⁶) — zero slip
        assumed
      </Formula>
      {speeds ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {spec.gears.map((g, i) => (
              <Result
                key={g.label}
                label={`${g.label} @ ${rpm} rpm`}
                value={speeds.perGear[i] != null ? `${fmt(speeds.perGear[i], 1)} km/h` : null}
              />
            ))}
          </div>
          {validGears.length >= 2 && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Compare
                <select
                  value={gearA}
                  onChange={(e) => setGearA(e.target.value)}
                  className="ml-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {validGears.map((g) => (
                    <option key={g.i} value={g.i}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                vs
                <select
                  value={gearB}
                  onChange={(e) => setGearB(e.target.value)}
                  className="ml-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {validGears.map((g) => (
                    <option key={g.i} value={g.i}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              {speeds.diff && (
                <div className="text-sm">
                  {selB?.label} is <strong>{fmt(Math.abs(speeds.diff.diff), 1)} km/h</strong>{" "}
                  {speeds.diff.diff >= 0 ? "faster" : "slower"} than {selA?.label} at {rpm} rpm
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Enter final drive, tyre diameter and an RPM to see theoretical road speeds.
        </p>
      )}
    </div>
  );
}

// ───────────────────────── Panel ─────────────────────────

export function CalculatorsPanel() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <Tabs defaultValue="fuel">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/40 p-1 justify-start">
          <TabsTrigger value="fuel" className="gap-1.5">
            <Fuel className="w-3.5 h-3.5" /> Fuel
          </TabsTrigger>
          <TabsTrigger value="tyres" className="gap-1.5">
            <Gauge className="w-3.5 h-3.5" /> Tyre pressures
          </TabsTrigger>
          <TabsTrigger value="suspension" className="gap-1.5">
            <MoveVertical className="w-3.5 h-3.5" /> Suspension
          </TabsTrigger>
          <TabsTrigger value="gearing" className="gap-1.5">
            <Cog className="w-3.5 h-3.5" /> Gearing
          </TabsTrigger>
        </TabsList>
        <TabsContent value="fuel" className="mt-4">
          <FuelCalculator />
        </TabsContent>
        <TabsContent value="tyres" className="mt-4">
          <TyreCalculator />
        </TabsContent>
        <TabsContent value="suspension" className="mt-4">
          <SuspensionCalculator />
        </TabsContent>
        <TabsContent value="gearing" className="mt-4">
          <GearingCalculator />
        </TabsContent>
      </Tabs>
    </div>
  );
}
