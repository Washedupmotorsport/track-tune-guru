import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, GitCompare, Grid2x2, Download, Thermometer, Activity } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";

export const Route = createFileRoute("/_authenticated/tyre-compare")({
  component: TyreComparePage,
  head: () => ({
    meta: [
      { title: "Tyre Compare — My Race Engineer" },
      { name: "description", content: "Compare expected grip, warm-up, peak temperature window, and stint longevity across compounds." },
    ],
  }),
});

type Compound = {
  key: string;
  label: string;
  grip: number;         // 0-100, peak grip on optimal day
  warmup: number;       // 0-100, how fast it switches on (higher = quicker)
  longevity: number;    // 0-100, raw stint life
  peakTempC: number;    // tread temp where it works best
  tempWindowC: number;  // ± half-width of usable window
  wetOk: boolean;
  wearMmPerLap: number; // baseline wear at reference conditions
};

const COMPOUNDS: Compound[] = [
  { key: "soft",   label: "Soft",   grip: 95, warmup: 90, longevity: 35, peakTempC: 85,  tempWindowC: 15, wetOk: false, wearMmPerLap: 0.08 },
  { key: "medium", label: "Medium", grip: 82, warmup: 70, longevity: 65, peakTempC: 95,  tempWindowC: 18, wetOk: false, wearMmPerLap: 0.05 },
  { key: "hard",   label: "Hard",   grip: 70, warmup: 45, longevity: 90, peakTempC: 105, tempWindowC: 22, wetOk: false, wearMmPerLap: 0.03 },
  { key: "wet",    label: "Wet",    grip: 60, warmup: 95, longevity: 50, peakTempC: 55,  tempWindowC: 20, wetOk: true,  wearMmPerLap: 0.07 },
];

const COMPOUND_COLORS: Record<string, string> = {
  soft: "hsl(var(--chart-1))",
  medium: "hsl(var(--chart-2))",
  hard: "hsl(var(--chart-3))",
  wet: "hsl(var(--chart-4))",
};

// Effective grip for a compound at a given track temp + condition. Mirrors the row calc.
function effectiveGripAt(c: Compound, trackTempC: number, condition: "dry" | "wet") {
  const treadC = trackTempC + (condition === "wet" ? 5 : 30);
  const dist = Math.abs(treadC - c.peakTempC);
  const inWindow = dist <= c.tempWindowC;
  const tempPenalty = inWindow ? 0 : Math.min(40, (dist - c.tempWindowC) * 1.8);
  let g = Math.max(0, c.grip - tempPenalty);
  if (condition === "wet" && !c.wetOk) g = Math.max(5, g * 0.25);
  if (condition === "dry" && c.wetOk) g = Math.max(10, g * 0.5);
  return g;
}

// Determine the winning compound at a given track temp + weight mix.
function bestCompoundAt(trackTempC: number, condition: "dry" | "wet", gw: number, ww: number, lw: number) {
  const totalW = gw + ww + lw || 1;
  let winner = COMPOUNDS[0];
  let bestScore = -Infinity;
  for (const c of COMPOUNDS) {
    const eg = effectiveGripAt(c, trackTempC, condition);
    const score = (eg * gw + c.warmup * ww + c.longevity * lw) / totalW;
    if (score > bestScore) { bestScore = score; winner = c; }
  }
  return { winner, score: bestScore };
}

function TyreComparePage() {
  const [trackC, setTrackC] = useState("28");
  const [stintLaps, setStintLaps] = useState("20");
  const [condition, setCondition] = useState<"dry" | "wet">("dry");
  const [layout, setLayout] = useState<"balanced" | "left" | "right">("right");
  const [balance, setBalance] = useState<"neutral" | "understeer" | "oversteer">("neutral");
  const [newTreadMm, setNewTreadMm] = useState("4");
  const [sweepMinC, setSweepMinC] = useState("5");
  const [sweepMaxC, setSweepMaxC] = useState("50");
  const [sweepCondition, setSweepCondition] = useState<"both" | "dry" | "wet">("both");
  const [gripW, setGripW] = useState("50");
  const [warmupW, setWarmupW] = useState("25");
  const [longevityW, setLongevityW] = useState("25");
  const [sensAxis, setSensAxis] = useState<"grip" | "warmup" | "longevity">("grip");
  const [sensCondition, setSensCondition] = useState<"dry" | "wet">("dry");

  const rows = useMemo(() => {
    const track = parseFloat(trackC);
    const laps = Math.max(0, parseFloat(stintLaps) || 0);
    const gw = Math.max(0, parseFloat(gripW) || 0);
    const ww = Math.max(0, parseFloat(warmupW) || 0);
    const lw = Math.max(0, parseFloat(longevityW) || 0);
    const totalW = gw + ww + lw || 1;
    return COMPOUNDS.map((c) => {
      // Estimate tread temp ~ track + 30°C on dry running. For wet, much cooler.
      const treadC = (isNaN(track) ? 25 : track) + (condition === "wet" ? 5 : 30);
      const dist = Math.abs(treadC - c.peakTempC);
      const inWindow = dist <= c.tempWindowC;
      // Effective grip falls off outside the temp window.
      const tempPenalty = inWindow ? 0 : Math.min(40, (dist - c.tempWindowC) * 1.8);
      let effectiveGrip = Math.max(0, c.grip - tempPenalty);
      if (condition === "wet" && !c.wetOk) effectiveGrip = Math.max(5, effectiveGrip * 0.25);
      if (condition === "dry" && c.wetOk) effectiveGrip = Math.max(10, effectiveGrip * 0.5);
      // Wear scales with grip pressure (hot tread) and laps.
      const wearMm = c.wearMmPerLap * laps * (1 + Math.max(0, treadC - c.peakTempC) * 0.01);
      const stintLifeLaps = Math.round((4 / c.wearMmPerLap) * (condition === "wet" && !c.wetOk ? 0.6 : 1));
      // Weighted score: normalize each attribute to 0-100 then apply weights.
      const score = (effectiveGrip * gw + c.warmup * ww + c.longevity * lw) / totalW;
      return { c, treadC, effectiveGrip, inWindow, wearMm, stintLifeLaps, score };
    });
  }, [trackC, stintLaps, condition, gripW, warmupW, longevityW]);

  // Per-corner wear bias. Multipliers sum roughly to 4 so total wear ≈ wearMm * 4.
  // Layout: right-handed circuits load fronts & left-side tyres more, etc.
  // Balance: understeer eats fronts, oversteer eats rears.
  const cornerBias = useMemo(() => {
    const base = { FL: 1, FR: 1, RL: 1, RR: 1 };
    if (layout === "right") { base.FL *= 1.20; base.RL *= 1.15; base.FR *= 0.90; base.RR *= 0.85; }
    if (layout === "left")  { base.FR *= 1.20; base.RR *= 1.15; base.FL *= 0.90; base.RL *= 0.85; }
    if (balance === "understeer") { base.FL *= 1.15; base.FR *= 1.15; base.RL *= 0.92; base.RR *= 0.92; }
    if (balance === "oversteer")  { base.RL *= 1.15; base.RR *= 1.15; base.FL *= 0.92; base.FR *= 0.92; }
    return base;
  }, [layout, balance]);

  const newMm = Math.max(0.1, parseFloat(newTreadMm) || 4);
  const corners: Array<"FL" | "FR" | "RL" | "RR"> = ["FL", "FR", "RL", "RR"];

  // Temperature sweep: effective grip per compound across a range of track temps.
  const sweep = useMemo(() => {
    const lo = Math.min(parseFloat(sweepMinC) || 5, parseFloat(sweepMaxC) || 50);
    const hi = Math.max(parseFloat(sweepMinC) || 5, parseFloat(sweepMaxC) || 50);
    const steps = 28;
    const temps = Array.from({ length: steps + 1 }, (_, i) => lo + ((hi - lo) * i) / steps);
    return { lo, hi, temps };
  }, [sweepMinC, sweepMaxC]);

  const downloadReport = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const M = 40;
    let y = M;

    doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text("Tyre Compound Comparison", M, y); y += 22;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(110);
    doc.text(`Generated ${new Date().toLocaleString()}`, M, y); y += 18;
    doc.setTextColor(0);

    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Inputs", M, y); y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const inputs = [
      `Track temp: ${trackC} °C`,
      `Planned stint: ${stintLaps} laps`,
      `Condition: ${condition}`,
      `Circuit layout: ${layout}`,
      `Car balance: ${balance}`,
      `New tread: ${newMm.toFixed(2)} mm`,
      `Priority: grip ${gripW}% / warm-up ${warmupW}% / longevity ${longevityW}%`,
    ];
    inputs.forEach((t) => { doc.text(t, M, y); y += 13; });
    y += 8;

    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Compound summary", M, y); y += 14;
    doc.setFontSize(9);
    const headers = ["Compound", "Score", "Eff. grip", "Raw grip", "Longev.", "Tread °C", "In win.", "Wear/stint", "Stint life"];
    const colX = [M, M+60, M+110, M+170, M+225, M+280, M+335, M+385, M+455];
    headers.forEach((h, i) => doc.text(h, colX[i], y));
    y += 4; doc.line(M, y, W - M, y); y += 12;
    doc.setFont("helvetica", "normal");
    rows.forEach((r) => {
      const vals = [
        r.c.label,
        r.score.toFixed(1),
        r.effectiveGrip.toFixed(0),
        r.c.grip.toFixed(0),
        r.c.longevity.toFixed(0),
        r.treadC.toFixed(0),
        r.inWindow ? "yes" : "no",
        `${r.wearMm.toFixed(2)} mm`,
        `${r.stintLifeLaps} laps`,
      ];
      vals.forEach((v, i) => doc.text(v, colX[i], y));
      y += 13;
    });
    y += 12;

    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Per-corner wear forecast (mm worn / mm remaining)", M, y); y += 14;
    doc.setFontSize(9);
    const wHeaders = ["Compound", "FL", "FR", "RL", "RR", "Total"];
    const wColX = [M, M+110, M+190, M+270, M+350, M+430];
    wHeaders.forEach((h, i) => doc.text(h, wColX[i], y));
    y += 4; doc.line(M, y, W - M, y); y += 12;
    doc.setFont("helvetica", "normal");
    rows.forEach((r) => {
      const perCorner = corners.map((k) => {
        const wear = r.wearMm * cornerBias[k];
        return { k, wear, remaining: Math.max(0, newMm - wear) };
      });
      const total = perCorner.reduce((s, p) => s + p.wear, 0);
      doc.text(r.c.label, wColX[0], y);
      perCorner.forEach((p, i) => {
        doc.text(`${p.wear.toFixed(2)} / ${p.remaining.toFixed(2)}`, wColX[i + 1], y);
      });
      doc.text(`${total.toFixed(2)} mm`, wColX[5], y);
      y += 13;
    });
    y += 10;
    doc.setFontSize(8); doc.setTextColor(110);
    doc.text("Estimates based on baseline compound model; tune against your own stint data for accuracy.", M, y);

    const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    doc.save(`tyre-compare-${condition}-${ts}.pdf`);
  };

  const best = rows.reduce((b, r) => (r.score > b.score ? r : b), rows[0]);

  return (
    <div>
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>
      <div className="mt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
              <GitCompare className="w-3 h-3" /> Compare
            </div>
            <h1 className="font-display text-4xl font-bold mt-1">Compound Comparison</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              See how each available compound trades grip for longevity at your conditions, plus where each one sits versus its ideal tread-temperature window.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadReport} className="shrink-0">
            <Download className="w-4 h-4 mr-1" /> Download PDF
          </Button>
        </div>
      </div>

      <div className="mt-6 grid sm:grid-cols-3 gap-3 rounded-lg border border-border bg-card p-5 shadow-card">
        <div>
          <Label>Track temp (°C)</Label>
          <Input type="number" inputMode="decimal" value={trackC} onChange={(e) => setTrackC(e.target.value)} className="font-mono" />
        </div>
        <div>
          <Label>Planned stint (laps)</Label>
          <Input type="number" inputMode="decimal" value={stintLaps} onChange={(e) => setStintLaps(e.target.value)} className="font-mono" />
        </div>
        <div>
          <Label>Condition</Label>
          <Select value={condition} onValueChange={(v) => setCondition(v as "dry" | "wet")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dry">Dry</SelectItem>
              <SelectItem value="wet">Wet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card p-5 shadow-card">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Balance priority</div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>Grip</span>
              <span className="text-primary">{gripW}%</span>
            </div>
            <input
              type="range" min={0} max={100} value={gripW}
              onChange={(e) => setGripW(e.target.value)}
              className="w-full accent-[hsl(var(--primary))]"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>Warm-up</span>
              <span className="text-primary">{warmupW}%</span>
            </div>
            <input
              type="range" min={0} max={100} value={warmupW}
              onChange={(e) => setWarmupW(e.target.value)}
              className="w-full accent-[hsl(var(--primary))]"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span>Longevity</span>
              <span className="text-primary">{longevityW}%</span>
            </div>
            <input
              type="range" min={0} max={100} value={longevityW}
              onChange={(e) => setLongevityW(e.target.value)}
              className="w-full accent-[hsl(var(--primary))]"
            />
          </div>
        </div>
      </div>

      {best && (
        <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-5 flex items-center gap-4">
          <div className="flex-1">
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary">Recommended compound</div>
            <div className="font-display text-2xl font-bold mt-1">{best.c.label} — {best.score.toFixed(1)} pts</div>
            <p className="text-sm text-muted-foreground mt-1">
              Best balanced choice for grip {gripW}% · warm-up {warmupW}% · longevity {longevityW}%
            </p>
          </div>
          <div className="hidden sm:grid grid-cols-3 gap-3 text-xs font-mono">
            <Stat k="Eff. grip" v={`${best.effectiveGrip.toFixed(0)}`} />
            <Stat k="Warm-up" v={`${best.c.warmup}`} />
            <Stat k="Longevity" v={`${best.c.longevity}`} />
          </div>
        </div>
      )}

      <div className="mt-6 grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {rows.map((r) => {
          const isBest = r === best && r.score > 0;
          const gw = Math.max(0, parseFloat(gripW) || 0);
          const ww = Math.max(0, parseFloat(warmupW) || 0);
          const lw = Math.max(0, parseFloat(longevityW) || 0);
          const totalW = gw + ww + lw || 1;
          const gripContrib = (r.effectiveGrip * gw) / totalW;
          const warmupContrib = (r.c.warmup * ww) / totalW;
          const longContrib = (r.c.longevity * lw) / totalW;
          return (
            <div
              key={r.c.key}
              className={`rounded-lg border p-5 shadow-card bg-card relative overflow-hidden ${isBest ? "border-primary/60 ring-1 ring-primary/20" : "border-border"}`}
            >
              {isBest && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-bl-md">
                  Best pick
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-bold uppercase tracking-wider">{r.c.label}</h2>
                <span className="font-mono text-sm font-bold text-primary">{r.score.toFixed(1)}</span>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Weighted score</div>
              <Bar label="Effective grip" value={r.effectiveGrip} max={100} accent />
              <Bar label="Raw grip" value={r.c.grip} max={100} />
              <Bar label="Warm-up" value={r.c.warmup} max={100} />
              <Bar label="Longevity" value={r.c.longevity} max={100} />
              {isBest && (
                <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-3">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-primary mb-2">Why this wins</div>
                  <div className="space-y-2">
                    <WhyRow label="Grip" value={gripContrib} total={r.score} color="bg-chart-1" />
                    <WhyRow label="Warm-up" value={warmupContrib} total={r.score} color="bg-chart-2" />
                    <WhyRow label="Longevity" value={longContrib} total={r.score} color="bg-chart-3" />
                  </div>
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono">
                <Stat k="Peak temp" v={`${r.c.peakTempC}°C`} />
                <Stat k="Window" v={`±${r.c.tempWindowC}°C`} />
                <Stat k="Est. tread" v={`${r.treadC.toFixed(0)}°C`} good={r.inWindow} />
                <Stat k="Stint life" v={`${r.stintLifeLaps} laps`} />
                <Stat k="Wear / stint" v={`${r.wearMm.toFixed(2)} mm`} />
                <Stat k="Wet OK" v={r.c.wetOk ? "yes" : "no"} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
          <Grid2x2 className="w-3 h-3" /> Per-corner wear forecast
        </div>
        <h2 className="font-display text-2xl font-bold mt-1">Wear per corner × compound</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Predicted tread loss at each corner over the planned stint, biased by circuit layout and car balance. Remaining tread assumes a fresh tyre at the depth below.
        </p>

        <div className="mt-4 grid sm:grid-cols-3 gap-3 rounded-lg border border-border bg-card p-5 shadow-card">
          <div>
            <Label>Circuit layout</Label>
            <Select value={layout} onValueChange={(v) => setLayout(v as typeof layout)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="right">Right-handed (CW)</SelectItem>
                <SelectItem value="left">Left-handed (CCW)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Car balance</Label>
            <Select value={balance} onValueChange={(v) => setBalance(v as typeof balance)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="understeer">Understeer</SelectItem>
                <SelectItem value="oversteer">Oversteer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>New tread (mm)</Label>
            <Input type="number" inputMode="decimal" value={newTreadMm} onChange={(e) => setNewTreadMm(e.target.value)} className="font-mono" />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Compound</th>
                {corners.map((k) => (
                  <th key={k} className="text-right px-4 py-2">{k}</th>
                ))}
                <th className="text-right px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const perCorner = corners.map((k) => {
                  const wear = r.wearMm * cornerBias[k];
                  const remaining = Math.max(0, newMm - wear);
                  const pctLeft = Math.max(0, Math.min(100, (remaining / newMm) * 100));
                  return { k, wear, remaining, pctLeft };
                });
                const total = perCorner.reduce((s, p) => s + p.wear, 0);
                return (
                  <tr key={r.c.key} className="border-t border-border">
                    <td className="px-4 py-3 font-display font-bold uppercase tracking-wider">{r.c.label}</td>
                    {perCorner.map((p) => (
                      <td key={p.k} className="px-4 py-3 text-right font-mono">
                        <div className={p.remaining <= 0.5 ? "text-chart-1" : p.pctLeft < 40 ? "text-chart-5" : "text-foreground"}>
                          {p.wear.toFixed(2)} mm
                        </div>
                        <div className="text-[10px] text-muted-foreground">{p.remaining.toFixed(2)} mm left</div>
                        <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full ${p.pctLeft < 25 ? "bg-chart-1" : p.pctLeft < 50 ? "bg-chart-5" : "bg-primary"}`}
                            style={{ width: `${100 - p.pctLeft}%` }}
                          />
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-mono">{total.toFixed(2)} mm</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
          <Thermometer className="w-3 h-3" /> Track temp sweep
        </div>
        <h2 className="font-display text-2xl font-bold mt-1">Grip vs track temperature</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Effective grip for each compound across a range of track temps. Solid lines = dry running, dashed = wet running. The vertical marker is your current track temp.
        </p>

        <div className="mt-4 grid sm:grid-cols-3 gap-3 rounded-lg border border-border bg-card p-5 shadow-card">
          <div>
            <Label>Sweep min (°C)</Label>
            <Input type="number" inputMode="decimal" value={sweepMinC} onChange={(e) => setSweepMinC(e.target.value)} className="font-mono" />
          </div>
          <div>
            <Label>Sweep max (°C)</Label>
            <Input type="number" inputMode="decimal" value={sweepMaxC} onChange={(e) => setSweepMaxC(e.target.value)} className="font-mono" />
          </div>
          <div>
            <Label>Show</Label>
            <Select value={sweepCondition} onValueChange={(v) => setSweepCondition(v as typeof sweepCondition)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Dry + Wet</SelectItem>
                <SelectItem value="dry">Dry only</SelectItem>
                <SelectItem value="wet">Wet only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-card p-5 shadow-card">
          <SweepChart
            temps={sweep.temps}
            lo={sweep.lo}
            hi={sweep.hi}
            currentC={parseFloat(trackC) || 0}
            showDry={sweepCondition !== "wet"}
            showWet={sweepCondition !== "dry"}
          />
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-mono">
            {COMPOUNDS.map((c) => (
              <div key={c.key} className="flex items-center gap-2">
                <span className="inline-block w-3 h-0.5" style={{ background: COMPOUND_COLORS[c.key] }} />
                <span className="uppercase tracking-widest text-muted-foreground">{c.label}</span>
                <span className="text-muted-foreground">· peak {c.peakTempC + (c.wetOk ? -5 : -30)}°C track</span>
              </div>
            ))}
            <div className="flex items-center gap-3 ml-auto text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block w-4 h-px bg-foreground" /> dry</span>
              <span className="flex items-center gap-1"><span className="inline-block w-4 border-t border-dashed border-foreground" /> wet</span>
            </div>
          </div>
        </div>
      </div>

      <SensitivityView
        sweepLo={sweep.lo}
        sweepHi={sweep.hi}
        currentC={parseFloat(trackC) || 0}
        gripW={parseFloat(gripW) || 0}
        warmupW={parseFloat(warmupW) || 0}
        longevityW={parseFloat(longevityW) || 0}
        axis={sensAxis}
        setAxis={setSensAxis}
        condition={sensCondition}
        setCondition={setSensCondition}
      />
    </div>
  );
}

function SweepChart({
  temps, lo, hi, currentC, showDry, showWet,
}: {
  temps: number[]; lo: number; hi: number; currentC: number; showDry: boolean; showWet: boolean;
}) {
  const W = 720, H = 240, PL = 36, PR = 12, PT = 12, PB = 28;
  const innerW = W - PL - PR, innerH = H - PT - PB;
  const x = (t: number) => PL + ((t - lo) / (hi - lo || 1)) * innerW;
  const y = (g: number) => PT + (1 - g / 100) * innerH;

  const buildPath = (c: Compound, condition: "dry" | "wet") =>
    temps
      .map((t, i) => `${i === 0 ? "M" : "L"} ${x(t).toFixed(1)} ${y(effectiveGripAt(c, t, condition)).toFixed(1)}`)
      .join(" ");

  const tempTicks = 6;
  const tickTemps = Array.from({ length: tempTicks + 1 }, (_, i) => lo + ((hi - lo) * i) / tempTicks);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Grip vs track temperature">
      {/* y gridlines */}
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={PL} x2={W - PR} y1={y(g)} y2={y(g)} stroke="hsl(var(--border))" strokeWidth={0.5} />
          <text x={PL - 6} y={y(g) + 3} fontSize="9" textAnchor="end" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{g}</text>
        </g>
      ))}
      {/* x ticks */}
      {tickTemps.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={H - PB} y2={H - PB + 4} stroke="hsl(var(--border))" />
          <text x={x(t)} y={H - PB + 14} fontSize="9" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{t.toFixed(0)}°</text>
        </g>
      ))}
      {/* current temp marker */}
      {currentC >= lo && currentC <= hi && (
        <g>
          <line x1={x(currentC)} x2={x(currentC)} y1={PT} y2={H - PB} stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="3 3" />
          <text x={x(currentC) + 4} y={PT + 10} fontSize="9" fill="hsl(var(--primary))" fontFamily="monospace">now {currentC.toFixed(0)}°</text>
        </g>
      )}
      {/* lines */}
      {COMPOUNDS.map((c) => (
        <g key={c.key}>
          {showDry && (
            <path d={buildPath(c, "dry")} fill="none" stroke={COMPOUND_COLORS[c.key]} strokeWidth={2} />
          )}
          {showWet && (
            <path d={buildPath(c, "wet")} fill="none" stroke={COMPOUND_COLORS[c.key]} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.85} />
          )}
        </g>
      ))}
      {/* axis labels */}
      <text x={PL} y={H - 4} fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="monospace">Track temp (°C)</text>
      <text x={W - PR} y={H - 4} fontSize="9" textAnchor="end" fill="hsl(var(--muted-foreground))" fontFamily="monospace">Effective grip (0–100)</text>
    </svg>
  );
}

function Bar({ label, value, max, accent }: { label: string; value: number; max: number; accent?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${accent ? "bg-primary" : "bg-foreground/40"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-background/50 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{k}</div>
      <div className={good === undefined ? "" : good ? "text-chart-3" : "text-chart-1"}>{v}</div>
    </div>
  );
}

function SensitivityView({
  sweepLo, sweepHi, currentC, gripW, warmupW, longevityW, axis, setAxis, condition, setCondition,
}: {
  sweepLo: number; sweepHi: number; currentC: number;
  gripW: number; warmupW: number; longevityW: number;
  axis: "grip" | "warmup" | "longevity";
  setAxis: (v: "grip" | "warmup" | "longevity") => void;
  condition: "dry" | "wet";
  setCondition: (v: "dry" | "wet") => void;
}) {
  const COLS = 32; // temp steps
  const ROWS = 24; // weight steps (0-100)

  // Build the 2D matrix: for each cell, override `axis` weight from 0-100,
  // keep the other two weights at their current values.
  const cells = useMemo(() => {
    const out: { key: string; label: string; score: number }[][] = [];
    for (let r = 0; r < ROWS; r++) {
      const wVal = (r / (ROWS - 1)) * 100;
      const gw = axis === "grip" ? wVal : gripW;
      const ww = axis === "warmup" ? wVal : warmupW;
      const lw = axis === "longevity" ? wVal : longevityW;
      const row: { key: string; label: string; score: number }[] = [];
      for (let c = 0; c < COLS; c++) {
        const t = sweepLo + ((sweepHi - sweepLo) * c) / (COLS - 1);
        const { winner, score } = bestCompoundAt(t, condition, gw, ww, lw);
        row.push({ key: winner.key, label: winner.label, score });
      }
      out.push(row);
    }
    return out;
  }, [sweepLo, sweepHi, gripW, warmupW, longevityW, axis, condition]);

  // Where the current settings sit on the matrix (for the crosshair).
  const curCol = Math.round(((currentC - sweepLo) / (sweepHi - sweepLo || 1)) * (COLS - 1));
  const curWeight = axis === "grip" ? gripW : axis === "warmup" ? warmupW : longevityW;
  const curRow = Math.round((curWeight / 100) * (ROWS - 1));

  // Compute which compounds actually win anywhere in the grid (for the legend).
  const winnersInGrid = useMemo(() => {
    const seen = new Set<string>();
    cells.forEach((row) => row.forEach((cell) => seen.add(cell.key)));
    return COMPOUNDS.filter((c) => seen.has(c.key));
  }, [cells]);

  const axisLabel = axis === "grip" ? "Grip weight" : axis === "warmup" ? "Warm-up weight" : "Longevity weight";

  return (
    <div className="mt-8">
      <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
        <Activity className="w-3 h-3" /> Sensitivity
      </div>
      <h2 className="font-display text-2xl font-bold mt-1">Recommended compound sensitivity</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
        How the winning compound shifts as you sweep one priority weight (vertical) against track temperature (horizontal). The crosshair marks your current setup — if you sit near a colour boundary, the call is fragile.
      </p>

      <div className="mt-4 grid sm:grid-cols-2 gap-3 rounded-lg border border-border bg-card p-5 shadow-card">
        <div>
          <Label>Sensitivity axis</Label>
          <Select value={axis} onValueChange={(v) => setAxis(v as typeof axis)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="grip">Vary grip weight</SelectItem>
              <SelectItem value="warmup">Vary warm-up weight</SelectItem>
              <SelectItem value="longevity">Vary longevity weight</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Condition</Label>
          <Select value={condition} onValueChange={(v) => setCondition(v as typeof condition)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dry">Dry</SelectItem>
              <SelectItem value="wet">Wet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card p-5 shadow-card">
        <SensitivityHeatmap
          cells={cells}
          rows={ROWS}
          cols={COLS}
          curRow={curRow}
          curCol={curCol}
          sweepLo={sweepLo}
          sweepHi={sweepHi}
          axisLabel={axisLabel}
        />
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-mono">
          {winnersInGrid.map((c) => (
            <div key={c.key} className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COMPOUND_COLORS[c.key] }} />
              <span className="uppercase tracking-widest text-muted-foreground">{c.label}</span>
            </div>
          ))}
          <div className="ml-auto text-muted-foreground">
            {winnersInGrid.length === 1
              ? "Robust — same pick across the whole range."
              : `${winnersInGrid.length} compounds win somewhere — pick is sensitive.`}
          </div>
        </div>
      </div>
    </div>
  );
}

function SensitivityHeatmap({
  cells, rows, cols, curRow, curCol, sweepLo, sweepHi, axisLabel,
}: {
  cells: { key: string; label: string; score: number }[][];
  rows: number; cols: number; curRow: number; curCol: number;
  sweepLo: number; sweepHi: number; axisLabel: string;
}) {
  const W = 720, H = 280, PL = 90, PR = 12, PT = 12, PB = 40;
  const innerW = W - PL - PR, innerH = H - PT - PB;
  const cw = innerW / cols;
  const ch = innerH / rows;

  const tempTicks = 6;
  const tickTemps = Array.from({ length: tempTicks + 1 }, (_, i) => sweepLo + ((sweepHi - sweepLo) * i) / tempTicks);
  const weightTicks = [0, 25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Compound sensitivity heatmap">
      {cells.map((row, r) =>
        row.map((cell, c) => (
          <rect
            key={`${r}-${c}`}
            x={PL + c * cw}
            // r=0 means weight=0 → draw at bottom; flip vertically.
            y={PT + (rows - 1 - r) * ch}
            width={cw + 0.5}
            height={ch + 0.5}
            fill={COMPOUND_COLORS[cell.key]}
            opacity={0.85}
          />
        )),
      )}
      {/* current crosshair */}
      {curCol >= 0 && curCol < cols && curRow >= 0 && curRow < rows && (
        <rect
          x={PL + curCol * cw - 1}
          y={PT + (rows - 1 - curRow) * ch - 1}
          width={cw + 2}
          height={ch + 2}
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth={1.5}
        />
      )}
      {/* x-axis ticks (temperature) */}
      {tickTemps.map((t) => {
        const xPos = PL + ((t - sweepLo) / (sweepHi - sweepLo || 1)) * innerW;
        return (
          <g key={t}>
            <line x1={xPos} x2={xPos} y1={H - PB} y2={H - PB + 4} stroke="hsl(var(--border))" />
            <text x={xPos} y={H - PB + 14} fontSize="9" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{t.toFixed(0)}°</text>
          </g>
        );
      })}
      {/* y-axis ticks (weight 0-100) */}
      {weightTicks.map((w) => {
        const yPos = PT + (1 - w / 100) * innerH;
        return (
          <g key={w}>
            <line x1={PL - 4} x2={PL} y1={yPos} y2={yPos} stroke="hsl(var(--border))" />
            <text x={PL - 8} y={yPos + 3} fontSize="9" textAnchor="end" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{w}%</text>
          </g>
        );
      })}
      {/* axis labels */}
      <text x={PL} y={H - 6} fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="monospace">Track temp (°C)</text>
      <text
        x={-(PT + innerH / 2)}
        y={14}
        fontSize="9"
        textAnchor="middle"
        transform="rotate(-90)"
        fill="hsl(var(--muted-foreground))"
        fontFamily="monospace"
      >
        {axisLabel} (0–100%)
      </text>
    </svg>
  );
}