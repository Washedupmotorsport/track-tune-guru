import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, ArrowLeft, FileText, ChevronRight, Trash2, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getDiscipline } from "@/lib/disciplines";
import { ShareDialog } from "@/components/share-dialog";
import { useCarAccess, canEdit } from "@/lib/use-car-access";

export const Route = createFileRoute("/_authenticated/cars/$carId")({
  component: CarDetail,
});

function CarDetail() {
  const { carId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", track: "", conditions: "" });

  const carQ = useQuery({
    queryKey: ["car", carId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("*").eq("id", carId).single();
      if (error) throw error; return data;
    },
  });
  const accessQ = useCarAccess(carId, carQ.data?.user_id);
  const access = accessQ.data;
  const isOwner = access === "owner";
  const writable = canEdit(access);
  const setupsQ = useQuery({
    queryKey: ["setups", carId],
    queryFn: async () => {
      const { data, error } = await supabase.from("setups").select("*").eq("car_id", carId).order("updated_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("setups").insert({
        user_id: user!.id, car_id: carId, name: form.name,
        discipline: carQ.data!.discipline,
        track: form.track || null, conditions: form.conditions || null, setup_data: {},
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setOpen(false);
      setForm({ name: "", track: "", conditions: "" });
      qc.invalidateQueries({ queryKey: ["setups", carId] });
      navigate({ to: "/setups/$setupId", params: { setupId: data.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const cloneSetup = useMutation({
    mutationFn: async (id: string) => {
      const { data: src, error: e1 } = await supabase.from("setups").select("*").eq("id", id).single();
      if (e1) throw e1;
      const { error } = await supabase.from("setups").insert({
        user_id: user!.id, car_id: carId, name: `${src.name} (copy)`, discipline: src.discipline,
        track: src.track, conditions: src.conditions, setup_data: src.setup_data, notes: src.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Setup cloned"); qc.invalidateQueries({ queryKey: ["setups", carId] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("setups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Setup removed"); qc.invalidateQueries({ queryKey: ["setups", carId] }); },
  });

  if (carQ.isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!carQ.data) return <div>Not found</div>;

  const disc = getDiscipline(carQ.data.discipline);

  return (
    <div>
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>
      <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
            {disc.label} · {disc.tagline}
            {access && access !== "owner" && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-accent/20 text-accent">{access}</span>
            )}
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">{carQ.data.name}</h1>
          <div className="text-muted-foreground">
            {[carQ.data.year, carQ.data.make, carQ.data.model].filter(Boolean).join(" ")}
          </div>
        </div>
        <div className="flex gap-2">
          {isOwner && <ShareDialog carId={carId} carName={carQ.data.name} />}
          {writable && (
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-glow"><Plus className="w-4 h-4 mr-1" /> New setup</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New setup sheet</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Quali baseline" /></div>
              <div><Label>Track</Label><Input value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })} placeholder="Spa-Francorchamps" /></div>
              <div><Label>Conditions</Label><Input value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} placeholder="Dry, 22°C track" /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>Create</Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      <div className="mt-8">
        {setupsQ.isLoading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : setupsQ.data && setupsQ.data.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {setupsQ.data.map((s) => (
              <div key={s.id} className="group rounded-lg border border-border bg-card p-5 shadow-card hover:border-primary transition-colors">
                <div className="flex items-start justify-between">
                  <FileText className="w-5 h-5 text-primary" />
                  {writable && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => cloneSetup.mutate(s.id)} className="text-muted-foreground hover:text-accent p-1"><Copy className="w-4 h-4" /></button>
                      <button onClick={() => { if (confirm("Delete this setup?")) del.mutate(s.id); }} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
                <div className="font-display text-xl font-bold mt-3">{s.name}</div>
                <div className="text-sm text-muted-foreground">{[s.track, s.conditions].filter(Boolean).join(" · ") || "—"}</div>
                <div className="text-xs font-mono text-muted-foreground mt-2">Updated {new Date(s.updated_at).toLocaleDateString()}</div>
                <Link to="/setups/$setupId" params={{ setupId: s.id }} className="mt-3 inline-flex items-center text-sm text-accent hover:text-primary">
                  Open sheet <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
            <h3 className="mt-4 font-display text-xl font-semibold">No setups yet</h3>
            <p className="text-sm text-muted-foreground">Create your first {disc.label.toLowerCase()} setup sheet.</p>
          </div>
        )}
      </div>
    </div>
  );
}