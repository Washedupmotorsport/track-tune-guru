import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Gauge } from "lucide-react";

// Rule of thumb: cold pressure rises ~0.1 psi per °C of ambient delta on track-day rubber.
// Plus the heat gain (hot - cold from your last run) is roughly constant for the same compound,
// so target cold = target hot - measured heat gain + ambient delta correction.
const PSI_PER_C = 0.1;

type Corners = "fl" | "fr" | "rl" | "rr";
const CORNERS: Corners[] = ["fl", "fr", "rl", "rr"];

export function PressureCalculator() {
  const [targetHot, setTargetHot] = useState("28");
  const [lastAmbient, setLastAmbient] = useState("");
  const [newAmbient, setNewAmbient] = useState("");
  const [cold, setCold] = useState<Record<Corners, string>>({ fl: "", fr: "", rl: "", rr: "" });
  const [hot, setHot] = useState<Record<Corners, string>>({ fl: "", fr: "", rl: "", rr: "" });

  const targetN = parseFloat(targetHot);
  const ambDelta = (parseFloat(newAmbient) || 0) - (parseFloat(lastAmbient) || 0);

  const recommendation = (c: Corners): string => {
    const cn = parseFloat(cold[c]);
    const hn = parseFloat(hot[c]);
    if (isNaN(cn) || isNaN(hn) || isNaN(targetN)) return "—";
    const heatGain = hn - cn;
    const newCold = targetN - heatGain - ambDelta * PSI_PER_C;
    return newCold.toFixed(1);
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="w-4 h-4 text-primary" />
        <h3 className="font-display text-base font-bold uppercase tracking-wider">Pressure target calculator</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Enter your last run's cold + hot pressures and ambient temps, plus a target hot pressure.
        Get cold-set pressures for the next run, adjusted for ambient delta (~{PSI_PER_C} psi/°C).
      </p>

      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        <div><Label>Target hot (psi)</Label><Input value={targetHot} onChange={(e) => setTargetHot(e.target.value)} className="font-mono" /></div>
        <div><Label>Last ambient °C</Label><Input value={lastAmbient} onChange={(e) => setLastAmbient(e.target.value)} className="font-mono" /></div>
        <div><Label>New ambient °C</Label><Input value={newAmbient} onChange={(e) => setNewAmbient(e.target.value)} className="font-mono" /></div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Corner</div>
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Last cold</div>
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Last hot</div>
        <div className="text-xs font-mono uppercase tracking-widest text-primary">New cold</div>
        {CORNERS.map((c) => (
          <div key={c} className="contents">
            <div className="flex items-center justify-center font-display font-bold uppercase">{c}</div>
            <Input value={cold[c]} onChange={(e) => setCold({ ...cold, [c]: e.target.value })} className="font-mono text-center" />
            <Input value={hot[c]} onChange={(e) => setHot({ ...hot, [c]: e.target.value })} className="font-mono text-center" />
            <div className="flex items-center justify-center font-mono font-bold text-primary text-lg">{recommendation(c)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}