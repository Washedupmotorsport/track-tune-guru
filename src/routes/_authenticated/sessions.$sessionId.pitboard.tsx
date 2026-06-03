import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trophy, Fuel, Timer as TimerIcon } from "lucide-react";
import { formatLapTime } from "@/lib/lap-time";

export const Route = createFileRoute("/_authenticated/sessions/$sessionId/pitboard")({ component: PitBoard });

type Session = {
  id: string; name: string; car_id: string; track: string | null;
  fuel_start_l: number | null; fuel_end_l: number | null; weather: string | null;
  air_temp_c: number | null; track_temp_c: number | null;
};
type Lap = { id: string; lap_time_ms: number; recorded_at: string; lap_number: number | null };

function PitBoard() {
  const { sessionId } = Route.useParams();
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 5000); return () => clearInterval(id); }, []);

  const sessionQ = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
      if (error) throw error;
      return data as Session;
    },
  });
  const lapsQ = useQuery({
    queryKey: ["session-laps-board", sessionId, tick],
    queryFn: async () => {
      const { data, error } = await supabase.from("laps").select("id,lap_time_ms,recorded_at,lap_number").eq("session_id", sessionId).order("recorded_at");
      if (error) throw error;
      return data as Lap[];
    },
  });

  if (!sessionQ.data) return <div className="text-muted-foreground">Loading…</div>;
  const laps = lapsQ.data ?? [];
  const last = laps[laps.length - 1] ?? null;
  const best = laps.length ? Math.min(...laps.map((l) => l.lap_time_ms)) : null;
  const avgLast5 = laps.length >= 1
    ? Math.round(laps.slice(-5).reduce((s, l) => s + l.lap_time_ms, 0) / Math.min(5, laps.length))
    : null;
  const delta = last && best ? last.lap_time_ms - best : null;

  const s = sessionQ.data;
  const fuelRemaining = s.fuel_start_l != null && laps.length > 0 && s.fuel_end_l == null
    ? null // unknown until ended
    : null;
  const fuelUsed = s.fuel_start_l != null && s.fuel_end_l != null ? s.fuel_start_l - s.fuel_end_l : null;
  const burnPerLap = fuelUsed != null && laps.length > 0 ? fuelUsed / laps.length : null;
  void fuelRemaining;

  return (
    <div className="fixed inset-0 bg-background text-foreground overflow-auto">
      <div className="px-4 py-4 flex items-center justify-between border-b border-border">
        <Link to="/sessions/$sessionId" params={{ sessionId }} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Link>
        <div className="font-display text-xl font-bold uppercase tracking-wider truncate">{s.name}</div>
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{s.track ?? ""}</div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 p-4">
        <Tile label="LAST LAP" value={last ? formatLapTime(last.lap_time_ms) : "—"} accent />
        <Tile label="BEST LAP" value={best ? formatLapTime(best) : "—"} icon={<Trophy className="w-8 h-8 text-primary" />} />
        <Tile label="DELTA TO BEST" value={delta == null ? "—" : (delta === 0 ? "0.000" : `${delta > 0 ? "+" : ""}${(delta / 1000).toFixed(3)}`)}
          color={delta == null ? undefined : (delta <= 0 ? "text-primary" : "text-destructive")} />
        <Tile label="AVG LAST 5" value={avgLast5 ? formatLapTime(avgLast5) : "—"} icon={<TimerIcon className="w-8 h-8 text-primary" />} />
        <Tile label="LAPS DONE" value={String(laps.length)} />
        <Tile label="BURN / LAP" value={burnPerLap != null ? `${burnPerLap.toFixed(2)} L` : "—"} icon={<Fuel className="w-8 h-8 text-primary" />} />
      </div>

      <div className="px-4 pb-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Recent laps</div>
          <div className="flex flex-wrap gap-2">
            {laps.slice(-12).reverse().map((l) => (
              <span key={l.id} className={"px-3 py-2 rounded font-mono text-lg " + (l.lap_time_ms === best ? "bg-primary text-primary-foreground shadow-glow" : "bg-background border border-border")}>
                {formatLapTime(l.lap_time_ms)}
              </span>
            ))}
            {laps.length === 0 && <span className="text-sm text-muted-foreground">No laps yet.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, icon, accent, color }: { label: string; value: string; icon?: React.ReactNode; accent?: boolean; color?: string }) {
  return (
    <div className={"rounded-lg border p-4 flex items-center gap-4 " + (accent ? "border-primary/60 bg-card shadow-glow" : "border-border bg-card")}>
      {icon}
      <div className="min-w-0 flex-1">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className={"font-display font-bold tabular-nums text-5xl md:text-6xl " + (color ?? "")}>{value}</div>
      </div>
    </div>
  );
}