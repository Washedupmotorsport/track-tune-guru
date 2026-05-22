import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Disc, Gauge, Thermometer } from "lucide-react";
import { useUnits } from "@/lib/units";

export const Route = createFileRoute("/_authenticated/tyre-setup")({
  component: TyreSetupPage,
  head: () => ({
    meta: [
      { title: "Tyre Setup — My Race Engineer" },
      { name: "description", content: "Enter compound, load, current pressures, and track temperature to get a recommended cold-pressure baseline." },
    ],
  }),
});

// Baseline cold pressure (psi) per compound at a 25°C track reference and ~1000 kg load.
const COMPOUND_BASE: Record<string, { cold: number; hotMin: number; hotMax: number; label: string }> = {
  soft:   { cold: 25, hotMin: 30, hotMax: 33, label: "Soft" },
  medium: { cold: 27, hotMin: 31, hotMax: 34, label: "Medium" },
  hard:   { cold: 29, hotMin: 32, hotMax: 35, label: "Hard" },
  wet:    { cold: 24, hotMin: 28, hotMax: 31, label: "Wet" },
};
const TRACK_REF_C = 25;
const LOAD_REF_KG = 1000;
// Heuristics: every +10°C of track temp drops cold target ~0.5 psi (rubber gains more heat).
// Every +100 kg above reference adds ~0.5 psi to support the extra load.
const PSI_PER_C = 0.05;
const PSI_PER_KG = 0.005;

function TyreSetupPage() {
  const { pressureUnit, tempUnit, system, toDisplayPressure } = useUnits();
  const [compound, setCompound] = useState("medium");
  const [load, setLoad] = useState("1100");
  const [trackTemp, setTrackTemp] = useState("28");
  const [currentCold, setCurrentCold] = useState({ fl: "", fr: "", rl: "", rr: "" });

  const base = COMPOUND_BASE[compound];

  const recommendation = useMemo(() => {
    const loadN = parseFloat(load);
    const trackN = parseFloat(trackTemp);
    if (!base) return null;
    // Inputs assumed metric (°C, kg). Apply both corrections then convert for display.
    const tempDelta = isNaN(trackN) ? 0 : (trackN - TRACK_REF_C) * -PSI_PER_C;
    const loadDelta = isNaN(loadN) ? 0 : ((loadN - LOAD_REF_KG) / 100) * (PSI_PER_KG * 100);
    const coldPsi = base.cold + tempDelta + loadDelta;
    const hotMinPsi = base.hotMin + tempDelta + loadDelta;
    const hotMaxPsi = base.hotMax + tempDelta + loadDelta;
    const fmt = (psi: number) =>
      (system === "imperial" ? psi : toDisplayPressure(psi)).toFixed(1);
    return { cold: fmt(coldPsi), hotMin: fmt(hotMinPsi), hotMax: fmt(hotMaxPsi) };
  }, [base, load, trackTemp, system, toDisplayPressure]);

  return (
    <div>
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>
      <div className="mt-4">
        <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
          <Disc className="w-3 h-3" /> Baseline
        </div>
        <h1 className="font-display text-4xl font-bold mt-1">Tyre Setup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick compound, enter car load and track temp, optionally log your current cold pressures.
          You get a recommended cold-set baseline plus the hot window to aim for.
        </p>
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border bg-card p-5 shadow-card space-y-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider">Inputs</h2>
          <div>
            <Label>Compound</Label>
            <Select value={compound} onValueChange={setCompound}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(COMPOUND_BASE).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Car + driver load (kg)</Label>
              <Input type="number" inputMode="decimal" value={load}
                onChange={(e) => setLoad(e.target.value)} className="font-mono" />
            </div>
            <div>
              <Label>Track temp ({tempUnit})</Label>
              <Input type="number" inputMode="decimal" value={trackTemp}
                onChange={(e) => setTrackTemp(e.target.value)} className="font-mono" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Current cold pressures ({pressureUnit}) — optional
            </Label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {(["fl","fr","rl","rr"] as const).map((k) => (
                <Input key={k} className="font-mono text-center" placeholder={k.toUpperCase()}
                  type="number" step="any" value={currentCold[k]}
                  onChange={(e) => setCurrentCold({ ...currentCold, [k]: e.target.value })} />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-primary/30 bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="w-4 h-4 text-primary" />
            <h2 className="font-display text-lg font-bold uppercase tracking-wider">Recommended baseline</h2>
          </div>
          {recommendation ? (
            <>
              <div className="rounded-md border border-border bg-background/50 p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Cold target (all corners)</div>
                <div className="font-mono text-4xl font-bold text-primary mt-1">
                  {recommendation.cold} <span className="text-base text-muted-foreground">{pressureUnit}</span>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-border bg-background/50 p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Hot working window</div>
                <div className="font-mono text-2xl font-bold mt-1">
                  {recommendation.hotMin} – {recommendation.hotMax} <span className="text-sm text-muted-foreground">{pressureUnit}</span>
                </div>
              </div>
              {Object.values(currentCold).some((v) => v) && (
                <div className="mt-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Delta vs current cold</div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {(["fl","fr","rl","rr"] as const).map((k) => {
                      const cur = parseFloat(currentCold[k]);
                      const target = parseFloat(recommendation.cold);
                      const diff = isNaN(cur) ? null : target - cur;
                      return (
                        <div key={k} className="rounded-md border border-border bg-background/50 p-2">
                          <div className="font-display font-bold uppercase text-xs">{k}</div>
                          <div className={`font-mono text-sm ${diff == null ? "text-muted-foreground" : diff > 0 ? "text-chart-3" : diff < 0 ? "text-chart-1" : ""}`}>
                            {diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Reference: {base.label} compound at {TRACK_REF_C}°C track, {LOAD_REF_KG} kg load.
                Cold target shifts −{PSI_PER_C.toFixed(2)} psi per °C above reference and +{(PSI_PER_KG * 100).toFixed(2)} psi per 100 kg over reference.
              </p>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Pick a compound to see a recommendation.</div>
          )}
        </div>
      </div>

      <StintProjector base={base} />
    </div>
  );
}

// Stint heat-gain projection. Rubber gain saturates over the first ~15 min;
// model as gain = G_max * (1 - exp(-t/tau)), tau ≈ 6 min.
// G_max grows with track temp and the gap between track and ambient (radiative load).
const TAU_MIN = 6;
const GAIN_PER_TRACK_C = 0.08;     // psi per °C of track temp
const GAIN_PER_DELTA_C = 0.04;     // psi per °C of (track - ambient)
const GAIN_BASE_PSI = 2.5;          // floor heat gain on a warm day, short stint

function StintProjector({ base }: { base: { hotMin: number; hotMax: number; label: string } | undefined }) {
  const { pressureUnit, tempUnit, system, toDisplayPressure } = useUnits();
  const [trackC, setTrackC] = useState("28");
  const [ambientC, setAmbientC] = useState("22");
  const [stintMin, setStintMin] = useState("20");
  const [cold, setCold] = useState({ fl: "", fr: "", rl: "", rr: "" });

  const t = parseFloat(stintMin);
  const track = parseFloat(trackC);
  const amb = parseFloat(ambientC);
  const saturate = isNaN(t) ? 0 : 1 - Math.exp(-Math.max(0, t) / TAU_MIN);
  const gMax = GAIN_BASE_PSI
    + (isNaN(track) ? 0 : Math.max(0, track - 20) * GAIN_PER_TRACK_C)
    + (isNaN(track) || isNaN(amb) ? 0 : Math.max(0, track - amb) * GAIN_PER_DELTA_C);
  const gainPsi = gMax * saturate;

  const fmt = (psi: number) => (system === "imperial" ? psi : toDisplayPressure(psi)).toFixed(1);

  const projection = (corner: keyof typeof cold) => {
    const c = parseFloat(cold[corner]);
    if (isNaN(c)) return null;
    // cold is in display units already; convert gain to display units too
    const gainDisplay = system === "imperial" ? gainPsi : gainPsi / 14.5038;
    const hot = c + gainDisplay;
    let advice: "low" | "ok" | "high" = "ok";
    if (base) {
      const hotDisp = system === "imperial" ? hot : hot;
      const minDisp = system === "imperial" ? base.hotMin : base.hotMin / 14.5038;
      const maxDisp = system === "imperial" ? base.hotMax : base.hotMax / 14.5038;
      if (hotDisp < minDisp) advice = "low";
      else if (hotDisp > maxDisp) advice = "high";
    }
    return { hot: hot.toFixed(1), advice };
  };

  return (
    <div className="mt-6 rounded-lg border border-primary/30 bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <Thermometer className="w-4 h-4 text-primary" />
        <h2 className="font-display text-lg font-bold uppercase tracking-wider">Stint pressure projection</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Enter today's track + ambient temps, your planned stint length, and the cold pressures you'd set on the grid.
        You get the expected hot pressure per corner and whether it lands in the working window.
      </p>

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label>Track temp ({tempUnit})</Label>
          <Input type="number" inputMode="decimal" value={trackC} onChange={(e) => setTrackC(e.target.value)} className="font-mono" />
        </div>
        <div>
          <Label>Ambient temp ({tempUnit})</Label>
          <Input type="number" inputMode="decimal" value={ambientC} onChange={(e) => setAmbientC(e.target.value)} className="font-mono" />
        </div>
        <div>
          <Label>Stint duration (min)</Label>
          <Input type="number" inputMode="decimal" value={stintMin} onChange={(e) => setStintMin(e.target.value)} className="font-mono" />
        </div>
      </div>

      <div className="mt-4">
        <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Cold-set pressures ({pressureUnit})
        </Label>
        <div className="grid grid-cols-4 gap-2 mt-1">
          {(["fl","fr","rl","rr"] as const).map((k) => (
            <Input key={k} placeholder={k.toUpperCase()} type="number" step="any"
              value={cold[k]} onChange={(e) => setCold({ ...cold, [k]: e.target.value })}
              className="font-mono text-center" />
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-md border border-border bg-background/50 p-4">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Estimated heat gain</div>
            <div className="font-mono text-2xl font-bold text-primary">
              +{fmt(gainPsi)} <span className="text-sm text-muted-foreground">{pressureUnit}</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Saturates at ~{fmt(gMax)} {pressureUnit} after a long stint · τ ≈ {TAU_MIN} min
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {(["fl","fr","rl","rr"] as const).map((k) => {
            const p = projection(k);
            const color = !p ? "text-muted-foreground"
              : p.advice === "low" ? "text-chart-2"
              : p.advice === "high" ? "text-chart-1"
              : "text-chart-3";
            const tag = !p ? "" : p.advice === "low" ? "↓ low" : p.advice === "high" ? "↑ high" : "✓ in band";
            return (
              <div key={k} className="rounded-md border border-border bg-background/30 p-2">
                <div className="font-display font-bold uppercase text-xs">{k}</div>
                <div className={`font-mono text-lg font-bold ${color}`}>{p?.hot ?? "—"}</div>
                <div className={`font-mono text-[10px] uppercase tracking-widest ${color}`}>{tag}</div>
              </div>
            );
          })}
        </div>
        {base && (
          <div className="mt-3 text-[11px] text-muted-foreground font-mono uppercase tracking-widest">
            Window: {fmt(base.hotMin)}–{fmt(base.hotMax)} {pressureUnit} · {base.label}
          </div>
        )}
      </div>
    </div>
  );
}