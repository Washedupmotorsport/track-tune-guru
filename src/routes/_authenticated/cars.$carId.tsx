import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, ArrowLeft, FileText, ChevronRight, Trash2, Copy, Timer, Trophy, Disc } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getDiscipline } from "@/lib/disciplines";
import { ShareDialog } from "@/components/share-dialog";
import { useCarAccess, canEdit } from "@/lib/use-car-access";
import { formatLapTime } from "@/lib/lap-time";

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

  const statsQ = useQuery({
    queryKey: ["car-stats", carId],
    queryFn: async () => {
      const [sessions, laps, tires] = await Promise.all([
        supabase.from("sessions").select("id, started_at").eq("car_id", carId),
        supabase.from("laps").select("lap_time_ms, setup_id").eq("car_id", carId),
        supabase.from("tire_logs").select("id").eq("car_id", carId),
      ]);
      const best = (laps.data ?? []).reduce<number | null>((b, l) => b == null || l.lap_time_ms < b ? l.lap_time_ms : b, null);
      const lastOut = (sessions.data ?? []).reduce<string | null>((m, s) => !m || s.started_at > m ? s.started_at : m, null);
      const bestBySetup = new Map<string, number>();
      (laps.data ?? []).forEach((l) => {
        if (!l.setup_id) return;
        const cur = bestBySetup.get(l.setup_id);
        if (cur == null || l.lap_time_ms < cur) bestBySetup.set(l.setup_id, l.lap_time_ms);
      });
      const lapsBySetup = new Map<string, number>();
      (laps.data ?? []).forEach((l) => {
        if (!l.setup_id) return;
        lapsBySetup.set(l.setup_id, (lapsBySetup.get(l.setup_id) ?? 0) + 1);
      });
      return {
        sessions: sessions.data?.length ?? 0,
        laps: laps.data?.length ?? 0,
        tireSets: tires.data?.length ?? 0,
        best, lastOut, bestBySetup, lapsBySetup,
      };
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
            <DialogHeader><DialogTitle>New setup</DialogTitle></DialogHeader>
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

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
        <StatTile icon={<FileText className="w-3 h-3" />} label="Setups" value={String(setupsQ.data?.length ?? 0)} />
        <StatTile icon={<Timer className="w-3 h-3" />} label="Sessions" value={String(statsQ.data?.sessions ?? 0)} />
        <StatTile icon={<Trophy className="w-3 h-3" />} label="Best lap" value={formatLapTime(statsQ.data?.best ?? null)} mono accent />
        <StatTile label="Laps logged" value={String(statsQ.data?.laps ?? 0)} mono />
        <StatTile icon={<Disc className="w-3 h-3" />} label="Tyre sets" value={String(statsQ.data?.tireSets ?? 0)} />
      </div>

      <div className="mt-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px flex-1 bg-border" />
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">Setups</h2>
          <div className="h-px flex-1 bg-border" />
        </div>
        {setupsQ.isLoading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : setupsQ.data && setupsQ.data.length > 0 ? (
          <div className="rounded-sm border border-border bg-card divide-y divide-border/60">
            {setupsQ.data.map((s) => (
              <div key={s.id} className="group flex items-center gap-3 px-3 py-2.5 hover:bg-muted/20 transition-colors">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <Link to="/setups/$setupId" params={{ setupId: s.id }} className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <div className="font-display font-bold uppercase tracking-tight truncate">{s.name}</div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground truncate">
                      {[s.track, s.conditions].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                </Link>
                <div className="hidden sm:flex items-center gap-4 text-[11px] font-mono tabular-nums shrink-0">
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Best</div>
                    <div className="text-primary font-bold">{formatLapTime(statsQ.data?.bestBySetup.get(s.id) ?? null)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Laps</div>
                    <div>{statsQ.data?.lapsBySetup.get(s.id) ?? 0}</div>
                  </div>
                  <div className="text-right text-muted-foreground">
                    <div className="text-[9px] uppercase tracking-[0.15em]">Updated</div>
                    <div>{new Date(s.updated_at).toLocaleDateString()}</div>
                  </div>
                </div>
                {writable && (
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => cloneSetup.mutate(s.id)} className="text-muted-foreground hover:text-accent p-1"><Copy className="w-4 h-4" /></button>
                    <button onClick={() => { if (confirm("Delete this setup?")) del.mutate(s.id); }} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
            <h3 className="mt-4 font-display text-xl font-semibold">No setups yet</h3>
            <p className="text-sm text-muted-foreground">Create your first {disc.label.toLowerCase()} setup.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, mono, accent }: { icon?: React.ReactNode; label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="rounded-sm border border-border bg-card px-3 py-2">
      <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`mt-0.5 text-lg font-bold truncate ${mono ? "font-mono tabular-nums" : "font-display"} ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}