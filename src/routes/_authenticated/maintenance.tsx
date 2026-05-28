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
import { Wrench, Plus, ArrowLeft, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/maintenance")({ component: MaintenancePage });

type Car = { id: string; name: string };
type Item = {
  id: string; car_id: string; component: string; description: string | null;
  unit: string; current_value: number; service_interval: number | null;
  last_service_value: number | null; warn_threshold: number | null; notes: string | null;
};
const UNITS = ["hours", "cycles", "km", "miles", "days"];

function MaintenancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ car_id: "", component: "", description: "", unit: "hours", current_value: "0", service_interval: "", last_service_value: "0", warn_threshold: "0.2", notes: "" });

  const carsQ = useQuery({
    queryKey: ["cars-min", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id, name").order("created_at");
      if (error) throw error;
      return data as Car[];
    }, enabled: !!user,
  });

  const itemsQ = useQuery({
    queryKey: ["maintenance", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("maintenance_items").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Item[];
    }, enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.car_id || !form.component) throw new Error("Car and component required");
      const { error } = await supabase.from("maintenance_items").insert({
        user_id: user!.id, car_id: form.car_id, component: form.component,
        description: form.description || null, unit: form.unit,
        current_value: Number(form.current_value),
        service_interval: form.service_interval ? Number(form.service_interval) : null,
        last_service_value: form.last_service_value ? Number(form.last_service_value) : 0,
        warn_threshold: form.warn_threshold ? Number(form.warn_threshold) : 0.2,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item added");
      setOpen(false);
      setForm({ car_id: "", component: "", description: "", unit: "hours", current_value: "0", service_interval: "", last_service_value: "0", warn_threshold: "0.2", notes: "" });
      qc.invalidateQueries({ queryKey: ["maintenance"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const update = useMutation({
    mutationFn: async (p: { id: string; current_value?: number; last_service_value?: number }) => {
      const { id, ...rest } = p;
      const { error } = await supabase.from("maintenance_items").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maintenance_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });

  const carName = (id: string) => carsQ.data?.find((c) => c.id === id)?.name ?? "—";

  return (
    <div>
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>
      <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1"><Wrench className="w-3 h-3" /> Workshop</div>
          <h1 className="font-display text-4xl font-bold mt-1">Maintenance</h1>
          <p className="text-sm text-muted-foreground mt-1">Engine hours, brake life, fluid changes. Get warned before parts are due.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="shadow-glow"><Plus className="w-4 h-4 mr-1" /> Add item</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New maintenance item</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Car *</Label>
                <Select value={form.car_id} onValueChange={(v) => setForm({ ...form, car_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a car" /></SelectTrigger>
                  <SelectContent>{(carsQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Component *</Label><Input value={form.component} onChange={(e) => setForm({ ...form, component: e.target.value })} placeholder="Engine oil" /></div>
                <div>
                  <Label>Unit</Label>
                  <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Current</Label><Input type="number" step="any" value={form.current_value} onChange={(e) => setForm({ ...form, current_value: e.target.value })} /></div>
                <div><Label>Last service</Label><Input type="number" step="any" value={form.last_service_value} onChange={(e) => setForm({ ...form, last_service_value: e.target.value })} /></div>
                <div><Label>Interval</Label><Input type="number" step="any" value={form.service_interval} onChange={(e) => setForm({ ...form, service_interval: e.target.value })} placeholder="20" /></div>
              </div>
              <div><Label>Warn at (0.2 = 20% remaining)</Label><Input type="number" step="0.05" value={form.warn_threshold} onChange={(e) => setForm({ ...form, warn_threshold: e.target.value })} /></div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Add</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 space-y-3">
        {itemsQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!itemsQ.isLoading && (itemsQ.data ?? []).length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Wrench className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No maintenance items yet.</p>
          </div>
        )}
        {(itemsQ.data ?? []).map((it) => {
          const used = it.current_value - (it.last_service_value ?? 0);
          const interval = it.service_interval ?? 0;
          const remaining = interval > 0 ? interval - used : null;
          const pct = interval > 0 ? Math.max(0, Math.min(1, used / interval)) : 0;
          const warn = interval > 0 && remaining != null && remaining / interval <= (it.warn_threshold ?? 0.2);
          const overdue = interval > 0 && remaining != null && remaining <= 0;
          return (
            <div key={it.id} className={"rounded-lg border p-5 shadow-card " + (overdue ? "border-destructive/60 bg-destructive/5" : warn ? "border-primary/60 bg-card" : "border-border bg-card")}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{carName(it.car_id)}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <h2 className="font-display text-xl font-bold">{it.component}</h2>
                    {overdue && <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-destructive/20 text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Overdue</span>}
                    {!overdue && warn && <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-primary/20 text-primary flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Due soon</span>}
                    {!overdue && !warn && interval > 0 && <CheckCircle2 className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  {it.description && <div className="text-xs text-muted-foreground mt-1">{it.description}</div>}
                </div>
                <button onClick={() => { if (confirm("Delete?")) del.mutate(it.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="mt-3 text-sm font-mono">
                {used.toFixed(1)} {it.unit} used since service · {interval > 0 ? `${remaining?.toFixed(1)} ${it.unit} remaining` : "no interval set"}
              </div>
              {interval > 0 && (
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div className={"h-full " + (overdue ? "bg-destructive" : warn ? "bg-primary" : "bg-accent")} style={{ width: `${pct * 100}%` }} />
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2 items-end">
                <div>
                  <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Update current</Label>
                  <Input type="number" step="any" defaultValue={it.current_value} className="w-32 font-mono"
                    onBlur={(e) => { const v = Number(e.target.value); if (v !== it.current_value) update.mutate({ id: it.id, current_value: v }); }} />
                </div>
                <Button size="sm" variant="outline" onClick={() => update.mutate({ id: it.id, last_service_value: it.current_value })}>
                  Mark serviced now
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}