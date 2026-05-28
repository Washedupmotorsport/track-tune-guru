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
import { Plus, Car, ChevronRight, Trash2, Users, Share2, Timer, FileText, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ShareDialog } from "@/components/share-dialog";
import { formatLapTime } from "@/lib/lap-time";

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

  const statsQ = useQuery({
    queryKey: ["garage-stats", user!.id],
    queryFn: async () => {
      const [setups, sessions, laps] = await Promise.all([
        supabase.from("setups").select("car_id"),
        supabase.from("sessions").select("car_id, started_at"),
        supabase.from("laps").select("car_id, lap_time_ms"),
      ]);
      const m = new Map<string, { setups: number; sessions: number; lastOut: string | null; best: number | null }>();
      const ensure = (id: string) => {
        if (!m.has(id)) m.set(id, { setups: 0, sessions: 0, lastOut: null, best: null });
        return m.get(id)!;
      };
      (setups.data ?? []).forEach((r) => { ensure(r.car_id).setups++; });
      (sessions.data ?? []).forEach((r) => {
        const s = ensure(r.car_id); s.sessions++;
        if (!s.lastOut || r.started_at > s.lastOut) s.lastOut = r.started_at;
      });
      (laps.data ?? []).forEach((r) => {
        const s = ensure(r.car_id);
        if (s.best == null || r.lap_time_ms < s.best) s.best = r.lap_time_ms;
      });
      return m;
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

  const statFor = (id: string) => statsQ.data?.get(id) ?? { setups: 0, sessions: 0, lastOut: null as string | null, best: null as number | null };
  const fmtAgo = (iso: string | null) => {
    if (!iso) return "—";
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (d <= 0) return "today";
    if (d === 1) return "1d ago";
    if (d < 30) return `${d}d ago`;
    if (d < 365) return `${Math.floor(d/30)}mo ago`;
    return `${Math.floor(d/365)}y ago`;
  };

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
                      <CarCard key={c.id} c={c} stat={statFor(c.id)} fmtAgo={fmtAgo}
                        onDelete={() => { if (confirm("Delete this car and all its setups?")) del.mutate(c.id); }} />
                    ))}
                  </div>
                )}

                {shared.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-4 h-4 text-accent" />
                      <h2 className="font-display text-xl font-bold uppercase tracking-wider">Shared with you</h2>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {shared.map((c) => (
                        <CarCard key={c.id} c={c} stat={statFor(c.id)} fmtAgo={fmtAgo} shared />
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

type CarRow = { id: string; name: string; discipline: string; make: string | null; model: string | null; year: number | null };
function CarCard({ c, stat, fmtAgo, shared, onDelete }: {
  c: CarRow; stat: { setups: number; sessions: number; lastOut: string | null; best: number | null };
  fmtAgo: (s: string | null) => string; shared?: boolean; onDelete?: () => void;
}) {
  const accent = shared ? "accent" : "primary";
  return (
    <div className={`group relative rounded-sm border border-border bg-card hover:border-${accent} transition-colors`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/20">
        <div className="flex items-center gap-2 min-w-0">
          <Car className={`w-4 h-4 text-${accent} shrink-0`} />
          <span className={`font-mono text-[10px] uppercase tracking-[0.15em] text-${accent} truncate`}>{c.discipline}</span>
        </div>
        <div className="flex items-center gap-1">
          {shared && <span className="text-[10px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-sm bg-accent/20 text-accent">Shared</span>}
          {!shared && onDelete && (
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <ShareDialog carId={c.id} carName={c.name}
                trigger={<button className="text-muted-foreground hover:text-primary p-1"><Share2 className="w-4 h-4" /></button>} />
              <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      <Link to="/cars/$carId" params={{ carId: c.id }} className="block p-3">
        <div className="font-display text-xl font-bold uppercase tracking-tight leading-tight">{c.name}</div>
        <div className="text-xs font-mono text-muted-foreground mt-0.5 truncate">
          {[c.year, c.make, c.model].filter(Boolean).join(" ") || "—"}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border/60 pt-3">
          <Stat icon={<FileText className="w-3 h-3" />} label="Setups" value={String(stat.setups)} />
          <Stat icon={<Timer className="w-3 h-3" />} label="Sessions" value={String(stat.sessions)} />
          <Stat icon={<Trophy className="w-3 h-3" />} label="Best" value={stat.best ? formatLapTime(stat.best) : "—"} mono />
          <Stat label="Last out" value={fmtAgo(stat.lastOut)} mono />
        </div>
      </Link>
    </div>
  );
}

function Stat({ icon, label, value, mono }: { icon?: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`mt-0.5 text-sm font-bold truncate ${mono ? "font-mono tabular-nums" : "font-display"}`}>{value}</div>
    </div>
  );
}