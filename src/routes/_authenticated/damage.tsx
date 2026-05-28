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
import { AlertTriangle, Plus, ArrowLeft, Trash2, CheckCircle2, Wrench, Flame } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/damage")({ component: DamagePage });

type Car = { id: string; name: string };
type Damage = {
  id: string; car_id: string; component: string; description: string | null;
  severity: string; status: string; occurred_at: string; resolved_at: string | null;
  repair_cost: number | null; parts_used: string | null; notes: string | null;
};

const SEVERITIES = ["minor", "moderate", "major", "critical"] as const;
const STATUSES = ["open", "in_progress", "resolved"] as const;

const SEV_STYLES: Record<string, string> = {
  minor: "bg-muted text-muted-foreground border-border",
  moderate: "bg-accent/10 text-accent border-accent/40",
  major: "bg-primary/15 text-primary border-primary/50",
  critical: "bg-destructive/20 text-destructive border-destructive/60",
};

function DamagePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("open");
  const [form, setForm] = useState({
    car_id: "", component: "", description: "", severity: "minor",
    status: "open", repair_cost: "", parts_used: "", notes: "",
  });

  const carsQ = useQuery({
    queryKey: ["cars-min", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id, name").order("created_at");
      if (error) throw error;
      return data as Car[];
    }, enabled: !!user,
  });

  const damageQ = useQuery({
    queryKey: ["damage", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("damage_reports").select("*").order("occurred_at", { ascending: false });
      if (error) throw error;
      return data as Damage[];
    }, enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.car_id || !form.component) throw new Error("Car and component required");
      const { error } = await supabase.from("damage_reports").insert({
        user_id: user!.id, car_id: form.car_id, component: form.component,
        description: form.description || null, severity: form.severity, status: form.status,
        repair_cost: form.repair_cost ? Number(form.repair_cost) : null,
        parts_used: form.parts_used || null, notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Damage logged");
      setOpen(false);
      setForm({ car_id: "", component: "", description: "", severity: "minor", status: "open", repair_cost: "", parts_used: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["damage"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const update = useMutation({
    mutationFn: async (p: { id: string; patch: Partial<Damage> }) => {
      const { error } = await supabase.from("damage_reports").update(p.patch).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["damage"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("damage_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["damage"] }),
  });

  const carName = (id: string) => carsQ.data?.find((c) => c.id === id)?.name ?? "—";
  const rows = (damageQ.data ?? []).filter((d) => filter === "all" ? true : d.status === filter);

  const openCount = (damageQ.data ?? []).filter((d) => d.status !== "resolved").length;
  const criticalCount = (damageQ.data ?? []).filter((d) => d.severity === "critical" && d.status !== "resolved").length;
  const repairCost = (damageQ.data ?? []).reduce((s, d) => s + (d.repair_cost ?? 0), 0);

  return (
    <div>
      <Link to="/workshop" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Workshop
      </Link>
      <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Damage log</div>
          <h1 className="font-display text-3xl font-bold mt-1">Damage &amp; Issues</h1>
          <p className="text-sm text-muted-foreground mt-1">Crash damage, mechanical issues, parts replaced.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="h-11"><Plus className="w-4 h-4 mr-1" /> Log damage</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New damage report</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Car *</Label>
                <Select value={form.car_id} onValueChange={(v) => setForm({ ...form, car_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a car" /></SelectTrigger>
                  <SelectContent>{(carsQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Component *</Label><Input value={form.component} onChange={(e) => setForm({ ...form, component: e.target.value })} placeholder="Front splitter" /></div>
                <div>
                  <Label>Severity</Label>
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="T3 contact with kerb, splitter cracked LH side" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Repair cost</Label><Input type="number" step="any" value={form.repair_cost} onChange={(e) => setForm({ ...form, repair_cost: e.target.value })} /></div>
                <div><Label>Parts used</Label><Input value={form.parts_used} onChange={(e) => setForm({ ...form, parts_used: e.target.value })} placeholder="Splitter LH, 2x M8 bolts" /></div>
              </div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending} className="h-11">Log damage</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatTile label="Open" value={openCount.toString()} icon={<Wrench className="w-3 h-3" />} />
        <StatTile label="Critical" value={criticalCount.toString()} icon={<Flame className="w-3 h-3" />} highlight={criticalCount > 0} />
        <StatTile label="Repair cost" value={repairCost > 0 ? repairCost.toFixed(0) : "—"} />
      </div>

      <div className="mt-4 flex gap-1 border-b border-border">
        {(["open", "in_progress", "resolved", "all"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={"px-3 h-9 text-xs font-mono uppercase tracking-widest border-b-2 -mb-px " + (filter === s ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
            <th className="py-2 px-3">Component</th><th className="py-2 px-3">Car</th><th className="py-2 px-3">Severity</th><th className="py-2 px-3">Status</th><th className="py-2 px-3">When</th><th className="py-2 px-3">Cost</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b border-border/50 align-top">
                <td className="py-2 px-3">
                  <div className="font-display font-bold">{d.component}</div>
                  {d.description && <div className="text-xs text-muted-foreground mt-0.5 max-w-md">{d.description}</div>}
                  {d.parts_used && <div className="text-[10px] font-mono text-muted-foreground mt-1">parts: {d.parts_used}</div>}
                </td>
                <td className="py-2 px-3 text-muted-foreground text-xs">{carName(d.car_id)}</td>
                <td className="py-2 px-3">
                  <span className={"inline-block text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border " + SEV_STYLES[d.severity]}>{d.severity}</span>
                </td>
                <td className="py-2 px-3">
                  <Select value={d.status} onValueChange={(v) => update.mutate({ id: d.id, patch: { status: v, resolved_at: v === "resolved" ? new Date().toISOString() : null } })}>
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="text-xs">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{new Date(d.occurred_at).toLocaleDateString()}</td>
                <td className="py-2 px-3 font-mono">{d.repair_cost != null ? d.repair_cost.toFixed(0) : "—"}</td>
                <td className="py-2 px-3 text-right">
                  {d.status === "resolved" ? <CheckCircle2 className="w-4 h-4 text-muted-foreground inline" /> : null}
                  <button onClick={() => { if (confirm("Delete?")) del.mutate(d.id); }} className="ml-2 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4 inline" /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !damageQ.isLoading && (
              <tr><td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No reports.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatTile({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={"rounded-md border p-3 " + (highlight ? "border-destructive/60 bg-destructive/5" : "border-border bg-card")}>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className={"font-mono text-2xl font-bold tabular-nums mt-0.5 " + (highlight ? "text-destructive" : "")}>{value}</div>
    </div>
  );
}