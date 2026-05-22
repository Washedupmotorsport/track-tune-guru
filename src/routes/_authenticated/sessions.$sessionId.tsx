import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Loader2, Trash2, Plus, Trophy, Fuel, Sparkles, AlertTriangle, Cloud, FileDown, Monitor, Table as TableIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { parseLapTime, formatLapTime } from "@/lib/lap-time";
import { getDebrief, type DebriefResult } from "@/lib/debrief.functions";
import { VoiceRecorder } from "@/components/voice-recorder";
import { PhotoAttachments } from "@/components/photo-attachments";
import { getCurrentWeather } from "@/lib/weather";
import { useUnits } from "@/lib/units";
import { exportSessionPDF } from "@/lib/pdf-export";
import { LapTimer } from "@/components/lap-timer";
import { IncidentLog } from "@/components/incident-log";
import { SessionShareDialog } from "@/components/session-share-dialog";
import { toCSV, downloadCSV } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/sessions/$sessionId")({ component: SessionDetail });

type Session = {
  id: string; name: string; session_type: string; car_id: string; setup_id: string | null;
  track: string | null; driver: string | null; weather: string | null;
  air_temp_c: number | null; track_temp_c: number | null;
  fuel_start_l: number | null; fuel_end_l: number | null;
  notes: string | null; started_at: string;
};
type Lap = {
  id: string; lap_number: number | null; lap_time_ms: number;
  sector_1_ms: number | null; sector_2_ms: number | null; sector_3_ms: number | null;
  conditions: string | null; notes: string | null; recorded_at: string;
};

function SessionDetail() {
  const { sessionId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const debriefFn = useServerFn(getDebrief);
  const [meta, setMeta] = useState<Partial<Session>>({});
  const [lapForm, setLapForm] = useState({ lap_number: "", lap_time: "", s1: "", s2: "", s3: "", notes: "" });
  const [debrief, setDebrief] = useState<DebriefResult | null>(null);

  const sessionQ = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
      if (error) throw error;
      return data as Session;
    },
  });

  useEffect(() => { if (sessionQ.data) setMeta(sessionQ.data); }, [sessionQ.data]);

  const lapsQ = useQuery({
    queryKey: ["session-laps", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase.from("laps").select("*").eq("session_id", sessionId).order("recorded_at");
      if (error) throw error;
      return data as Lap[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sessions").update({
        name: meta.name, track: meta.track, driver: meta.driver, weather: meta.weather,
        air_temp_c: meta.air_temp_c, track_temp_c: meta.track_temp_c,
        fuel_start_l: meta.fuel_start_l, fuel_end_l: meta.fuel_end_l, notes: meta.notes,
      }).eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["session", sessionId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addLap = useMutation({
    mutationFn: async () => {
      if (!sessionQ.data) throw new Error("No session");
      if (!sessionQ.data.setup_id) throw new Error("Attach a setup to this session before logging laps");
      const ms = parseLapTime(lapForm.lap_time);
      if (ms == null) throw new Error("Bad lap time");
      const { error } = await supabase.from("laps").insert({
        user_id: user!.id,
        setup_id: sessionQ.data.setup_id,
        car_id: sessionQ.data.car_id,
        session_id: sessionId,
        lap_number: lapForm.lap_number ? parseInt(lapForm.lap_number, 10) : null,
        lap_time_ms: ms,
        sector_1_ms: lapForm.s1 ? parseLapTime(lapForm.s1) : null,
        sector_2_ms: lapForm.s2 ? parseLapTime(lapForm.s2) : null,
        sector_3_ms: lapForm.s3 ? parseLapTime(lapForm.s3) : null,
        conditions: sessionQ.data.weather,
        notes: lapForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setLapForm({ ...lapForm, lap_time: "", s1: "", s2: "", s3: "", notes: "",
        lap_number: lapForm.lap_number ? String(parseInt(lapForm.lap_number, 10) + 1) : "" });
      qc.invalidateQueries({ queryKey: ["session-laps", sessionId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delLap = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("laps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session-laps", sessionId] }),
  });

  const askDebrief = useMutation({
    mutationFn: async () => debriefFn({ data: { sessionId, carId: sessionQ.data!.car_id } }),
    onSuccess: (r) => setDebrief(r),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Debrief failed"),
  });

  const [weatherLoading, setWeatherLoading] = useState(false);
  const units = useUnits();
  const fetchWeather = async () => {
    setWeatherLoading(true);
    try {
      const w = await getCurrentWeather();
      setMeta((m) => ({
        ...m,
        weather: `${w.weather} (wind ${units.toDisplaySpeed(w.wind_kph)} ${units.speedUnit})`,
        air_temp_c: w.air_temp_c,
      }));
      toast.success("Weather updated — remember to save");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Weather failed");
    } finally { setWeatherLoading(false); }
  };

  if (sessionQ.isLoading || !sessionQ.data) return <div className="text-muted-foreground">Loading…</div>;

  const laps = lapsQ.data ?? [];
  const best = laps.length ? Math.min(...laps.map((l) => l.lap_time_ms)) : null;
  const avg = laps.length ? Math.round(laps.reduce((s, l) => s + l.lap_time_ms, 0) / laps.length) : null;
  const fuelUsed = (meta.fuel_start_l ?? null) != null && (meta.fuel_end_l ?? null) != null
    ? (meta.fuel_start_l! - meta.fuel_end_l!) : null;
  const fuelPerLap = fuelUsed != null && laps.length > 0 ? (fuelUsed / laps.length) : null;

  return (
    <div>
      <Link to="/sessions" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> All sessions
      </Link>

      <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <div className="font-mono text-xs uppercase tracking-widest text-primary">{sessionQ.data.session_type} · {new Date(sessionQ.data.started_at).toLocaleString()}</div>
          <Input value={meta.name ?? ""} onChange={(e) => setMeta({ ...meta, name: e.target.value })}
            className="mt-1 font-display !text-3xl font-bold !h-auto !py-2 !px-3 bg-transparent border-transparent hover:border-border focus-visible:border-primary" />
        </div>
        <div className="flex items-center gap-2">
          <Link to="/sessions/$sessionId/pitboard" params={{ sessionId }}>
            <Button variant="outline" size="sm"><Monitor className="w-4 h-4 mr-1" /> Pit board</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={fetchWeather} disabled={weatherLoading}>
            {weatherLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Cloud className="w-4 h-4 mr-1" />} Weather
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportSessionPDF(sessionQ.data!, laps)} disabled={laps.length === 0}>
            <FileDown className="w-4 h-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" disabled={laps.length === 0} onClick={() => {
            const rows = laps.map((l) => ({
              lap_number: l.lap_number ?? "",
              lap_time_ms: l.lap_time_ms,
              lap_time: formatLapTime(l.lap_time_ms),
              s1_ms: l.sector_1_ms ?? "",
              s2_ms: l.sector_2_ms ?? "",
              s3_ms: l.sector_3_ms ?? "",
              conditions: l.conditions ?? "",
              notes: l.notes ?? "",
              recorded_at: l.recorded_at,
            }));
            downloadCSV(`${sessionQ.data!.name.replace(/\s+/g, "_")}_laps.csv`, toCSV(rows));
          }}>
            <TableIcon className="w-4 h-4 mr-1" /> CSV
          </Button>
          <SessionShareDialog sessionId={sessionId} carId={sessionQ.data.car_id} />
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="shadow-glow">
            {save.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save
          </Button>
        </div>
      </div>

      <div className="mt-6 grid md:grid-cols-3 gap-4 rounded-lg border border-border bg-card p-5">
        <div><Label>Track</Label><Input value={meta.track ?? ""} onChange={(e) => setMeta({ ...meta, track: e.target.value })} /></div>
        <div><Label>Driver</Label><Input value={meta.driver ?? ""} onChange={(e) => setMeta({ ...meta, driver: e.target.value })} /></div>
        <div><Label>Weather</Label><Input value={meta.weather ?? ""} onChange={(e) => setMeta({ ...meta, weather: e.target.value })} /></div>
        <div>
          <Label>Air {units.tempUnit}</Label>
          <Input type="number" step="any"
            value={units.toDisplayTemp(meta.air_temp_c) ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              const c = v === "" ? null : units.fromDisplayTemp(Number(v));
              setMeta({ ...meta, air_temp_c: c == null ? null : Math.round(c * 10) / 10 });
            }} />
        </div>
        <div>
          <Label>Track {units.tempUnit}</Label>
          <Input type="number" step="any"
            value={units.toDisplayTemp(meta.track_temp_c) ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              const c = v === "" ? null : units.fromDisplayTemp(Number(v));
              setMeta({ ...meta, track_temp_c: c == null ? null : Math.round(c * 10) / 10 });
            }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Fuel start L</Label><Input type="number" step="any" value={meta.fuel_start_l ?? ""} onChange={(e) => setMeta({ ...meta, fuel_start_l: e.target.value ? Number(e.target.value) : null })} /></div>
          <div><Label>Fuel end L</Label><Input type="number" step="any" value={meta.fuel_end_l ?? ""} onChange={(e) => setMeta({ ...meta, fuel_end_l: e.target.value ? Number(e.target.value) : null })} /></div>
        </div>
      </div>

      <div className="mt-4 grid md:grid-cols-4 gap-3">
        <Stat label="Laps" value={String(laps.length)} />
        <Stat label="Best" value={formatLapTime(best)} icon={<Trophy className="w-4 h-4 text-primary" />} />
        <Stat label="Avg" value={formatLapTime(avg)} />
        <Stat label="Fuel / lap" value={fuelPerLap != null ? `${fuelPerLap.toFixed(2)} L` : "—"} icon={<Fuel className="w-4 h-4 text-primary" />} />
      </div>

      <div className="mt-6">
        <LapTimer onSaveLap={async (ms, n) => {
          if (!sessionQ.data?.setup_id) { toast.error("Attach a setup to log laps"); return; }
          const { error } = await supabase.from("laps").insert({
            user_id: user!.id,
            setup_id: sessionQ.data.setup_id,
            car_id: sessionQ.data.car_id,
            session_id: sessionId,
            lap_number: n,
            lap_time_ms: ms,
            conditions: sessionQ.data.weather,
          });
          if (error) { toast.error(error.message); return; }
          qc.invalidateQueries({ queryKey: ["session-laps", sessionId] });
        }} />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold uppercase tracking-wider mb-3">Add lap</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div><Label>#</Label><Input value={lapForm.lap_number} onChange={(e) => setLapForm({ ...lapForm, lap_number: e.target.value })} className="font-mono" /></div>
          <div><Label>Lap *</Label><Input value={lapForm.lap_time} onChange={(e) => setLapForm({ ...lapForm, lap_time: e.target.value })} className="font-mono" placeholder="1:23.456" /></div>
          <div><Label>S1</Label><Input value={lapForm.s1} onChange={(e) => setLapForm({ ...lapForm, s1: e.target.value })} className="font-mono" /></div>
          <div><Label>S2</Label><Input value={lapForm.s2} onChange={(e) => setLapForm({ ...lapForm, s2: e.target.value })} className="font-mono" /></div>
          <div><Label>S3</Label><Input value={lapForm.s3} onChange={(e) => setLapForm({ ...lapForm, s3: e.target.value })} className="font-mono" /></div>
          <div><Label>Notes</Label><Input value={lapForm.notes} onChange={(e) => setLapForm({ ...lapForm, notes: e.target.value })} /></div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={() => addLap.mutate()} disabled={addLap.isPending || !lapForm.lap_time}>
            <Plus className="w-4 h-4 mr-1" /> Log lap
          </Button>
        </div>
      </div>

      {laps.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card p-5">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
              <th className="py-2 pr-3">#</th><th className="py-2 pr-3">Lap</th><th className="py-2 pr-3">S1</th><th className="py-2 pr-3">S2</th><th className="py-2 pr-3">S3</th><th className="py-2 pr-3">Notes</th><th></th>
            </tr></thead>
            <tbody>
              {laps.map((l) => (
                <tr key={l.id} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-mono">{l.lap_number ?? "—"}</td>
                  <td className={"py-2 pr-3 font-mono " + (l.lap_time_ms === best ? "text-primary font-bold" : "")}>{formatLapTime(l.lap_time_ms)}</td>
                  <td className="py-2 pr-3 font-mono text-muted-foreground">{formatLapTime(l.sector_1_ms)}</td>
                  <td className="py-2 pr-3 font-mono text-muted-foreground">{formatLapTime(l.sector_2_ms)}</td>
                  <td className="py-2 pr-3 font-mono text-muted-foreground">{formatLapTime(l.sector_3_ms)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{l.notes ?? "—"}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => { if (confirm("Delete?")) delLap.mutate(l.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-1">
          <Label>Session notes</Label>
          <VoiceRecorder onTranscript={(t) => setMeta((m) => ({ ...m, notes: ((m.notes ?? "") + (m.notes ? "\n" : "") + t).trim() }))} />
        </div>
        <Textarea rows={3} value={meta.notes ?? ""} onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
          placeholder="Driver feedback, observations, plan for next session…" />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-5">
        <PhotoAttachments carId={sessionQ.data.car_id} scope="session_id" scopeId={sessionId} />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-5">
        <IncidentLog sessionId={sessionId} carId={sessionQ.data.car_id} />
      </div>

      <div className="mt-6 rounded-lg border border-primary/40 bg-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-display text-lg font-bold uppercase tracking-wider">AI Debrief</h2>
          </div>
          <Button size="sm" onClick={() => askDebrief.mutate()} disabled={askDebrief.isPending || laps.length === 0}>
            {askDebrief.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />} Analyze session
          </Button>
        </div>
        {laps.length === 0 && <p className="text-sm text-muted-foreground">Log some laps first.</p>}
        {debrief && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-background/50 p-3 text-sm">{debrief.summary}</div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-md border border-border bg-background/50 p-3">
                <div className="text-xs font-mono uppercase tracking-widest text-primary mb-1">Strengths</div>
                <ul className="text-sm list-disc pl-4 space-y-1">{debrief.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
              <div className="rounded-md border border-border bg-background/50 p-3">
                <div className="text-xs font-mono uppercase tracking-widest text-destructive mb-1">Weaknesses</div>
                <ul className="text-sm list-disc pl-4 space-y-1">{debrief.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            </div>
            <div className="space-y-2">
              {debrief.actions.map((a, i) => (
                <div key={i} className="rounded-md border border-border bg-background/50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-display font-bold text-sm uppercase tracking-wider">{a.area}</div>
                    <span className={"text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded " +
                      (a.priority === "high" ? "bg-destructive/20 text-destructive" : a.priority === "medium" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>{a.priority}</span>
                  </div>
                  <div className="text-sm mt-1">{a.advice}</div>
                </div>
              ))}
              {debrief.actions.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="w-4 h-4" /> No specific actions.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
      {icon}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-display text-2xl font-bold">{value}</div>
      </div>
    </div>
  );
}