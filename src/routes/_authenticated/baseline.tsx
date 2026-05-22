import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Wand2, ArrowLeft, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { generateBaseline, type BaselineInput, type Drivetrain, type TireType, type Surface, type Grip } from "@/lib/baseline";
import type { DisciplineId } from "@/lib/disciplines";
import { DISCIPLINES } from "@/lib/disciplines";
import { useUnits } from "@/lib/units";

export const Route = createFileRoute("/_authenticated/baseline")({
  component: BaselinePage,
});

type Car = { id: string; name: string; discipline: string };

function BaselinePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const units = useUnits();

  const carsQ = useQuery({
    queryKey: ["cars", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id,name,discipline,user_id").order("created_at");
      if (error) throw error;
      return data as (Car & { user_id: string })[];
    },
    enabled: !!user,
  });

  const [carId, setCarId] = useState<string>("");
  const [discipline, setDiscipline] = useState<DisciplineId>("circuit");
  const [drivetrain, setDrivetrain] = useState<Drivetrain>("RWD");
  const [weightKg, setWeightKg] = useState("1300");
  const [frontBiasPct, setFrontBiasPct] = useState("52");
  const [tire, setTire] = useState<TireType>("semi_slick");
  const [surface, setSurface] = useState<Surface>("smooth");
  const [grip, setGrip] = useState<Grip>("medium");
  const [ambientC, setAmbientC] = useState("20");
  const [aero, setAero] = useState(false);

  // Display-converted I/O wrappers — internal state stays metric.
  const weightDisplay = String(units.toDisplayMass(Number(weightKg) || 0));
  const setWeightDisplay = (v: string) => {
    const n = parseFloat(v);
    setWeightKg(isNaN(n) ? "" : String(Math.round(units.fromDisplayMass(n))));
  };
  const ambientDisplay = (() => {
    const t = units.toDisplayTemp(Number(ambientC));
    return t == null ? "" : String(t);
  })();
  const setAmbientDisplay = (v: string) => {
    const n = parseFloat(v);
    if (isNaN(n)) { setAmbientC(""); return; }
    const c = units.fromDisplayTemp(n);
    setAmbientC(c == null ? "" : String(Math.round(c * 10) / 10));
  };

  // sync discipline when car changes
  useEffect(() => {
    if (!carId && carsQ.data && carsQ.data.length > 0) setCarId(carsQ.data[0].id);
  }, [carsQ.data, carId]);
  useEffect(() => {
    const c = carsQ.data?.find((x) => x.id === carId);
    if (c) setDiscipline(c.discipline as DisciplineId);
  }, [carId, carsQ.data]);

  const car = carsQ.data?.find((c) => c.id === carId) ?? null;
  const isOwner = car && user && car.user_id === user.id;

  const input: BaselineInput = useMemo(() => ({
    discipline,
    drivetrain,
    weightKg: Number(weightKg) || 1300,
    frontBiasPct: Number(frontBiasPct) || 50,
    tire,
    surface,
    grip,
    ambientC: Number(ambientC) || 20,
    aero,
  }), [discipline, drivetrain, weightKg, frontBiasPct, tire, surface, grip, ambientC, aero]);

  const { rows, setupData } = useMemo(() => generateBaseline(input), [input]);

  const save = useMutation({
    mutationFn: async () => {
      if (!carId) throw new Error("Pick a car first");
      const name = `Baseline · ${new Date().toLocaleDateString()}`;
      const { data, error } = await supabase.from("setups").insert({
        user_id: user!.id,
        car_id: carId,
        name,
        discipline,
        track: null,
        conditions: `${ambientC}°C · ${surface} · ${grip} grip · ${tire}`,
        setup_data: setupData,
        notes: `Generated baseline for ${drivetrain} ${weightKg}kg, ${frontBiasPct}% F bias.`,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Saved as new setup");
      navigate({ to: "/setups/$setupId", params: { setupId: data.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div>
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>
      <div className="mt-4">
        <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
          <Wand2 className="w-3 h-3" /> Generator
        </div>
        <h1 className="font-display text-4xl font-bold mt-1">Baseline Setup</h1>
        <p className="text-muted-foreground text-sm mt-1">
          A starting point for tire pressures, alignment, springs, dampers and bias — tuned to your car, discipline and conditions.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-8">
        <Section title="Inputs">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Car</Label>
              <Select value={carId} onValueChange={setCarId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select a car" /></SelectTrigger>
                <SelectContent>
                  {(carsQ.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <SelField label="Discipline" value={discipline} onChange={(v) => setDiscipline(v as DisciplineId)}
              options={DISCIPLINES.map((d) => ({ value: d.id, label: d.label }))} />
            <SelField label="Drivetrain" value={drivetrain} onChange={(v) => setDrivetrain(v as Drivetrain)}
              options={[{value:"FWD",label:"FWD"},{value:"RWD",label:"RWD"},{value:"AWD",label:"AWD"}]} />

            <NumField label="Weight" unit={units.massUnit} value={weightDisplay} onChange={setWeightDisplay} />
            <NumField label="Front bias" unit="%" value={frontBiasPct} onChange={setFrontBiasPct} />

            <SelField label="Tire type" value={tire} onChange={(v) => setTire(v as TireType)}
              options={[
                {value:"street",label:"Street"},
                {value:"semi_slick",label:"Semi-slick"},
                {value:"slick",label:"Slick"},
                {value:"wet",label:"Wet"},
                {value:"drag_radial",label:"Drag radial"},
                {value:"rally_gravel",label:"Rally gravel"},
                {value:"rally_tarmac",label:"Rally tarmac"},
              ]} />
            <SelField label="Surface" value={surface} onChange={(v) => setSurface(v as Surface)}
              options={[
                {value:"smooth",label:"Smooth track"},
                {value:"bumpy",label:"Bumpy track"},
                {value:"street",label:"Street"},
                {value:"loose",label:"Loose / dirt"},
                {value:"dirt",label:"Dirt"},
              ]} />

            <SelField label="Grip level" value={grip} onChange={(v) => setGrip(v as Grip)}
              options={[{value:"low",label:"Low"},{value:"medium",label:"Medium"},{value:"high",label:"High"}]} />
            <NumField label="Ambient" unit={units.tempUnit} value={ambientDisplay} onChange={setAmbientDisplay} />

            <div className="col-span-2 flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Significant aero</div>
                <div className="text-xs text-muted-foreground">Wing / splitter / diffuser stiffens springs and lowers ride.</div>
              </div>
              <Switch checked={aero} onCheckedChange={setAero} />
            </div>
          </div>
        </Section>

        <Section title="Generated baseline">
          <div className="divide-y divide-border/60">
            {rows.map((r, i) => (
              <div key={i} className="py-2 flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{r.label}</div>
                  {r.rationale && <div className="text-[11px] text-muted-foreground/80 truncate">{r.rationale}</div>}
                </div>
                <div className="font-display text-lg font-bold whitespace-nowrap">
                  {displayRow(r.value, r.unit, units)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex gap-2">
            <Button onClick={() => save.mutate()} disabled={!carId || save.isPending || !isOwner} className="shadow-glow">
              <Save className="w-4 h-4 mr-1" />
              {save.isPending ? "Saving…" : "Save as new setup"}
            </Button>
          </div>
          {!isOwner && carId && (
            <p className="text-xs text-muted-foreground mt-2">Only the car owner can save a setup to it.</p>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            These are starting values — always verify against your chassis manual and tune from real data.
          </p>
        </Section>
      </div>
    </div>
  );
}

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

function NumField({ label, unit, value, onChange }: { label: string; unit?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        {label}{unit && <span className="text-primary"> ({unit})</span>}
      </Label>
      <Input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 font-mono" />
    </div>
  );
}

function SelField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div>
      <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function displayRow(value: string, unit: string | undefined, units: ReturnType<typeof useUnits>) {
  if (!unit) return <>{value}</>;
  const n = parseFloat(value);
  if (isNaN(n)) {
    return <>{value}<span className="text-primary text-xs font-mono ml-1">{unit}</span></>;
  }
  if (unit === "mm") {
    return <>{units.toDisplayLengthShort(n)}<span className="text-primary text-xs font-mono ml-1">{units.lengthShortUnit}</span></>;
  }
  return <>{value}<span className="text-primary text-xs font-mono ml-1">{unit}</span></>;
}