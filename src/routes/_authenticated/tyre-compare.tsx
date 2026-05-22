import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, GitCompare } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  const best = rows.reduce((b, r) => (r.effectiveGrip > b.effectiveGrip ? r : b), rows[0]);

  return (
    <div>
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>
      <div className="mt-4">
        <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
          <GitCompare className="w-3 h-3" /> Compare
        </div>
        <h1 className="font-display text-4xl font-bold mt-1">Compound Comparison</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          See how each available compound trades grip for longevity at your conditions, plus where each one sits versus its ideal tread-temperature window.
        </p>
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