import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Disc, Gauge } from "lucide-react";
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
    </div>
  );
}