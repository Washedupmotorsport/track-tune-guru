import {
  Car,
  CalendarDays,
  Thermometer,
  Wrench,
  MessageSquare,
  Timer,
  ArrowRight,
} from "lucide-react";

const wheels = [
  { label: "Front left", cold: "22.0", hot: "27.0" },
  { label: "Front right", cold: "22.0", hot: "27.5" },
  { label: "Rear left", cold: "21.0", hot: "26.0" },
  { label: "Rear right", cold: "21.0", hot: "26.5" },
];

/** Read-only illustrative data; never reads or writes a visitor's race records. */
export function LandingProductPreview() {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card text-card-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted px-5 py-4">
        <div className="flex items-center gap-2 font-display font-bold">
          <Car className="size-5 text-primary" /> My Race Engineer
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          Illustrative demo · not customer results
        </span>
      </div>
      <div className="grid lg:grid-cols-[1fr_1.25fr_1fr]">
        <div className="space-y-6 border-b border-border p-5 lg:border-b-0 lg:border-r">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <CalendarDays className="size-4" /> RACE WEEKEND
            </p>
            <h3 className="mt-3 text-xl font-display">Club circuit test</h3>
            <p className="mt-1 text-sm text-muted-foreground">Car #27 · Formula car</p>
            <p className="mt-1 text-sm text-muted-foreground">Queensland Raceway</p>
          </div>
          <div className="border-t border-border pt-5">
            <p className="text-xs font-semibold text-muted-foreground">SESSION SETUP</p>
            <h4 className="mt-2 text-base font-display">Practice 02 · Baseline B</h4>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <span className="flex items-center gap-1">
                <Thermometer className="size-4 text-primary" /> Air 24°C
              </span>
              <span>Track 32°C · Dry</span>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Front camber</dt>
                <dd className="font-mono">−2.5°</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Rear camber</dt>
                <dd className="font-mono">−1.8°</dd>
              </div>
            </dl>
          </div>
          <div className="border-t border-border pt-5">
            <p className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Wrench className="size-4" /> SETUP CHANGE
            </p>
            <p className="mt-2 text-sm">Front rebound</p>
            <p className="mt-1 flex items-center gap-3 font-mono text-lg">
              6 clicks <ArrowRight className="size-4 text-muted-foreground" /> 5 clicks
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Test front-end response on corner entry.
            </p>
          </div>
        </div>
        <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base">Tyre pressures</h3>
            <span className="font-mono text-xs text-muted-foreground">PSI · Cold / Hot</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-8">
            {wheels.map((wheel) => (
              <div key={wheel.label} className="border-l-2 border-primary pl-3">
                <p className="text-xs font-semibold text-muted-foreground">{wheel.label}</p>
                <p className="mt-2 font-mono text-xl font-semibold">
                  {wheel.cold} <span className="text-muted-foreground">/</span>{" "}
                  <span className="text-primary">{wheel.hot}</span>
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">cold / hot</p>
              </div>
            ))}
          </div>
          <div className="mt-7 border-t border-border pt-4 text-sm text-muted-foreground">
            Recorded with Practice 02 and Baseline B.
          </div>
        </div>
        <div className="p-5">
          <h3 className="flex items-center gap-2 font-display text-base">
            <MessageSquare className="size-4 text-primary" /> Driver feedback
          </h3>
          <blockquote className="mt-4 border-l-2 border-accent pl-3 text-sm leading-relaxed">
            “Turn-in feels more settled. Still pushing wide at mid-corner. Try one change at a
            time.”
          </blockquote>
          <div className="mt-6 border-t border-border pt-5">
            <h4 className="flex items-center gap-2 font-display text-base">
              <Timer className="size-4 text-primary" /> Session comparison
            </h4>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Practice 01 · best lap</dt>
                <dd className="font-mono font-semibold">1:18.420</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Practice 02 · best lap</dt>
                <dd className="font-mono font-semibold">1:18.610</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Example times only. Conditions and driving affect results; a setup change does not
              guarantee a faster lap.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
