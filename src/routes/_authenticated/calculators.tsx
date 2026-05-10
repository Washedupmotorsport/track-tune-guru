import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calculator, Gauge, Cog, Ruler, ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/calculators")({
  component: CalculatorsPage,
});

type Car = {
  id: string;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  discipline: string;
};

function CalculatorsPage() {
  const { user } = useAuth();
  const carsQ = useQuery({
    queryKey: ["cars", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("*").order("created_at");
      if (error) throw error;
      return data as Car[];
    },
    enabled: !!user,
  });

  const [carId, setCarId] = useState<string>("");
  useEffect(() => {
    if (!carId && carsQ.data && carsQ.data.length > 0) setCarId(carsQ.data[0].id);
  }, [carsQ.data, carId]);

  const car = carsQ.data?.find((c) => c.id === carId) ?? null;

  return (
    <div>
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>
      <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
            <Calculator className="w-3 h-3" /> Toolbox
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Calculators</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Quick math for tires, gearing, and ride height. Pick a car to seed the discipline context.
          </p>
        </div>
        <div className="min-w-[260px]">
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Car</Label>
          <Select value={carId} onValueChange={setCarId}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select a car" /></SelectTrigger>
            <SelectContent>
              {(carsQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {car && (
            <div className="text-xs font-mono text-muted-foreground mt-1">
              {[car.year, car.make, car.model].filter(Boolean).join(" ")} · {car.discipline}
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="tires" className="mt-8">
        <TabsList>
          <TabsTrigger value="tires"><Gauge className="w-4 h-4 mr-1" /> Tire pressure</TabsTrigger>
          <TabsTrigger value="gears"><Cog className="w-4 h-4 mr-1" /> Gear ratios</TabsTrigger>
          <TabsTrigger value="ride"><Ruler className="w-4 h-4 mr-1" /> Ride height</TabsTrigger>
        </TabsList>
        <TabsContent value="tires"><TirePressureCalc /></TabsContent>
        <TabsContent value="gears"><GearRatioCalc /></TabsContent>
        <TabsContent value="ride"><RideHeightCalc /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- shared bits ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-border" />
        <h2 className="font-display text-lg font-bold uppercase tracking-wider">{title}</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      {children}
    </div>
  );
}

function NumField({ label, unit, value, onChange, step = "any", placeholder }: {
  label: string; unit?: string; value: string; onChange: (v: string) => void; step?: string; placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        {label}{unit && <span className="text-primary"> ({unit})</span>}
      </Label>
      <Input type="number" inputMode="decimal" step={step} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} className="mt-1 font-mono" />
    </div>
  );
}

function ResultRow({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border/60 py-2">
      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="font-display text-xl font-bold">
        {value}<span className="text-primary text-sm font-mono ml-1">{unit}</span>
      </span>
    </div>
  );
}

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
};
const fmt = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "—");

/* ---------- 1. Tire pressure ---------- */

function TirePressureCalc() {
  const [cold, setCold] = useState("28");
  const [hot, setHot] = useState("32");
  const [target, setTarget] = useState("32");
  const [coldT, setColdT] = useState("20");
  const [hotT, setHotT] = useState("80");
  const [trackT, setTrackT] = useState("30");

  const c = num(cold), h = num(hot), t = num(target);
  const ct = num(coldT) + 273.15, ht = num(hotT) + 273.15, tt = num(trackT) + 273.15;

  // Gay-Lussac: (P+atm)/T = const. Use 14.696 psi atmospheric.
  const ATM = 14.696;
  const riseRatio = ht / ct;
  const predictedHot = (c + ATM) * riseRatio - ATM;
  const recommendedCold = (t + ATM) / riseRatio - ATM;
  // Bleed/add to hit target hot from current hot
  const delta = t - h;
  // Cold pressure suggestion based on current track temp delta from baseline cold day (20°C)
  const refColdT = 20 + 273.15;
  const adjForTrack = (c + ATM) * (refColdT / tt) - ATM;

  return (
    <div className="grid lg:grid-cols-2 gap-4 mt-4">
      <Section title="Inputs">
        <div className="grid grid-cols-2 gap-4">
          <NumField label="Cold pressure" unit="psi" value={cold} onChange={setCold} />
          <NumField label="Hot pressure" unit="psi" value={hot} onChange={setHot} />
          <NumField label="Target hot" unit="psi" value={target} onChange={setTarget} />
          <NumField label="Cold tire temp" unit="°C" value={coldT} onChange={setColdT} />
          <NumField label="Hot tire temp" unit="°C" value={hotT} onChange={setHotT} />
          <NumField label="Track ambient" unit="°C" value={trackT} onChange={setTrackT} />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Uses Gay-Lussac's law with 14.7 psi atmospheric. Best for slick / track tires after a representative stint.
        </p>
      </Section>
      <Section title="Results">
        <ResultRow label="Predicted hot from current cold" value={fmt(predictedHot)} unit="psi" />
        <ResultRow label="Recommended cold for target hot" value={fmt(recommendedCold)} unit="psi" />
        <ResultRow label="Adjustment vs current hot" value={(delta >= 0 ? "+" : "") + fmt(delta)} unit="psi" />
        <ResultRow label="Cold P scaled to track temp" value={fmt(adjForTrack)} unit="psi" />
        <p className="text-xs text-muted-foreground mt-3">
          Negative adjustment = bleed pressure. Positive = add. Scale assumes a 20°C reference morning.
        </p>
      </Section>
    </div>
  );
}

/* ---------- 2. Gear ratios ---------- */

function GearRatioCalc() {
  const [final, setFinal] = useState("3.73");
  const [width, setWidth] = useState("245");
  const [aspect, setAspect] = useState("40");
  const [diameter, setDiameter] = useState("18");
  const [rpm, setRpm] = useState("7000");
  const [gears, setGears] = useState<string[]>(["3.36", "2.07", "1.43", "1.11", "0.85", "0.69"]);

  const w = num(width), a = num(aspect), d = num(diameter), f = num(final), r = num(rpm);
  // tire diameter in inches
  const tireDiaIn = (d) + (2 * (w * (a / 100)) / 25.4);
  const tireCircMi = (Math.PI * tireDiaIn) / 63360; // miles per rev

  const speeds = useMemo(() => gears.map((g) => {
    const ratio = num(g);
    if (!Number.isFinite(ratio) || ratio <= 0 || !Number.isFinite(f) || !Number.isFinite(r) || !Number.isFinite(tireCircMi)) return NaN;
    const wheelRpm = r / (ratio * f);
    const mph = wheelRpm * tireCircMi * 60;
    return mph;
  }), [gears, f, r, tireCircMi]);

  const updateGear = (i: number, v: string) => {
    setGears((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  };
  const addGear = () => setGears((g) => [...g, ""]);
  const removeGear = () => setGears((g) => (g.length > 1 ? g.slice(0, -1) : g));

  return (
    <div className="grid lg:grid-cols-2 gap-4 mt-4">
      <Section title="Drivetrain & tire">
        <div className="grid grid-cols-2 gap-4">
          <NumField label="Final drive" value={final} onChange={setFinal} />
          <NumField label="Redline" unit="rpm" value={rpm} onChange={setRpm} />
          <NumField label="Tire width" unit="mm" value={width} onChange={setWidth} />
          <NumField label="Aspect ratio" unit="%" value={aspect} onChange={setAspect} />
          <NumField label="Wheel diameter" unit="in" value={diameter} onChange={setDiameter} />
        </div>
        <div className="mt-4 text-xs font-mono text-muted-foreground">
          Tire OD: <span className="text-foreground">{fmt(tireDiaIn)} in</span> · circ {fmt(Math.PI * tireDiaIn)} in
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Gear ratios</Label>
            <div className="flex gap-2">
              <button type="button" onClick={removeGear} className="text-xs font-mono text-muted-foreground hover:text-destructive">− gear</button>
              <button type="button" onClick={addGear} className="text-xs font-mono text-muted-foreground hover:text-primary">+ gear</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {gears.map((g, i) => (
              <div key={i}>
                <Label className="text-[10px] font-mono uppercase text-muted-foreground">Gear {i + 1}</Label>
                <Input type="number" inputMode="decimal" step="0.01" value={g}
                  onChange={(e) => updateGear(i, e.target.value)} className="font-mono mt-1" />
              </div>
            ))}
          </div>
        </div>
      </Section>
      <Section title="Top speed @ redline">
        {speeds.map((s, i) => (
          <ResultRow key={i} label={`Gear ${i + 1}`} value={fmt(s, 1)} unit="mph" />
        ))}
        <p className="text-xs text-muted-foreground mt-3">
          Theoretical max at the chosen redline. Multiply mph by 1.609 for km/h.
        </p>
      </Section>
    </div>
  );
}

/* ---------- 3. Ride height ---------- */

function RideHeightCalc() {
  const [tireDia, setTireDia] = useState("640");
  const [wheelOffset, setWheelOffset] = useState("0");
  const [chassisFront, setChassisFront] = useState("85");
  const [chassisRear, setChassisRear] = useState("95");
  const [wheelbase, setWheelbase] = useState("2650");
  const [motionRatio, setMotionRatio] = useState("1.0");
  const [springRate, setSpringRate] = useState("80");
  const [cornerWeight, setCornerWeight] = useState("320");

  const cf = num(chassisFront), cr = num(chassisRear), wb = num(wheelbase);
  const rake = cr - cf;
  const rakeAngle = wb > 0 ? (Math.atan(rake / wb) * 180) / Math.PI : NaN;

  const td = num(tireDia), off = num(wheelOffset);
  // hub center relative to chassis: ride height + (wheel offset adjustment)
  // Useful conversion: chassis ride to wheel center / ground gap
  const groundClearF = cf + off;
  const groundClearR = cr + off;

  const mr = num(motionRatio), sr = num(springRate), cw = num(cornerWeight);
  // wheel rate = spring rate * MR^2  (N/mm)
  const wheelRate = sr * mr * mr;
  // sag (mm) = corner weight (kg) * g / wheel rate (N/mm) -> use 9.81
  const sag = (cw * 9.81) / wheelRate;

  return (
    <div className="grid lg:grid-cols-2 gap-4 mt-4">
      <Section title="Chassis & geometry">
        <div className="grid grid-cols-2 gap-4">
          <NumField label="Chassis ride F" unit="mm" value={chassisFront} onChange={setChassisFront} />
          <NumField label="Chassis ride R" unit="mm" value={chassisRear} onChange={setChassisRear} />
          <NumField label="Wheelbase" unit="mm" value={wheelbase} onChange={setWheelbase} />
          <NumField label="Tire OD" unit="mm" value={tireDia} onChange={setTireDia} />
          <NumField label="Hub offset Δ" unit="mm" value={wheelOffset} onChange={setWheelOffset}
            placeholder="e.g. spacer / new wheel" />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Rake = rear ride − front ride. Positive rake noses the car down for aero / weight transfer balance.
        </p>
      </Section>
      <Section title="Rake & clearance">
        <ResultRow label="Rake" value={(rake >= 0 ? "+" : "") + fmt(rake)} unit="mm" />
        <ResultRow label="Rake angle" value={fmt(rakeAngle, 3)} unit="°" />
        <ResultRow label="Ground clearance F" value={fmt(groundClearF)} unit="mm" />
        <ResultRow label="Ground clearance R" value={fmt(groundClearR)} unit="mm" />
        <ResultRow label="Tire radius" value={fmt(td / 2)} unit="mm" />
      </Section>

      <Section title="Spring sag">
        <div className="grid grid-cols-2 gap-4">
          <NumField label="Spring rate" unit="N/mm" value={springRate} onChange={setSpringRate} />
          <NumField label="Motion ratio" value={motionRatio} onChange={setMotionRatio} />
          <NumField label="Corner weight" unit="kg" value={cornerWeight} onChange={setCornerWeight} />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Wheel rate = spring × MR². Static sag estimates how much the corner sits down on the spring.
        </p>
      </Section>
      <Section title="Spring results">
        <ResultRow label="Wheel rate" value={fmt(wheelRate)} unit="N/mm" />
        <ResultRow label="Static sag" value={fmt(sag)} unit="mm" />
        <ResultRow label="Free ride target" value={fmt(num(chassisFront) + sag)} unit="mm" />
      </Section>
    </div>
  );
}