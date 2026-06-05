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
import { Package, Plus, ArrowLeft, Trash2, TriangleAlert as AlertTriangle, Minus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inventory")({ component: InventoryPage });

type Car = { id: string; name: string };
type Part = {
  id: string; car_id: string | null; name: string; part_number: string | null;
  category: string | null; quantity: number; min_quantity: number;
  location: string | null; unit_cost: number | null; supplier: string | null; notes: string | null;
};

function InventoryPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ car_id: "none", name: "", part_number: "", category: "", quantity: "0", min_quantity: "0", location: "", unit_cost: "", supplier: "", notes: "" });

  const carsQ = useQuery({
    queryKey: ["cars-min", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id, name").order("created_at");
      if (error) throw error;
      return data as Car[];
    }, enabled: !!user,
  });

  const partsQ = useQuery({
    queryKey: ["parts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("parts_inventory").select("*").order("name");
      if (error) throw error;
      return data as Part[];
    }, enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("Name required");
      const { error } = await supabase.from("parts_inventory").insert({
        user_id: user!.id, car_id: form.car_id === "none" ? null : form.car_id,
        name: form.name, part_number: form.part_number || null, category: form.category || null,
        quantity: parseInt(form.quantity, 10) || 0, min_quantity: parseInt(form.min_quantity, 10) || 0,
        location: form.location || null, unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
        supplier: form.supplier || null, notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Part added");
      setOpen(false);
      setForm({ car_id: "none", name: "", part_number: "", category: "", quantity: "0", min_quantity: "0", location: "", unit_cost: "", supplier: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["parts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const adjustQty = useMutation({
    mutationFn: async (p: { id: string; delta: number }) => {
      const cur = partsQ.data?.find((x) => x.id === p.id);
      if (!cur) return;
      const { error } = await supabase.from("parts_inventory").update({ quantity: Math.max(0, cur.quantity + p.delta) }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parts"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parts_inventory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parts"] }),
  });

  const lowStock = (partsQ.data ?? []).filter((p) => p.quantity <= p.min_quantity);

  return (
    <div>
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>
      <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1"><Package className="w-3 h-3" /> Spares</div>
          <h1 className="font-display text-4xl font-bold mt-1">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">Track parts in the trailer with min-stock alerts.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="shadow-glow"><Plus className="w-4 h-4 mr-1" /> Add part</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New part</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Front brake pads" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Part number</Label><Input value={form.part_number} onChange={(e) => setForm({ ...form, part_number: e.target.value })} /></div>
                <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="brakes" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Qty</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
                <div><Label>Min qty</Label><Input type="number" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: e.target.value })} /></div>
                <div><Label>Unit cost</Label><Input type="number" step="any" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Trailer bay 3" /></div>
                <div><Label>Supplier</Label><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
              </div>
              <div>
                <Label>Car (optional)</Label>
                <Select value={form.car_id} onValueChange={(v) => setForm({ ...form, car_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— general stock —</SelectItem>
                    {(carsQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Add part</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {lowStock.length > 0 && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="text-sm">{lowStock.length} part{lowStock.length === 1 ? "" : "s"} at or below min stock</span>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
            <th className="py-3 px-4">Name</th><th className="py-3 px-4">Category</th><th className="py-3 px-4">Location</th><th className="py-3 px-4">Qty</th><th className="py-3 px-4">Min</th><th></th>
          </tr></thead>
          <tbody>
            {(partsQ.data ?? []).map((p) => {
              const low = p.quantity <= p.min_quantity;
              return (
                <tr key={p.id} className={"border-b border-border/50 " + (low ? "bg-destructive/5" : "")}>
                  <td className="py-3 px-4">
                    <div className="font-display font-bold">{p.name}</div>
                    {p.part_number && <div className="font-mono text-[10px] text-muted-foreground">{p.part_number}</div>}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{p.category ?? "—"}</td>
                  <td className="py-3 px-4 text-muted-foreground">{p.location ?? "—"}</td>
                  <td className="py-3 px-4 font-mono">
                    <div className="flex items-center gap-1">
                      <button onClick={() => adjustQty.mutate({ id: p.id, delta: -1 })} className="min-h-11 min-w-11 rounded border border-border hover:bg-muted flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                      <span className={"w-8 text-center font-bold " + (low ? "text-destructive" : "")}>{p.quantity}</span>
                      <button onClick={() => adjustQty.mutate({ id: p.id, delta: 1 })} className="min-h-11 min-w-11 rounded border border-border hover:bg-muted flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-muted-foreground">{p.min_quantity}</td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => { if (confirm("Delete?")) del.mutate(p.id); }} className="min-h-11 min-w-11 flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
            {(partsQ.data ?? []).length === 0 && !partsQ.isLoading && (
              <tr><td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No parts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}