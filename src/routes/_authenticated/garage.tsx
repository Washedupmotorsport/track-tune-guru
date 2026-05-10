import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DISCIPLINES } from "@/lib/disciplines";
import { Plus, Car, ChevronRight, Trash2, Users, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ShareDialog } from "@/components/share-dialog";

export const Route = createFileRoute("/_authenticated/garage")({
  component: Garage,
});

function Garage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", make: "", model: "", year: "", discipline: "circuit", notes: "" });

  const carsQ = useQuery({
    queryKey: ["cars", user!.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cars").insert({
        user_id: user!.id,
        name: form.name,
        make: form.make || null,
        model: form.model || null,
        year: form.year ? Number(form.year) : null,
        discipline: form.discipline,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Car added to garage");
      setOpen(false);
      setForm({ name: "", make: "", model: "", year: "", discipline: "circuit", notes: "" });
      qc.invalidateQueries({ queryKey: ["cars"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cars").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Car removed"); qc.invalidateQueries({ queryKey: ["cars"] }); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary">Paddock</div>
          <h1 className="font-display text-4xl font-bold mt-1">Your Garage</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-glow"><Plus className="w-4 h-4 mr-1" /> Add car</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add a car</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My GT3" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Make</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></div>
                <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
                <div><Label>Year</Label><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
              </div>
              <div>
                <Label>Discipline</Label>
                <Select value={form.discipline} onValueChange={(v) => setForm({ ...form, discipline: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DISCIPLINES.map(d => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>Add to garage</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {carsQ.isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : carsQ.data && carsQ.data.length > 0 ? (
        <>
          {(() => {
            const owned = carsQ.data!.filter((c) => c.user_id === user!.id);
            const shared = carsQ.data!.filter((c) => c.user_id !== user!.id);
            return (
              <>
                {owned.length > 0 && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {owned.map((c) => (
                      <div key={c.id} className="group rounded-lg border border-border bg-card p-5 shadow-card hover:border-primary transition-colors">
                        <div className="flex items-start justify-between">
                          <Car className="w-5 h-5 text-primary" />
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ShareDialog carId={c.id} carName={c.name}
                              trigger={<button className="text-muted-foreground hover:text-primary p-1"><Share2 className="w-4 h-4" /></button>} />
                            <button onClick={() => { if (confirm("Delete this car and all its setups?")) del.mutate(c.id); }}
                              className="text-muted-foreground hover:text-destructive p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="font-mono text-xs uppercase tracking-widest text-primary mt-3">{c.discipline}</div>
                        <div className="font-display text-2xl font-bold mt-1">{c.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {[c.year, c.make, c.model].filter(Boolean).join(" ") || "—"}
                        </div>
                        <Link to="/cars/$carId" params={{ carId: c.id }} className="mt-4 inline-flex items-center text-sm text-accent hover:text-primary">
                          Open setups <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}

                {shared.length > 0 && (
                  <div className="mt-10">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-4 h-4 text-accent" />
                      <h2 className="font-display text-xl font-bold uppercase tracking-wider">Shared with you</h2>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {shared.map((c) => (
                        <div key={c.id} className="rounded-lg border border-accent/40 bg-card p-5 shadow-card hover:border-accent transition-colors">
                          <div className="flex items-start justify-between">
                            <Car className="w-5 h-5 text-accent" />
                            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-accent/20 text-accent">Shared</span>
                          </div>
                          <div className="font-mono text-xs uppercase tracking-widest text-accent mt-3">{c.discipline}</div>
                          <div className="font-display text-2xl font-bold mt-1">{c.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {[c.year, c.make, c.model].filter(Boolean).join(" ") || "—"}
                          </div>
                          <Link to="/cars/$carId" params={{ carId: c.id }} className="mt-4 inline-flex items-center text-sm text-accent hover:text-primary">
                            Open setups <ChevronRight className="w-4 h-4 ml-1" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {owned.length === 0 && shared.length === 0 && <EmptyState />}
              </>
            );
          })()}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Car className="w-10 h-10 mx-auto text-muted-foreground" />
          <h3 className="mt-4 font-display text-xl font-semibold">No cars yet</h3>
          <p className="text-sm text-muted-foreground">Add your first car to start tracking setups.</p>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border p-12 text-center">
      <Car className="w-10 h-10 mx-auto text-muted-foreground" />
      <h3 className="mt-4 font-display text-xl font-semibold">No cars yet</h3>
      <p className="text-sm text-muted-foreground">Add your first car to start tracking setups.</p>
    </div>
  );
}