import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Disc, Plus, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tires")({ component: TiresPage });

type Car = { id: string; name: string };
type TireLog = {
  id: string; car_id: string; tire_set: string; compound: string | null; heat_cycles: number | null;
  cold_fl: number | null; cold_fr: number | null; cold_rl: number | null; cold_rr: number | null;
  hot_fl: number | null; hot_fr: number | null; hot_rl: number | null; hot_rr: number | null;
  tread_fl: number | null; tread_fr: number | null; tread_rl: number | null; tread_rr: number | null;
  ambient_c: number | null; track_c: number | null; notes: string | null; recorded_at: string;
};

const empty4 = { fl: "", fr: "", rl: "", rr: "" };

function TiresPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [carId, setCarId] = useState("");
  const [form, setForm] = useState({
    tire_set: "", compound: "", heat_cycles: "",
    cold: { ...empty4 }, hot: { ...empty4 }, tread: { ...empty4 },
    ambient_c: "", track_c: "", notes: "",
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

  const logsQ = useQuery({
    queryKey: ["tire_logs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tire_logs").select("*").order("recorded_at", { ascending: false });
      if (error) throw error;
      return data as TireLog[];
    },
    enabled: !!user,
  });

  const num = (s: string) => s ? Number(s) : null;

  const create = useMutation({
    mutationFn: async () => {
      if (!carId) throw new Error("Pick a car");
      if (!form.tire_set) throw new Error("Tire set required");
      const { error } = await supabase.from("tire_logs").insert({
        user_id: user!.id, car_id: carId, tire_set: form.tire_set,
        compound: form.compound || null, heat_cycles: form.heat_cycles ? parseInt(form.heat_cycles, 10) : 0,
        cold_fl: num(form.cold.fl), cold_fr: num(form.cold.fr), cold_rl: num(form.cold.rl), cold_rr: num(form.cold.rr),
        hot_fl: num(form.hot.fl), hot_fr: num(form.hot.fr), hot_rl: num(form.hot.rl), hot_rr: num(form.hot.rr),
        tread_fl: num(form.tread.fl), tread_fr: num(form.tread.fr), tread_rl: num(form.tread.rl), tread_rr: num(form.tread.rr),
        ambient_c: num(form.ambient_c), track_c: num(form.track_c), notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tire log saved");
      setOpen(false);
      setForm({ tire_set: "", compound: "", heat_cycles: "", cold: { ...empty4 }, hot: { ...empty4 }, tread: { ...empty4 }, ambient_c: "", track_c: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["tire_logs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tire_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tire_logs"] }),
  });

  const carName = (id: string) => carsQ.data?.find((c) => c.id === id)?.name ?? "—";

  return (
    <div>
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>
      <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
            <Disc className="w-3 h-3" /> Rubber
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Tire logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Cold/hot pressures, compound, heat cycles. Track set life and pressure delta.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="shadow-glow"><Plus className="w-4 h-4 mr-1" /> New log</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New tire log</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Car *</Label>
                  <Select value={carId} onValueChange={setCarId}>
                    <SelectTrigger><SelectValue placeholder="Pick a car" /></SelectTrigger>
                    <SelectContent>{(carsQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Tire set *</Label><Input value={form.tire_set} onChange={(e) => setForm({ ...form, tire_set: e.target.value })} placeholder="Set A" /></div>
                <div><Label>Compound</Label><Input value={form.compound} onChange={(e) => setForm({ ...form, compound: e.target.value })} placeholder="Medium" /></div>
                <div><Label>Heat cycles</Label><Input type="number" value={form.heat_cycles} onChange={(e) => setForm({ ...form, heat_cycles: e.target.value })} /></div>
              </div>
              <PressureGrid label="Cold pressures" value={form.cold} onChange={(v) => setForm({ ...form, cold: v })} />
              <PressureGrid label="Hot pressures" value={form.hot} onChange={(v) => setForm({ ...form, hot: v })} />
              <PressureGrid label="Tread (mm)" value={form.tread} onChange={(v) => setForm({ ...form, tread: v })} />
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Ambient °C</Label><Input type="number" step="any" value={form.ambient_c} onChange={(e) => setForm({ ...form, ambient_c: e.target.value })} /></div>
                <div><Label>Track °C</Label><Input type="number" step="any" value={form.track_c} onChange={(e) => setForm({ ...form, track_c: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Save log</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 space-y-3">
        {logsQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!logsQ.isLoading && (logsQ.data ?? []).length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <Disc className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No tire logs yet.</p>
          </div>
        )}
        {(logsQ.data ?? []).map((l) => (
          <div key={l.id} className="rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{carName(l.car_id)} · {new Date(l.recorded_at).toLocaleDateString()}</div>
                <div className="font-display text-xl font-bold mt-1">{l.tire_set} {l.compound && <span className="text-muted-foreground text-base font-normal">· {l.compound}</span>}</div>
                <div className="text-xs text-muted-foreground">Heat cycles: {l.heat_cycles ?? 0}{l.ambient_c != null && ` · Ambient ${l.ambient_c}°C`}{l.track_c != null && ` · Track ${l.track_c}°C`}</div>
              </div>
              <button onClick={() => { if (confirm("Delete?")) del.mutate(l.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="mt-3 grid sm:grid-cols-3 gap-3 text-xs">
              <ReadGrid label="Cold" v={[l.cold_fl, l.cold_fr, l.cold_rl, l.cold_rr]} />
              <ReadGrid label="Hot" v={[l.hot_fl, l.hot_fr, l.hot_rl, l.hot_rr]} />
              <ReadGrid label="Tread" v={[l.tread_fl, l.tread_fr, l.tread_rl, l.tread_rr]} />
            </div>
            {l.notes && <div className="mt-3 text-sm text-muted-foreground">{l.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PressureGrid({ label, value, onChange }: { label: string; value: { fl: string; fr: string; rl: string; rr: string }; onChange: (v: { fl: string; fr: string; rl: string; rr: string }) => void }) {
  return (
    <div>
      <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-4 gap-2 mt-1">
        {(["fl","fr","rl","rr"] as const).map((k) => (
          <Input key={k} className="font-mono" placeholder={k.toUpperCase()} type="number" step="any"
            value={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />
        ))}
      </div>
    </div>
  );
}

function ReadGrid({ label, v }: { label: string; v: (number | null)[] }) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">{label}</div>
      <div className="grid grid-cols-2 gap-1 font-mono">
        <div>FL: {v[0] ?? "—"}</div><div>FR: {v[1] ?? "—"}</div>
        <div>RL: {v[2] ?? "—"}</div><div>RR: {v[3] ?? "—"}</div>
      </div>
    </div>
  );
}