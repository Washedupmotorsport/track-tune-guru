import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Stepper } from "@/components/stepper";
import { Gauge, Thermometer, Fuel, Wind, Activity, AlertTriangle } from "lucide-react";

type Data = Record<string, string>;

const num = (v: string | undefined, fallback = 0) => {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? n : fallback;
};

const psiColor = (psi: number) => {
  if (!psi) return "var(--muted-foreground)";
  if (psi < 25) return "oklch(0.62 0.18 244)"; // cold - blue
  if (psi > 32) return "oklch(0.62 0.22 27)"; // hot - red
  return "oklch(0.70 0.16 145)"; // optimal - green
};
const psiAccent = (psi: number): "cold" | "ok" | "hot" | "none" => {
  if (!psi) return "none";
  if (psi < 25) return "cold";
  if (psi > 32) return "hot";
  return "ok";
};

const tempColor = (t: number) => {
  if (!t) return "var(--muted)";
  if (t < 70) return "oklch(0.55 0.18 244)";
  if (t < 85) return "oklch(0.70 0.14 200)";
  if (t < 100) return "oklch(0.75 0.16 145)";
  if (t < 110) return "oklch(0.78 0.18 85)";
  return "oklch(0.62 0.24 27)";
};

const COMPLAINTS = [
  {
    id: "understeer_entry",
    label: "Understeer Entry",
    changes: [
      "Soften front ARB 1 step",
      "Front rebound −2 clicks",
      "Reduce front tyre pressure 0.5 psi",
      "Add 0.2° front camber (more negative)",
    ],
  },
  {
    id: "mid_corner_push",
    label: "Mid-Corner Push",
    changes: [
      "Increase rear ride height +2 mm",
      "Stiffen rear ARB 1 step",
      "Add 1% rear wing",
      "Reduce front toe-out 0.05°",
    ],
  },
  {
    id: "exit_oversteer",
    label: "Exit Oversteer",
    changes: [
      "Soften rear springs 1 step",
      "Diff power-side −5%",
      "Reduce rear tyre pressure 0.3 psi",
      "Move brake bias forward 1%",
    ],
  },
  {
    id: "brake_instability",
    label: "Brake Instability",
    changes: [
      "Move brake bias forward 1.5%",
      "Front compression +1 click",
      "Reduce rear toe-in 0.05°",
      "Lower front ride height −1 mm",
    ],
  },
  {
    id: "poor_traction",
    label: "Poor Traction",
    changes: [
      "Soften rear springs 0.5 kg/mm",
      "Diff preload −5 Nm",
      "Add rear ride height +1 mm",
      "Rear tyre pressure −0.3 psi",
    ],
  },
  {
    id: "kerb_sensitivity",
    label: "Kerb Sensitivity",
    changes: [
      "Soften compression damping 1 click all round",
      "Raise ride height +2 mm",
      "Reduce ARB stiffness 1 step",
      "Soften bumpstop preload",
    ],
  },
] as const;

export function SetupConsole({
  data, setData, meta, writable, carName,
}: {
  data: Data;
  setData: (next: Data) => void;
  meta: { name: string; track: string; conditions: string; notes: string };
  writable: boolean;
  carName: string;
}) {
  const set = (k: string, v: string) => setData({ ...data, [k]: v });

  const pLF = num(data.psi_lf), pRF = num(data.psi_rf), pLR = num(data.psi_lr), pRR = num(data.psi_rr);
  const cLF = num(data.camber_lf), cRF = num(data.camber_rf), cLR = num(data.camber_lr), cRR = num(data.camber_rr);
  const toeF = num(data.toe_front), toeR = num(data.toe_rear);
  const rhF = num(data.ride_front), rhR = num(data.ride_rear);
  const sprF = num(data.spring_front), sprR = num(data.spring_rear);
  const bias = num(data.brake_bias, 55);
  const rake = rhR - rhF;
  const aeroBal = num(data.aero_balance, 42); // % front

  const selectedComplaints = (data.complaints ?? "").split(",").filter(Boolean);
  const toggleComplaint = (id: string) => {
    const s = new Set(selectedComplaints);
    if (s.has(id)) s.delete(id); else s.add(id);
    set("complaints", Array.from(s).join(","));
  };

  const suggestions = useMemo(() => {
    const out: { area: string; change: string }[] = [];
    for (const c of COMPLAINTS) {
      if (selectedComplaints.includes(c.id)) {
        c.changes.forEach((ch) => out.push({ area: c.label, change: ch }));
      }
    }
    return out;
  }, [selectedComplaints]);

  const tyres = [
    { id: "lf", label: "LF", psi: pLF, camber: cLF, x: 0, y: 0 },
    { id: "rf", label: "RF", psi: pRF, camber: cRF, x: 1, y: 0 },
    { id: "lr", label: "LR", psi: pLR, camber: cLR, x: 0, y: 1 },
    { id: "rr", label: "RR", psi: pRR, camber: cRR, x: 1, y: 1 },
  ];

  return (
    <div className="space-y-3">
      {/* TOP STATUS BAR */}
      <div className="telemetry-panel telemetry-accent-bar p-3">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatusCell label="Car" value={carName} />
          <StatusCell label="Setup" value={meta.name || "—"} />
          <StatusCell label="Track" value={meta.track || "—"} />
          <EditCell label="Air °C" k="air_temp" data={data} set={set} writable={writable} icon={<Thermometer className="w-3 h-3" />} />
          <EditCell label="Track °C" k="track_temp" data={data} set={set} writable={writable} icon={<Thermometer className="w-3 h-3" />} />
          <EditCell label="Compound" k="tire_compound" data={data} set={set} writable={writable} />
          <EditCell label="Fuel L" k="fuel_load_l" data={data} set={set} writable={writable} icon={<Fuel className="w-3 h-3" />} />
          <EditCell label="Session" k="session_type" data={data} set={set} writable={writable} placeholder="FP/Q/R" />
        </div>
      </div>

      {/* TYRE PRESSURE QUICK-EDIT — pit lane priority #1 */}
      <div className="telemetry-panel telemetry-accent-bar p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="telemetry-label flex items-center gap-1"><Gauge className="w-3 h-3 text-primary" /> Tyre Pressures — psi</div>
          <div className="telemetry-label hidden sm:block">tap ± to adjust · auto-saves</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {tyres.map((t) => (
            <Stepper
              key={t.id}
              label={t.label}
              unit="PSI"
              value={data[`psi_${t.id}`]}
              onChange={(v) => set(`psi_${t.id}`, v)}
              step={0.1}
              min={15}
              max={45}
              precision={1}
              disabled={!writable}
              accent={psiAccent(t.psi)}
            />
          ))}
        </div>
      </div>

      {/* CENTERPIECE: Car schematic + side panels */}
      <div className="grid lg:grid-cols-12 gap-3">
        {/* Left rail — front numbers */}
        <div className="lg:col-span-3 space-y-3">
          <div className="telemetry-panel p-3 space-y-2">
            <div className="telemetry-label">Brake Bias %F</div>
            <Stepper value={data.brake_bias} onChange={(v) => set("brake_bias", v)}
              step={0.5} min={45} max={70} precision={1} disabled={!writable} />
          </div>
          <div className="telemetry-panel p-3 space-y-2">
            <div className="telemetry-label">Spring Rates kg/mm</div>
            <Stepper label="FRONT" value={data.spring_front} onChange={(v) => set("spring_front", v)}
              step={0.5} min={20} max={250} precision={1} disabled={!writable} />
            <Stepper label="REAR" value={data.spring_rear} onChange={(v) => set("spring_rear", v)}
              step={0.5} min={20} max={250} precision={1} disabled={!writable} />
          </div>
          <div className="telemetry-panel p-3 space-y-2">
            <div className="telemetry-label flex items-center justify-between">
              <span>Ride Height mm</span>
              <span className={"font-mono " + (rake > 0 ? "text-primary" : "text-muted-foreground")}>
                RAKE {rake > 0 ? "+" : ""}{rake.toFixed(1)}
              </span>
            </div>
            <Stepper label="FRONT" value={data.ride_front} onChange={(v) => set("ride_front", v)}
              step={1} min={20} max={120} precision={0} disabled={!writable} />
            <Stepper label="REAR" value={data.ride_rear} onChange={(v) => set("ride_rear", v)}
              step={1} min={20} max={120} precision={0} disabled={!writable} />
          </div>
        </div>

        {/* CAR TOP-DOWN */}
        <div className="lg:col-span-6">
          <div className="telemetry-panel p-4 h-full">
            <div className="flex items-center justify-between mb-2">
              <div className="telemetry-label flex items-center gap-1"><Activity className="w-3 h-3" /> Car Schematic — Top View</div>
              <div className="telemetry-label">TOE F {toeF.toFixed(2)}° · TOE R {toeR.toFixed(2)}°</div>
            </div>
            <CarSchematic tyres={tyres} />
          </div>
        </div>

        {/* Right rail — tyre temps heatmap */}
        <div className="lg:col-span-3 space-y-3">
          <div className="telemetry-panel p-3">
            <div className="telemetry-label mb-2">Tyre Temperatures °C</div>
            <div className="grid grid-cols-2 gap-2">
              {tyres.map((t) => (
                <TyreTempCell key={t.id} corner={t.label} k={t.id} data={data} set={set} writable={writable} />
              ))}
            </div>
          </div>
          <div className="telemetry-panel p-3">
            <div className="telemetry-label mb-2">Tyre Wear %</div>
            <div className="grid grid-cols-2 gap-2">
              {tyres.map((t) => (
                <WearBar key={t.id} corner={t.label} k={`wear_${t.id}`} data={data} set={set} writable={writable} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AERO / BALANCE */}
      <div className="telemetry-panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wind className="w-4 h-4 text-primary" />
          <div className="telemetry-label">Aero · Balance</div>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="telemetry-label">Aero Balance</span>
              <span className="font-mono text-xs"><span className="text-primary font-bold">{aeroBal.toFixed(0)}%</span> F · {(100 - aeroBal).toFixed(0)}% R</span>
            </div>
            <Slider
              disabled={!writable}
              value={[aeroBal]}
              min={30} max={55} step={0.5}
              onValueChange={(v) => set("aero_balance", String(v[0]))}
            />
            <div className="mt-1 flex justify-between telemetry-label text-[9px]">
              <span>F BIAS</span><span>NEUTRAL</span><span>R BIAS</span>
            </div>
          </div>
          <RakeViz rhF={rhF} rhR={rhR} />
          <StabilityIndicator bias={bias} aeroBal={aeroBal} rake={rake} />
        </div>
      </div>

      {/* DRIVER FEEDBACK */}
      <div className="telemetry-panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-primary" />
          <div className="telemetry-label">Driver Feedback — quick select</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {COMPLAINTS.map((c) => {
            const active = selectedComplaints.includes(c.id);
            return (
              <Button
                key={c.id}
                disabled={!writable}
                onClick={() => toggleComplaint(c.id)}
                variant={active ? "default" : "outline"}
                className={"h-14 font-mono uppercase text-[11px] tracking-wider whitespace-normal text-center leading-tight " + (active ? "shadow-glow" : "")}
              >
                {c.label}
              </Button>
            );
          })}
        </div>

        {suggestions.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="telemetry-label mb-2 flex items-center gap-2">
              <Gauge className="w-3 h-3 text-primary" /> Suggested Setup Changes
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-2 border-l-2 border-primary/60 bg-background/40 px-3 py-2 rounded-sm">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground min-w-[88px]">{s.area}</span>
                  <span className="font-mono text-sm text-foreground">{s.change}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="telemetry-label">{label}</div>
      <div className="font-display font-bold text-sm truncate">{value}</div>
    </div>
  );
}

function EditCell({
  label, k, data, set, writable, placeholder, icon,
}: {
  label: string; k: string; data: Data; set: (k: string, v: string) => void; writable: boolean;
  placeholder?: string; icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="telemetry-label flex items-center gap-1">{icon}{label}</div>
      <Input
        readOnly={!writable}
        value={data[k] ?? ""}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder ?? "—"}
        className="h-7 px-2 mt-0.5 font-mono text-sm bg-background/40 border-border/60 rounded-sm"
      />
    </div>
  );
}

function TelemetryStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={"telemetry-panel p-3 " + (accent ? "telemetry-accent-bar" : "")}>
      <div className="telemetry-label">{label}</div>
      <div className="telemetry-value text-3xl mt-1">{value}</div>
    </div>
  );
}

function CarSchematic({ tyres }: { tyres: { id: string; label: string; psi: number; camber: number; x: number; y: number }[] }) {
  // SVG canvas
  const W = 360, H = 520;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.22 0.01 250)" />
          <stop offset="100%" stopColor="oklch(0.15 0.005 250)" />
        </linearGradient>
      </defs>
      {/* chassis silhouette */}
      <path
        d="M120 40 Q180 20 240 40 L260 120 L275 220 L275 340 L260 440 Q180 480 100 440 L85 340 L85 220 L100 120 Z"
        fill="url(#bodyGrad)"
        stroke="oklch(0.30 0.01 250)"
        strokeWidth="1.2"
      />
      {/* center spine */}
      <line x1="180" y1="60" x2="180" y2="460" stroke="oklch(0.30 0.01 250)" strokeDasharray="4 4" strokeWidth="1" />
      {/* cockpit */}
      <rect x="150" y="200" width="60" height="120" rx="6" fill="oklch(0.18 0.008 250)" stroke="oklch(0.30 0.01 250)" />
      {/* front wing */}
      <rect x="90" y="32" width="180" height="6" fill="var(--primary)" opacity="0.85" />
      {/* rear wing */}
      <rect x="80" y="460" width="200" height="8" fill="var(--primary)" opacity="0.85" />
      <line x1="90" y1="470" x2="270" y2="470" stroke="oklch(0.40 0.01 250)" strokeWidth="1" />

      {tyres.map((t) => {
        const cx = t.x === 0 ? 60 : 300;
        const cy = t.y === 0 ? 130 : 410;
        const labelX = t.x === 0 ? cx - 6 : cx + 6;
        const anchor = t.x === 0 ? "end" : "start";
        const fill = psiColor(t.psi);
        return (
          <g key={t.id}>
            {/* tyre */}
            <rect x={cx - 16} y={cy - 34} width="32" height="68" rx="4"
              fill="oklch(0.13 0.004 250)" stroke={fill} strokeWidth="2" />
            {/* psi bar */}
            <rect x={cx - 12} y={cy - 30} width="24" height="60" rx="2"
              fill={fill} opacity="0.18" />
            <text x={cx} y={cy - 6} textAnchor="middle"
              fill="var(--foreground)" fontFamily="Rajdhani, Exo 2, sans-serif"
              fontWeight="700" fontSize="18">{t.psi ? t.psi.toFixed(1) : "—"}</text>
            <text x={cx} y={cy + 12} textAnchor="middle"
              fill="var(--muted-foreground)" fontFamily="JetBrains Mono, monospace"
              fontSize="8" letterSpacing="1.5">PSI</text>
            {/* corner badge */}
            <text x={cx} y={cy - 42} textAnchor="middle"
              fill="var(--primary)" fontFamily="JetBrains Mono, monospace"
              fontWeight="700" fontSize="10" letterSpacing="2">{t.label}</text>
            {/* camber readout */}
            <text x={labelX} y={cy + 30} textAnchor={anchor}
              fill="var(--muted-foreground)" fontFamily="JetBrains Mono, monospace"
              fontSize="9">CAM {t.camber ? t.camber.toFixed(2) : "0.00"}°</text>
          </g>
        );
      })}
    </svg>
  );
}

function TyreTempCell({
  corner, k, data, set, writable,
}: { corner: string; k: string; data: Data; set: (k: string, v: string) => void; writable: boolean }) {
  const inner = num(data[`temp_${k}_i`]);
  const mid = num(data[`temp_${k}_m`]);
  const outer = num(data[`temp_${k}_o`]);
  const segs = [inner, mid, outer];
  return (
    <div className="border border-border/60 rounded-sm p-2 bg-background/30">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold text-primary tracking-widest">{corner}</span>
        <span className="telemetry-label text-[9px]">I · M · O</span>
      </div>
      <div className="mt-1 flex gap-0.5 h-6">
        {segs.map((t, i) => (
          <div key={i} className="flex-1 rounded-[2px] flex items-center justify-center text-[10px] font-mono font-bold"
            style={{ background: tempColor(t), color: t > 0 ? "oklch(0.1 0 0)" : "var(--muted-foreground)" }}>
            {t ? t.toFixed(0) : "—"}
          </div>
        ))}
      </div>
      {writable && (
        <div className="mt-1 flex gap-0.5">
          {["i", "m", "o"].map((s) => (
            <Input key={s} value={data[`temp_${k}_${s}`] ?? ""}
              onChange={(e) => set(`temp_${k}_${s}`, e.target.value)}
              className="h-5 px-1 text-[10px] font-mono text-center rounded-sm" />
          ))}
        </div>
      )}
    </div>
  );
}

function WearBar({
  corner, k, data, set, writable,
}: { corner: string; k: string; data: Data; set: (k: string, v: string) => void; writable: boolean }) {
  const w = Math.max(0, Math.min(100, num(data[k])));
  const color = w > 80 ? "var(--destructive)" : w > 60 ? "oklch(0.78 0.18 85)" : "oklch(0.70 0.14 145)";
  return (
    <div className="border border-border/60 rounded-sm p-2 bg-background/30">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] font-bold text-primary tracking-widest">{corner}</span>
        <span className="font-mono text-[10px]">{w.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-border/60 rounded-sm overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${w}%`, background: color }} />
      </div>
      {writable && (
        <Input value={data[k] ?? ""} onChange={(e) => set(k, e.target.value)}
          className="h-5 px-1 mt-1 text-[10px] font-mono text-center rounded-sm" placeholder="0–100" />
      )}
    </div>
  );
}

function RakeViz({ rhF, rhR }: { rhF: number; rhR: number }) {
  const rake = rhR - rhF;
  // visualize as a side-view bar tilt
  const angle = Math.max(-4, Math.min(4, rake * 0.6));
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="telemetry-label">Rake</span>
        <span className="font-mono text-xs"><span className="text-primary font-bold">{rake > 0 ? "+" : ""}{rake.toFixed(1)}</span> mm</span>
      </div>
      <div className="relative h-12 border border-border/60 rounded-sm bg-background/40 overflow-hidden">
        <div className="absolute inset-x-3 bottom-2 h-1.5 bg-primary origin-left"
          style={{ transform: `rotate(${-angle}deg)` }} />
        <div className="absolute left-3 bottom-2 w-2 h-2 rounded-full bg-foreground/80" />
        <div className="absolute right-3 bottom-2 w-2 h-2 rounded-full bg-foreground/80" style={{ transform: `translateY(${-angle * 2}px)` }} />
        <div className="absolute top-1 left-2 telemetry-label text-[9px]">FRONT</div>
        <div className="absolute top-1 right-2 telemetry-label text-[9px]">REAR</div>
      </div>
    </div>
  );
}

function StabilityIndicator({ bias, aeroBal, rake }: { bias: number; aeroBal: number; rake: number }) {
  // rough scoring: balanced bias ~ 55-58, aero 40-46, rake +2..+6
  const biasScore = 1 - Math.min(1, Math.abs(bias - 56) / 6);
  const aeroScore = 1 - Math.min(1, Math.abs(aeroBal - 43) / 8);
  const rakeScore = 1 - Math.min(1, Math.abs(rake - 4) / 5);
  const score = Math.round(((biasScore + aeroScore + rakeScore) / 3) * 100);
  const tag = score > 75 ? "STABLE" : score > 50 ? "NEUTRAL" : score > 30 ? "EDGY" : "UNSTABLE";
  const color = score > 75 ? "oklch(0.70 0.14 145)" : score > 50 ? "oklch(0.75 0.16 85)" : "var(--destructive)";
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="telemetry-label">Stability</span>
        <span className="font-mono text-xs font-bold" style={{ color }}>{tag}</span>
      </div>
      <div className="relative h-12 border border-border/60 rounded-sm bg-background/40 overflow-hidden">
        <div className="absolute inset-y-0 left-0" style={{ width: `${score}%`, background: `linear-gradient(90deg, transparent, ${color})`, opacity: 0.4 }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="telemetry-value text-2xl" style={{ color }}>{score}</span>
        </div>
      </div>
    </div>
  );
}