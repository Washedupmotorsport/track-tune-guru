import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calculator, Gauge, Cog, Ruler, Scale, GitCommit, ArrowLeft, ArrowLeftRight } from "lucide-react";
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
          <TabsTrigger value="cg"><Scale className="w-4 h-4 mr-1" /> CG</TabsTrigger>
          <TabsTrigger value="antisquat"><GitCommit className="w-4 h-4 mr-1" /> Anti-squat</TabsTrigger>
          <TabsTrigger value="balance"><ArrowLeftRight className="w-4 h-4 mr-1" /> Balance</TabsTrigger>
        </TabsList>
        <TabsContent value="tires"><TirePressureCalc /></TabsContent>
        <TabsContent value="gears"><GearRatioCalc /></TabsContent>
        <TabsContent value="ride"><RideHeightCalc /></TabsContent>
        <TabsContent value="cg"><CenterOfGravityCalc /></TabsContent>
        <TabsContent value="antisquat"><AntiSquatCalc /></TabsContent>
        <TabsContent value="balance"><BalanceCalc /></TabsContent>
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

/* ---------- 4. Center of gravity ---------- */

function CenterOfGravityCalc() {
  const [method, setMethod] = useState<"distribution" | "lift">("distribution");

  // Distribution method inputs
  const [totalWeight, setTotalWeight] = useState("1200");
  const [frontWeight, setFrontWeight] = useState("660");
  const [leftWeight, setLeftWeight] = useState("580");
  const [wheelbase, setWheelbase] = useState("2650");
  const [trackWidth, setTrackWidth] = useState("1580");

  // Lift method inputs
  const [wfLevel, setWfLevel] = useState("600");
  const [wfLifted, setWfLifted] = useState("645");
  const [liftHeight, setLiftHeight] = useState("500");

  const tw = num(totalWeight);
  const fw = num(frontWeight);
  const lw = num(leftWeight);
  const wb = num(wheelbase);
  const tr = num(trackWidth);

  const rw = tw - fw;
  const rgtW = tw - lw;

  // CG longitudinal from front axle
  const cgFromFront = tw > 0 ? wb * (rw / tw) : NaN;
  // CG from left edge (using left side weight)
  const cgFromLeft = tw > 0 ? tr * (rgtW / tw) : NaN;
  // CG from centerline (positive = right bias)
  const cgFromCenter = tw > 0 ? tr * ((rgtW - lw) / (2 * tw)) : NaN;

  // Front weight %
  const frontPct = tw > 0 ? (fw / tw) * 100 : NaN;
  const leftPct = tw > 0 ? (lw / tw) * 100 : NaN;

  // Lift method
  const wfl = num(wfLevel);
  const wfh = num(wfLifted);
  const lh = num(liftHeight);
  const deltaW = wfh - wfl;

  // angle theta from lifting rear: sin(theta) = liftHeight / sqrt(wheelbase^2 + liftHeight^2)
  const hypot = Math.sqrt(wb * wb + lh * lh);
  const sinTheta = hypot > 0 ? lh / hypot : NaN;
  const tanTheta = wb > 0 ? lh / wb : NaN;
  // CG height = (wheelbase * deltaFrontWeight) / (totalWeight * sin(theta))
  const cgHeight = sinTheta > 0 && tw > 0 ? (wb * deltaW) / (tw * sinTheta) : NaN;
  // Alternative formula using tan: h = (wheelbase * deltaW) / (totalWeight * tan(theta))
  // Both give same result for small angles.

  return (
    <div className="grid lg:grid-cols-2 gap-4 mt-4">
      <Section title="Method">
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMethod("distribution")}
            className={`flex-1 py-2 text-xs font-mono uppercase tracking-widest rounded border transition-colors ${
              method === "distribution"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            Weight distribution
          </button>
          <button
            type="button"
            onClick={() => setMethod("lift")}
            className={`flex-1 py-2 text-xs font-mono uppercase tracking-widest rounded border transition-colors ${
              method === "lift"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            Lift method
          </button>
        </div>

        {method === "distribution" ? (
          <div className="grid grid-cols-2 gap-4">
            <NumField label="Total weight" unit="kg" value={totalWeight} onChange={setTotalWeight} />
            <NumField label="Front axle weight" unit="kg" value={frontWeight} onChange={setFrontWeight} />
            <NumField label="Left side weight" unit="kg" value={leftWeight} onChange={setLeftWeight} />
            <NumField label="Wheelbase" unit="mm" value={wheelbase} onChange={setWheelbase} />
            <NumField label="Track width" unit="mm" value={trackWidth} onChange={setTrackWidth} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <NumField label="Front weight (level)" unit="kg" value={wfLevel} onChange={setWfLevel} />
            <NumField label="Front weight (lifted)" unit="kg" value={wfLifted} onChange={setWfLifted} />
            <NumField label="Lift height" unit="mm" value={liftHeight} onChange={setLiftHeight} />
            <NumField label="Wheelbase" unit="mm" value={wheelbase} onChange={setWheelbase} />
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          {method === "distribution"
            ? "Corner-weight method: weigh each axle or corner to find CG position in plan view."
            : "Lift method: raise the rear, re-weigh the front. The weight shift reveals CG height."}
        </p>
      </Section>

      {method === "distribution" ? (
        <Section title="CG position">
          <ResultRow label="Front weight bias" value={fmt(frontPct, 1)} unit="%" />
          <ResultRow label="Left weight bias" value={fmt(leftPct, 1)} unit="%" />
          <ResultRow label="CG from front axle" value={fmt(cgFromFront)} unit="mm" />
          <ResultRow label="CG from left edge" value={fmt(cgFromLeft)} unit="mm" />
          <ResultRow label="CG offset from centerline" value={(cgFromCenter >= 0 ? "+" : "") + fmt(cgFromCenter)} unit="mm" />
          <p className="text-xs text-muted-foreground mt-3">
            CG offset positive = biased to the right side. For a symmetrical car, aim for near-zero.
          </p>
        </Section>
      ) : (
        <Section title="CG height">
          <ResultRow label="Front weight change" value={(deltaW >= 0 ? "+" : "") + fmt(deltaW)} unit="kg" />
          <ResultRow label="Lift angle" value={fmt(Math.asin(sinTheta) * 180 / Math.PI, 2)} unit="°" />
          <ResultRow label="CG height" value={fmt(cgHeight)} unit="mm" />
          <p className="text-xs text-muted-foreground mt-3">
            Raise the rear by the lift height, re-weigh the front axle. The weight transfer is proportional to CG height.
          </p>
        </Section>
      )}
    </div>
  );
}

/* ---------- 5. Anti-squat ---------- */

function AntiSquatCalc() {
  const [method, setMethod] = useState<"direct" | "links">("direct");

  // Shared inputs
  const [wheelbase, setWheelbase] = useState("2650");
  const [cgHeight, setCgHeight] = useState("300");
  const [frontBias, setFrontBias] = useState("55");

  // Direct IC inputs
  const [icHeight, setIcHeight] = useState("120");
  const [icFromRear, setIcFromRear] = useState("1200");

  // 4-link inputs (rear axle at x=0, ground at y=0, positive x forward, positive y up)
  const [ufX, setUfX] = useState("400");   // upper frame mount x (forward of axle)
  const [ufY, setUfY] = useState("450");   // upper frame mount y (height)
  const [uaY, setUaY] = useState("350");   // upper axle mount y (height)
  const [lfX, setLfX] = useState("600");   // lower frame mount x
  const [lfY, setLfY] = useState("220");   // lower frame mount y
  const [laY, setLaY] = useState("150");   // lower axle mount y

  const wb = num(wheelbase);
  const hCG = num(cgHeight);
  const fb = num(frontBias) / 100;
  const b = wb * (1 - fb); // distance from rear axle to CG

  // ---- Direct method ----
  const hIC_direct = num(icHeight);
  const icRear = num(icFromRear);

  // ---- From links method ----
  // Line slopes: m = (y_axle - y_frame) / (0 - x_frame)
  const x_uf = num(ufX), y_uf = num(ufY), y_ua = num(uaY);
  const x_lf = num(lfX), y_lf = num(lfY), y_la = num(laY);

  const m1 = x_uf !== 0 ? (y_ua - y_uf) / (-x_uf) : NaN;
  const m2 = x_lf !== 0 ? (y_la - y_lf) / (-x_lf) : NaN;

  let icX_links = NaN;
  let icY_links = NaN;
  if (Number.isFinite(m1) && Number.isFinite(m2) && Math.abs(m1 - m2) > 1e-9) {
    icX_links = (y_la - y_ua) / (m1 - m2);
    icY_links = m1 * icX_links + y_ua;
  }

  // Choose active IC based on method
  const activeIcHeight = method === "direct" ? hIC_direct : icY_links;
  const activeIcFromRear = method === "direct" ? icRear : icX_links;

  // Anti-squat % = (h_IC / h_CG) * (L / b) * 100
  const antiSquatPct = hCG > 0 && b > 0 && Number.isFinite(activeIcHeight) && activeIcHeight > 0
    ? (activeIcHeight / hCG) * (wb / b) * 100
    : NaN;

  // Neutral IC height for 100% anti-squat
  const neutralIcHeight = hCG > 0 && b > 0 ? hCG * (b / wb) : NaN;

  // Interpretation
  const interp = (() => {
    if (!Number.isFinite(antiSquatPct)) return "Enter valid numbers to see result.";
    if (antiSquatPct < 0) return "Negative anti-squat — the car will squat heavily under acceleration.";
    if (antiSquatPct < 50) return "Low anti-squat — expect noticeable rear squat under hard acceleration.";
    if (antiSquatPct < 90) return "Moderate anti-squat — some squat remains, balanced traction feel.";
    if (antiSquatPct <= 110) return "Near-neutral — minimal squat or rise. Good for consistent launch behavior.";
    if (antiSquatPct <= 150) return "High anti-squat — the rear may rise under acceleration. Can unload the tire.";
    return "Very high anti-squat — strong rise tendency. May reduce rear grip and feel nervous.";
  })();

  return (
    <div className="grid lg:grid-cols-2 gap-4 mt-4">
      <Section title="Method">
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMethod("direct")}
            className={`flex-1 py-2 text-xs font-mono uppercase tracking-widest rounded border transition-colors ${
              method === "direct"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            Direct IC
          </button>
          <button
            type="button"
            onClick={() => setMethod("links")}
            className={`flex-1 py-2 text-xs font-mono uppercase tracking-widest rounded border transition-colors ${
              method === "links"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            From 4-link
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <NumField label="Wheelbase" unit="mm" value={wheelbase} onChange={setWheelbase} />
          <NumField label="CG height" unit="mm" value={cgHeight} onChange={setCgHeight} />
          <NumField label="Front weight bias" unit="%" value={frontBias} onChange={setFrontBias} />
        </div>

        {method === "direct" ? (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <NumField label="IC height" unit="mm" value={icHeight} onChange={setIcHeight} />
            <NumField label="IC from rear axle" unit="mm" value={icFromRear} onChange={setIcFromRear}
              placeholder="forward = positive" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <NumField label="Upper frame x" unit="mm" value={ufX} onChange={setUfX}
                placeholder="forward of axle" />
              <NumField label="Upper frame y" unit="mm" value={ufY} onChange={setUfY}
                placeholder="height" />
              <NumField label="Upper axle y" unit="mm" value={uaY} onChange={setUaY}
                placeholder="height" />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <NumField label="Lower frame x" unit="mm" value={lfX} onChange={setLfX}
                placeholder="forward of axle" />
              <NumField label="Lower frame y" unit="mm" value={lfY} onChange={setLfY}
                placeholder="height" />
              <NumField label="Lower axle y" unit="mm" value={laY} onChange={setLaY}
                placeholder="height" />
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          {method === "direct"
            ? "Enter the instant-center position directly (from suspension software or measurement)."
            : "Enter 4-link bar mount coordinates. Rear axle center is x=0, ground is y=0. Positive x = forward."}
        </p>
      </Section>

      <Section title="Anti-squat">
        {method === "links" && (
          <>
            <ResultRow label="Computed IC height" value={fmt(icY_links)} unit="mm" />
            <ResultRow label="IC from rear axle" value={fmt(icX_links)} unit="mm" />
          </>
        )}
        <ResultRow label="CG to rear axle" value={fmt(b)} unit="mm" />
        <ResultRow label="Anti-squat" value={fmt(antiSquatPct, 1)} unit="%" />
        <ResultRow label="Neutral IC height" value={fmt(neutralIcHeight)} unit="mm" />
        <div className="mt-3 text-xs text-muted-foreground">
          {interp}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          %AS = (h<sub>IC</sub> / h<sub>CG</sub>) × (L / b) × 100. &lt;100% = squat. &gt;100% = rise. 100% = neutral.
        </p>
      </Section>
    </div>
  );
}