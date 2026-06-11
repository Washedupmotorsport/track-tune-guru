import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Timer, Plus, ArrowLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatLapTime } from "@/lib/lap-time";
import { GuidedTour } from "@/components/guided-tour";

export const Route = createFileRoute("/_authenticated/sessions")({ component: SessionsPage });

type Car = { id: string; name: string };
type Setup = { id: string; name: string; car_id: string };
type Session = {
  id: string; name: string; session_type: string; car_id: string; setup_id: string | null;
  track: string | null; driver: string | null; weather: string | null;
  air_temp_c: number | null; track_temp_c: number | null;
  fuel_start_l: number | null; fuel_end_l: number | null;
  started_at: string; notes: string | null;
};

const TYPES = ["practice", "qualifying", "race", "testing"];

function SessionsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", session_type: "practice", car_id: "", setup_id: "none",
    track: "", driver: "", weather: "", air_temp_c: "", track_temp_c: "",
    fuel_start_l: "", notes: "",
  });

  const carsQ = useQuery({
    queryKey: ["cars-min", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id, name").order("created_at");
      if (error) throw error;
      return data as Car[];
    },
    enabled: !!user,
  });

  const setupsQ = useQuery({
    queryKey: ["setups-min", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("setups").select("id, name, car_id");
      if (error) throw error;
      return data as Setup[];
    },
    enabled: !!user,
  });

  const sessionsQ = useQuery({
    queryKey: ["sessions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions").select("*").order("started_at", { ascending: false });
      if (error) throw error;
      return data as Session[];
    },
    enabled: !!user,
  });

  const lapsQ = useQuery({
    queryKey: ["sessions-laps-agg", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("laps").select("session_id, lap_time_ms");
      if (error) throw error;
      const m = new Map<string, { count: number; best: number }>();
      (data ?? []).forEach((l) => {
        if (!l.session_id) return;
        const cur = m.get(l.session_id);
        if (!cur) m.set(l.session_id, { count: 1, best: l.lap_time_ms });
        else { cur.count++; if (l.lap_time_ms < cur.best) cur.best = l.lap_time_ms; }
      });
      return m;
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.car_id) throw new Error("Pick a car");
      const { error } = await supabase.from("sessions").insert({
        user_id: user!.id,
        car_id: form.car_id,
        setup_id: form.setup_id === "none" ? null : form.setup_id,
        name: form.name || `${form.session_type} session`,
        session_type: form.session_type,
        track: form.track || null,
        driver: form.driver || null,
        weather: form.weather || null,
        air_temp_c: form.air_temp_c ? Number(form.air_temp_c) : null,
        track_temp_c: form.track_temp_c ? Number(form.track_temp_c) : null,
        fuel_start_l: form.fuel_start_l ? Number(form.fuel_start_l) : null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Session created");
      setOpen(false);
      setForm({ ...form, name: "", track: "", driver: "", weather: "", air_temp_c: "", track_temp_c: "", fuel_start_l: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const filteredSetups = form.car_id ? (setupsQ.data ?? []).filter((s) => s.car_id === form.car_id) : [];

  return (
    <div>
      <GuidedTour tourKey="sessions" />
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>
      <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
            <Timer className="w-3 h-3" /> Trackside
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">Group laps, weather, fuel and driver feedback by track session.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-glow"><Plus className="w-4 h-4 mr-1" /> New session</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New session</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Car *</Label>
                  <Select value={form.car_id} onValueChange={(v) => setForm({ ...form, car_id: v, setup_id: "none" })}>
                    <SelectTrigger><SelectValue placeholder="Pick a car" /></SelectTrigger>
                    <SelectContent>{(carsQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.session_type} onValueChange={(v) => setForm({ ...form, session_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="FP2" /></div>
                <div>
                  <Label>Setup</Label>
                  <Select value={form.setup_id} onValueChange={(v) => setForm({ ...form, setup_id: v })} disabled={filteredSetups.length === 0}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— none —</SelectItem>
                      {filteredSetups.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Track</Label><Input value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })} /></div>
                <div><Label>Driver</Label><Input value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><Label>Weather</Label><Input value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })} placeholder="Dry" /></div>
                <div><Label>Air °C</Label><Input type="number" step="any" value={form.air_temp_c} onChange={(e) => setForm({ ...form, air_temp_c: e.target.value })} /></div>
                <div><Label>Track °C</Label><Input type="number" step="any" value={form.track_temp_c} onChange={(e) => setForm({ ...form, track_temp_c: e.target.value })} /></div>
                <div><Label>Fuel start L</Label><Input type="number" step="any" value={form.fuel_start_l} onChange={(e) => setForm({ ...form, fuel_start_l: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={create.isPending || !form.car_id}>Create session</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 space-y-2">
        {sessionsQ.isLoading && <div className="text-sm text-muted-foreground">Loading...</div>}
        {!sessionsQ.isLoading && (sessionsQ.data ?? []).length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Timer className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No sessions yet. Create one when you head out.</p>
          </div>
        )}
        {(sessionsQ.data ?? []).map((s) => {
          const agg = lapsQ.data?.get(s.id);
          return (
            <Link key={s.id} to="/sessions/$sessionId" params={{ sessionId: s.id }}
              className="flex items-center h-16 px-3 rounded-md border-[1.5px] border-border bg-card hover:border-primary active:scale-[0.997] transition-colors gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-sm bg-primary/20 text-primary shrink-0">{s.session_type.slice(0, 4)}</span>
              <div className="min-w-0 flex-1">
                <div className="font-display font-bold uppercase tracking-tight truncate text-sm">{s.name}</div>
                <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground truncate">
                  {s.driver && <span>{s.driver}</span>}
                  {s.driver && s.track && <span> · </span>}
                  {s.track && <span>{s.track}</span>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="telemetry-value text-sm sm:text-base tabular-nums">{formatLapTime(agg?.best ?? null)}</div>
                <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                  {agg?.count ?? 0} laps
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
