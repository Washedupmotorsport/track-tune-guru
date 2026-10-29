import { useState } from "react";
import {
  Car,
  Thermometer,
  Wrench,
  MessageSquare,
  RotateCcw,
  Sun,
  CloudDrizzle,
  CloudRain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DEMO_BASELINE,
  DEMO_LIMITS,
  exploreSetup,
  type DemoSetup,
  type DemoSurface,
} from "@/lib/landing-demo";

const surfaces = [
  { value: "dry", label: "Dry", icon: Sun },
  { value: "damp", label: "Damp", icon: CloudDrizzle },
  { value: "wet", label: "Wet", icon: CloudRain },
] as const;

function DemoSlider({
  label,
  value,
  limits,
  unit,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  limits: readonly [number, number];
  unit: string;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{label}</span>
        <output className="font-mono font-semibold text-primary">
          {value}
          {unit}
        </output>
      </div>
      <Slider
        thumbLabel={label}
        className="h-8"
        min={limits[0]}
        max={limits[1]}
        step={step}
        value={[value]}
        onValueChange={([next]) => {
          if (next !== undefined) onChange(next);
        }}
      />
      <div className="flex justify-between font-mono text-xs text-muted-foreground">
        <span>
          {limits[0]}
          {unit}
        </span>
        <span>
          {limits[1]}
          {unit}
        </span>
      </div>
    </div>
  );
}

/** Local-only illustrative exploration; no account reads, saves or AI calls. */
export function LandingProductPreview() {
  const [setup, setSetup] = useState<DemoSetup>({ ...DEMO_BASELINE });
  const result = exploreSetup(setup);
  const baseline = exploreSetup(DEMO_BASELINE);
  const update = (key: "temperature" | "pressure" | "frontBar", value: number) =>
    setSetup((current) => ({ ...current, [key]: value }));
  const changed = Object.keys(DEMO_BASELINE).some(
    (key) => setup[key as keyof DemoSetup] !== DEMO_BASELINE[key as keyof DemoSetup],
  );
  const pressureDelta = result.hotPressure - baseline.hotPressure;

  return (
    <div
      id="setup-demo"
      className="scroll-mt-20 overflow-hidden rounded-md border border-border bg-card text-card-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 font-display font-bold">
            <Car className="size-5 text-primary" /> Setup explorer
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Illustrative demo · not customer results
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSetup({ ...DEMO_BASELINE })}
          disabled={!changed}
        >
          <RotateCcw /> Reset baseline
        </Button>
      </div>
      <div className="grid lg:grid-cols-[1fr_1.1fr_1fr]">
        <div className="min-w-0 space-y-6 border-b border-border p-5 lg:border-b-0 lg:border-r">
          <div>
            <h4 className="mb-4 flex items-center gap-2 font-display text-base">
              <Thermometer className="size-4 text-primary" /> Track conditions
            </h4>
            <div role="group" aria-label="Track surface" className="grid grid-cols-3 gap-2">
              {surfaces.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={setup.surface === value ? "default" : "outline"}
                  className="px-2"
                  aria-pressed={setup.surface === value}
                  onClick={() =>
                    setSetup((current) => ({ ...current, surface: value as DemoSurface }))
                  }
                >
                  <Icon />
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <DemoSlider
            label="Track temperature"
            value={setup.temperature}
            limits={DEMO_LIMITS.temperature}
            unit="°C"
            onChange={(value) => update("temperature", value)}
          />
          <div className="border-t border-border pt-5">
            <h4 className="flex items-center gap-2 font-display text-base">
              <Wrench className="size-4 text-primary" /> Setup changes
            </h4>
          </div>
          <DemoSlider
            label="Cold tyre pressure"
            value={setup.pressure}
            limits={DEMO_LIMITS.pressure}
            unit=" PSI"
            step={0.5}
            onChange={(value) => update("pressure", value)}
          />
          <DemoSlider
            label="Front anti-roll bar"
            value={setup.frontBar}
            limits={DEMO_LIMITS.frontBar}
            unit=""
            onChange={(value) => update("frontBar", value)}
          />
          <p className="text-xs text-muted-foreground">1 · softer / 5 · stiffer</p>
        </div>
        <div className="min-w-0 border-b border-border p-5 lg:border-b-0 lg:border-r">
          <p className="font-mono text-xs text-muted-foreground">CAR #27 · FORMULA CAR</p>
          <img
            src="/mre-share.jpg"
            alt="Formula race car on circuit"
            className="mt-4 aspect-[4/3] w-full rounded-sm object-cover"
            loading="lazy"
          />
          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-display text-base">Example hot pressure</h4>
            <output
              aria-label="Example hot pressure"
              className="font-mono text-2xl font-semibold text-primary"
            >
              {result.hotPressure.toFixed(1)} <span className="text-sm">PSI</span>
            </output>
          </div>
          <dl className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Dry baseline · 32°C</dt>
              <dd className="font-mono">{baseline.hotPressure.toFixed(1)} PSI</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Difference</dt>
              <dd aria-label="Pressure difference" className="font-mono">
                {pressureDelta > 0 ? "+" : ""}
                {pressureDelta.toFixed(1)} PSI
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {result.pressureNote}
          </p>
        </div>
        <div className="min-w-0 p-5" aria-live="polite" aria-atomic="true">
          <h4 className="flex items-center gap-2 font-display text-base">
            <MessageSquare className="size-4 text-primary" /> Example driver feedback
          </h4>
          <p className="mt-4 border-l-2 border-accent pl-3 font-display text-xl text-primary">
            {result.handling}
          </p>
          <p className="mt-4 text-sm leading-relaxed">{result.feedback}</p>
          <div className="mt-6 border-t border-border pt-5">
            <h4 className="font-display text-base">Conditions to consider</h4>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {result.conditions}
            </p>
          </div>
          <div className="mt-6 border-t border-border pt-5">
            <h4 className="font-display text-base">Compared with baseline</h4>
            <p className="mt-3 text-sm text-muted-foreground">
              Front bar: 3 → {setup.frontBar} ·{" "}
              {setup.frontBar === 3 ? "unchanged" : setup.frontBar < 3 ? "softer" : "stiffer"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Cold pressure: 22 → {setup.pressure} PSI
            </p>
          </div>
        </div>
      </div>
      <p className="border-t border-border bg-muted px-5 py-4 text-xs leading-relaxed text-muted-foreground">
        Simplified educational examples, not a physics simulation or setup recommendation. Actual
        behaviour depends on the car, tyres, circuit and driver. No lap-time prediction or
        faster-lap guarantee.
      </p>
    </div>
  );
}
