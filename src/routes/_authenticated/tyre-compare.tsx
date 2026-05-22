import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, GitCompare, Grid2x2, Download } from "lucide-react";
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

function TyreComparePage() {
  const [trackC, setTrackC] = useState("28");
  const [stintLaps, setStintLaps] = useState("20");
  const [condition, setCondition] = useState<"dry" | "wet">("dry");
  const [layout, setLayout] = useState<"balanced" | "left" | "right">("right");
  const [balance, setBalance] = useState<"neutral" | "understeer" | "oversteer">("neutral");
  const [newTreadMm, setNewTreadMm] = useState("4");

  const rows = useMemo(() => {
    const track = parseFloat(trackC);
    const laps = Math.max(0, parseFloat(stintLaps) || 0);
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
      return { c, treadC, effectiveGrip, inWindow, wearMm, stintLifeLaps };
    });
  }, [trackC, stintLaps, condition]);

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
    ];
    inputs.forEach((t) => { doc.text(t, M, y); y += 13; });
    y += 8;

    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Compound summary", M, y); y += 14;
    doc.setFontSize(9);
    const headers = ["Compound", "Eff. grip", "Raw grip", "Longev.", "Tread °C", "In win.", "Wear/stint", "Stint life"];
    const colX = [M, M+90, M+150, M+205, M+260, M+315, M+365, M+435];
    headers.forEach((h, i) => doc.text(h, colX[i], y));
    y += 4; doc.line(M, y, W - M, y); y += 12;
    doc.setFont("helvetica", "normal");
    rows.forEach((r) => {
      const vals = [
        r.c.label,
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

  const best = rows.reduce((b, r) => (r.effectiveGrip > b.effectiveGrip ? r : b), rows[0]);

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

      <div className="mt-6 grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {rows.map((r) => {
          const isBest = r === best && r.effectiveGrip > 0;
          return (
            <div
              key={r.c.key}
              className={`rounded-lg border p-5 shadow-card bg-card ${isBest ? "border-primary/60" : "border-border"}`}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-bold uppercase tracking-wider">{r.c.label}</h2>
                {isBest && <span className="font-mono text-[10px] uppercase tracking-widest text-primary">Best pick</span>}
              </div>
              <Bar label="Effective grip" value={r.effectiveGrip} max={100} accent />
              <Bar label="Raw grip" value={r.c.grip} max={100} />
              <Bar label="Warm-up" value={r.c.warmup} max={100} />
              <Bar label="Longevity" value={r.c.longevity} max={100} />
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
    </div>
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