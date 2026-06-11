import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ChevronDown, Disc, Download, Gauge, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnits } from "@/lib/units";
import { Stepper } from "@/components/stepper";
import { TyreTabs } from "@/components/tyre-tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import jsPDF from "jspdf";

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
const COMPOUND_KEYS = Object.keys(COMPOUND_BASE);
const TRACK_REF_C = 25;
const LOAD_REF_KG = 1000;
const PSI_PER_C = 0.05;
const PSI_PER_KG = 0.005;

const SET_OPTIONS = ["A", "B", "C", "D", "E"];

function TyreSetupPage() {
  const { pressureUnit, tempUnit, system, toDisplayPressure } = useUnits();
  const isMobile = useIsMobile();
  const [compound, setCompound] = useState("medium");
  const [heatCycles, setHeatCycles] = useState(0);
  const [setNumber, setSetNumber] = useState("A");
  const [load, setLoad] = useState("1100");
  const [trackTemp, setTrackTemp] = useState("28");
  const [currentCold, setCurrentCold] = useState({ fl: "", fr: "", rl: "", rr: "" });
  const [historyOpen, setHistoryOpen] = useState<boolean | null>(null);
  const showHistory = historyOpen ?? !isMobile;

  const base = COMPOUND_BASE[compound];

  const recommendation = useMemo(() => {
    const loadN = parseFloat(load);
    const trackN = parseFloat(trackTemp);
    if (!base) return null;
    const tempDelta = isNaN(trackN) ? 0 : (trackN - TRACK_REF_C) * -PSI_PER_C;
    const loadDelta = isNaN(loadN) ? 0 : ((loadN - LOAD_REF_KG) / 100) * (PSI_PER_KG * 100);
    const coldPsi = base.cold + tempDelta + loadDelta;
    const hotMinPsi = base.hotMin + tempDelta + loadDelta;
    const hotMaxPsi = base.hotMax + tempDelta + loadDelta;
    const fmt = (psi: number) =>
      (system === "imperial" ? psi : toDisplayPressure(psi)).toFixed(1);
    return { cold: fmt(coldPsi), hotMin: fmt(hotMinPsi), hotMax: fmt(hotMaxPsi), coldPsi, hotMinPsi, hotMaxPsi };
  }, [base, load, trackTemp, system, toDisplayPressure]);

  const cycleCompound = () => {
    const idx = COMPOUND_KEYS.indexOf(compound);
    setCompound(COMPOUND_KEYS[(idx + 1) % COMPOUND_KEYS.length]);
  };

  const cycleSet = () => {
    const idx = SET_OPTIONS.indexOf(setNumber);
    setSetNumber(SET_OPTIONS[(idx + 1) % SET_OPTIONS.length]);
  };

  const cycleHeatCycles = () => {
    setHeatCycles((v) => (v >= 10 ? 0 : v + 1));
  };

  const getPressureTone = (value: string): "cold" | "optimal" | "hot" | undefined => {
    if (!recommendation) return undefined;
    const v = parseFloat(value);
    if (isNaN(v)) return undefined;
    const target = parseFloat(recommendation.cold);
    const diff = v - target;
    if (diff < -1.5) return "cold";
    if (diff > 1.5) return "hot";
    return "optimal";
  };

  const downloadReport = () => {
    if (!recommendation || !base) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    let y = 56;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Tyre Setup Report", 48, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    y += 18;
    doc.text(new Date().toLocaleString(), 48, y);
    doc.setTextColor(0);
    y += 28;

    const section = (title: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(title.toUpperCase(), 48, y);
      doc.setDrawColor(200);
      doc.line(48, y + 4, W - 48, y + 4);
      y += 22;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
    };
    const row = (label: string, value: string) => {
      doc.setTextColor(110);
      doc.text(label, 56, y);
      doc.setTextColor(0);
      doc.text(value, 260, y);
      y += 18;
    };

    section("Inputs");
    row("Compound", base.label);
    row("Set", setNumber);
    row("Heat cycles", String(heatCycles));
    row("Car + driver load", `${load} kg`);
    row("Track temperature", `${trackTemp} ${tempUnit}`);
    const anyCold = Object.values(currentCold).some((v) => v);
    if (anyCold) {
      row("Current cold FL / FR", `${currentCold.fl || "—"} / ${currentCold.fr || "—"} ${pressureUnit}`);
      row("Current cold RL / RR", `${currentCold.rl || "—"} / ${currentCold.rr || "—"} ${pressureUnit}`);
    }
    y += 8;

    section("Recommended baseline");
    row("Cold target (all corners)", `${recommendation.cold} ${pressureUnit}`);
    row("Hot working window", `${recommendation.hotMin} – ${recommendation.hotMax} ${pressureUnit}`);
    y += 8;

    if (anyCold) {
      section("Recommended changes (cold)");
      const target = parseFloat(recommendation.cold);
      (["fl", "fr", "rl", "rr"] as const).forEach((k) => {
        const cur = parseFloat(currentCold[k]);
        if (isNaN(cur)) {
          row(k.toUpperCase(), `set to ${target.toFixed(1)} ${pressureUnit}`);
        } else {
          const diff = target - cur;
          const sign = diff > 0 ? "+" : "";
          const action = Math.abs(diff) < 0.05 ? "hold" : diff > 0 ? "add air" : "bleed";
          row(k.toUpperCase(), `${cur.toFixed(1)} → ${target.toFixed(1)} (${sign}${diff.toFixed(1)}) · ${action}`);
        }
      });
      y += 8;
    }

    section("Reference");
    doc.setFontSize(9);
    doc.setTextColor(110);
    const note = `Baseline at ${TRACK_REF_C} C track, ${LOAD_REF_KG} kg load. Cold target shifts -${PSI_PER_C.toFixed(2)} psi per C above reference and +${(PSI_PER_KG * 100).toFixed(2)} psi per 100 kg over reference.`;
    doc.text(doc.splitTextToSize(note, W - 96), 56, y);

    doc.save(`tyre-setup-${base.label.toLowerCase()}-${Date.now()}.pdf`);
  };

  return (
    <div>
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>
      <TyreTabs />

      {/* STICKY CHIP ROW */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-md border-b border-border mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cycleCompound}
            className="h-9 px-3 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider active:scale-95 transition touch-manipulation"
          >
            {COMPOUND_BASE[compound].label}
          </button>
          <button
            type="button"
            onClick={cycleHeatCycles}
            className="h-9 px-3 rounded-full border border-border bg-card text-xs font-bold font-mono active:scale-95 transition touch-manipulation"
          >
            {heatCycles} HC
          </button>
          <button
            type="button"
            onClick={cycleSet}
            className="h-9 px-3 rounded-full border border-border bg-card text-xs font-bold font-mono active:scale-95 transition touch-manipulation"
          >
            Set {setNumber}
          </button>
          <div className="ml-auto">
            <Button onClick={downloadReport} disabled={!recommendation} size="sm" variant="outline" className="h-9">
              <Download className="w-3.5 h-3.5 mr-1.5" /> PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
            <Disc className="w-3 h-3" /> Baseline
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Tyre Setup</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Pick compound, enter car load and track temp, optionally log your current cold pressures.
            You get a recommended cold-set baseline plus the hot window to aim for.
          </p>
        </div>
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-5 shadow-card space-y-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider">Inputs</h2>
          <div>
            <Label>Compound</Label>
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {Object.entries(COMPOUND_BASE).map(([k, v]) => {
                const active = compound === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCompound(k)}
                    className={
                      "h-12 rounded-md border-[1.5px] font-display font-bold uppercase tracking-wider text-sm transition-colors active:scale-[0.97] " +
                      (active
                        ? "border-primary bg-primary text-primary-foreground shadow-glow"
                        : "border-border bg-card text-foreground hover:border-primary/50")
                    }
                    aria-pressed={active}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stepper label="Car + driver load" unit="kg"
              value={load} step={10} min={400} max={2000} precision={0}
              onChange={setLoad} />
            <Stepper label="Track temp" unit={tempUnit}
              value={trackTemp} step={1} min={-10} max={70} precision={0}
              onChange={setTrackTemp} />
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Current cold pressures ({pressureUnit}) — tap +/-, hold for fine (0.1)
            </Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {(["fl","fr","rl","rr"] as const).map((k) => (
                <Stepper key={k} label={k.toUpperCase()} unit={pressureUnit}
                  value={currentCold[k]} step={0.5} fineStep={0.1} min={10} max={45} precision={1}
                  bgTone={getPressureTone(currentCold[k])}
                  onChange={(v) => setCurrentCold({ ...currentCold, [k]: v })} />
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

      {/* History / Stint Projector — collapsible on mobile */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !(v ?? !isMobile))}
          className="md:hidden flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary mb-3"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? "rotate-180" : ""}`} />
          History / Stint projection
        </button>
        {showHistory && <StintProjector base={base} />}
      </div>
    </div>
  );
}

// Stint heat-gain projection. Rubber gain saturates over the first ~15 min;
// model as gain = G_max * (1 - exp(-t/tau)), tau ≈ 6 min.
// G_max grows with track temp and the gap between track and ambient (radiative load).
const TAU_MIN = 6;
const GAIN_PER_TRACK_C = 0.08;
const GAIN_PER_DELTA_C = 0.04;
const GAIN_BASE_PSI = 2.5;

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
    <div className="rounded-lg border border-primary/30 bg-card p-5 shadow-card">
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
          Cold-set pressures ({pressureUnit}) — tap +/-, hold for fine (0.1)
        </Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {(["fl","fr","rl","rr"] as const).map((k) => (
            <Stepper key={k} label={k.toUpperCase()} unit={pressureUnit}
              value={cold[k]} step={0.5} fineStep={0.1} min={10} max={45} precision={1}
              onChange={(v) => setCold({ ...cold, [k]: v })} />
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
            Saturates at ~{fmt(gMax)} {pressureUnit} after a long stint
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {(["fl","fr","rl","rr"] as const).map((k) => {
            const p = projection(k);
            const color = !p ? "text-muted-foreground"
              : p.advice === "low" ? "text-chart-2"
              : p.advice === "high" ? "text-chart-1"
              : "text-chart-3";
            const tag = !p ? "" : p.advice === "low" ? "low" : p.advice === "high" ? "high" : "in band";
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
