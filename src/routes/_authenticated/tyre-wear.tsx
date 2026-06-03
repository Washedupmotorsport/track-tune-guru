import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Disc, Plus, Trash2, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { TyreTabs } from "@/components/tyre-tabs";

export const Route = createFileRoute("/_authenticated/tyre-wear")({
  component: TyreWearPage,
  head: () => ({
    meta: [
      { title: "Tyre Wear — My Race Engineer" },
      { name: "description", content: "Log tyre stints and see predicted wear, remaining life, and when to change tyres." },
    ],
  }),
});

const MIN_TREAD_MM = 2; // change threshold
const NEW_TREAD_MM = 8; // assumed new-tyre depth (slick=3, road=8). Used only for % display when no first reading.

type Car = { id: string; name: string };
type Stint = {
  id: string; car_id: string; tire_set: string; compound: string | null;
  recorded_at: string; laps: number; distance_km: number | null;
  tread_fl: number | null; tread_fr: number | null; tread_rl: number | null; tread_rr: number | null;
  notes: string | null;
};

const empty4 = { fl: "", fr: "", rl: "", rr: "" };

function TyreWearPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [carId, setCarId] = useState("");
  const [form, setForm] = useState({
    tire_set: "", compound: "", laps: "", distance_km: "",
    tread: { ...empty4 }, notes: "",
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

  const stintsQ = useQuery({
    queryKey: ["tire_stints", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tire_stints").select("*").order("recorded_at", { ascending: true });
      if (error) throw error;
      return data as Stint[];
    },
    enabled: !!user,
  });

  const num = (s: string) => s ? Number(s) : null;

  const create = useMutation({
    mutationFn: async () => {
      if (!carId) throw new Error("Pick a car");
      if (!form.tire_set) throw new Error("Tire set required");
      const { error } = await supabase.from("tire_stints").insert({
        user_id: user!.id, car_id: carId, tire_set: form.tire_set,
        compound: form.compound || null,
        laps: parseInt(form.laps || "0", 10),
        distance_km: num(form.distance_km),
        tread_fl: num(form.tread.fl), tread_fr: num(form.tread.fr),
        tread_rl: num(form.tread.rl), tread_rr: num(form.tread.rr),
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stint logged");
      setOpen(false);
      setForm({ tire_set: "", compound: "", laps: "", distance_km: "", tread: { ...empty4 }, notes: "" });
      qc.invalidateQueries({ queryKey: ["tire_stints"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tire_stints").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tire_stints"] }),
  });

  const carName = (id: string) => carsQ.data?.find((c) => c.id === id)?.name ?? "—";

  // Group stints by car + tire_set, compute wear rate and prediction.
  const grouped = useMemo(() => {
    const all = stintsQ.data ?? [];
    const map = new Map<string, Stint[]>();
    for (const s of all) {
      const key = `${s.car_id}__${s.tire_set}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).map(([key, list]) => {
      // already asc by recorded_at
      const totalLaps = list.reduce((acc, s) => acc + (s.laps || 0), 0);
      const corners = (["tread_fl","tread_fr","tread_rl","tread_rr"] as const).map((k) => {
        const first = list.find((s) => s[k] != null);
        const last = [...list].reverse().find((s) => s[k] != null);
        const lapsBetween = first === last ? 0 :
          list.slice(list.indexOf(first!) + 1, list.indexOf(last!) + 1).reduce((a, s) => a + (s.laps || 0), 0);
        const wornMm = first && last && first !== last ? (Number(first[k]) - Number(last[k])) : 0;
        const wearPerLap = lapsBetween > 0 && wornMm > 0 ? wornMm / lapsBetween : 0;
        const currentMm = last ? Number(last[k]) : null;
        const lapsRemaining = wearPerLap > 0 && currentMm != null
          ? Math.max(0, Math.floor((currentMm - MIN_TREAD_MM) / wearPerLap)) : null;
        return { corner: k.slice(-2).toUpperCase(), currentMm, wearPerLap, lapsRemaining };
      });
      const minCurrent = corners.reduce<number | null>((m, c) => c.currentMm == null ? m : (m == null ? c.currentMm : Math.min(m, c.currentMm)), null);
      const minRemaining = corners.reduce<number | null>((m, c) => c.lapsRemaining == null ? m : (m == null ? c.lapsRemaining : Math.min(m, c.lapsRemaining)), null);
      const status: "ok" | "warn" | "change" =
        minCurrent == null ? "ok"
        : minCurrent <= MIN_TREAD_MM ? "change"
        : (minRemaining != null && minRemaining <= 5) ? "warn"
        : "ok";
      const last = list[list.length - 1];
      return { key, list, last, totalLaps, corners, minCurrent, minRemaining, status };
    });
  }, [stintsQ.data]);

  return (
    <div>
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>
      <TyreTabs />
      <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
            <TrendingDown className="w-3 h-3" /> Wear
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Tyre wear</h1>
          <p className="text-sm text-muted-foreground mt-1">Log stints with remaining tread per corner. We project wear rate and remaining laps before the change threshold ({MIN_TREAD_MM} mm).</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="shadow-glow"><Plus className="w-4 h-4 mr-1" /> Log stint</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New stint</DialogTitle></DialogHeader>
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
                <div><Label>Laps</Label><Input type="number" value={form.laps} onChange={(e) => setForm({ ...form, laps: e.target.value })} /></div>
                <div><Label>Distance (km)</Label><Input type="number" step="any" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} /></div>
              </div>
              <div>
                <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Remaining tread (mm) — measured after stint</Label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {(["fl","fr","rl","rr"] as const).map((k) => (
                    <Input key={k} className="font-mono text-center" placeholder={k.toUpperCase()} type="number" step="any"
                      value={form.tread[k]} onChange={(e) => setForm({ ...form, tread: { ...form.tread, [k]: e.target.value } })} />
                  ))}
                </div>
              </div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Save stint</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 space-y-4">
        {stintsQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!stintsQ.isLoading && grouped.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Disc className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No stints yet. Log one to start tracking wear.</p>
          </div>
        )}

        {grouped.map((g) => (
          <div key={g.key} className="rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{carName(g.last.car_id)}</div>
                <div className="font-display text-xl font-bold mt-1">
                  {g.last.tire_set}{g.last.compound && <span className="text-muted-foreground text-base font-normal"> · {g.last.compound}</span>}
                </div>
                <div className="text-xs text-muted-foreground">{g.list.length} stint{g.list.length === 1 ? "" : "s"} · {g.totalLaps} laps total</div>
              </div>
              <StatusBadge status={g.status} minRemaining={g.minRemaining} />
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              {g.corners.map((c) => (
                <div key={c.corner} className="rounded-md border border-border bg-background/50 p-3">
                  <div className="font-display font-bold uppercase text-xs">{c.corner}</div>
                  <div className="font-mono text-2xl font-bold mt-1">
                    {c.currentMm == null ? "—" : `${c.currentMm.toFixed(1)}`}
                    <span className="text-xs text-muted-foreground ml-1">mm</span>
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
                    Wear: {c.wearPerLap > 0 ? `${c.wearPerLap.toFixed(3)} mm/lap` : "—"}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-primary mt-0.5">
                    Remaining: {c.lapsRemaining == null ? "—" : `${c.lapsRemaining} laps`}
                  </div>
                  {c.currentMm != null && (
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${c.currentMm <= MIN_TREAD_MM ? "bg-destructive" : c.currentMm <= MIN_TREAD_MM + 1 ? "bg-destructive/70" : "bg-chart-3"}`}
                        style={{ width: `${Math.max(4, Math.min(100, (c.currentMm / NEW_TREAD_MM) * 100))}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">Stint history</summary>
              <div className="mt-2 space-y-2">
                {g.list.slice().reverse().map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-md border border-border bg-background/30 px-3 py-2 text-sm">
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">{new Date(s.recorded_at).toLocaleDateString()} · </span>
                      <span className="font-mono">{s.laps} laps{s.distance_km ? ` · ${s.distance_km} km` : ""}</span>
                      <span className="text-muted-foreground"> · FL {s.tread_fl ?? "—"} / FR {s.tread_fr ?? "—"} / RL {s.tread_rl ?? "—"} / RR {s.tread_rr ?? "—"}</span>
                    </div>
                    <button onClick={() => { if (confirm("Delete stint?")) del.mutate(s.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status, minRemaining }: { status: "ok" | "warn" | "change"; minRemaining: number | null }) {
  if (status === "change") return (
    <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-destructive">
      <AlertTriangle className="w-4 h-4" />
      <span className="font-mono text-xs uppercase tracking-widest">Change now</span>
    </div>
  );
  if (status === "warn") return (
    <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-destructive">
      <AlertTriangle className="w-4 h-4" />
      <span className="font-mono text-xs uppercase tracking-widest">~{minRemaining} laps left</span>
    </div>
  );
  return (
    <div className="flex items-center gap-2 rounded-md border border-chart-3/40 bg-chart-3/10 px-3 py-1.5 text-chart-3">
      <CheckCircle2 className="w-4 h-4" />
      <span className="font-mono text-xs uppercase tracking-widest">{minRemaining != null ? `${minRemaining} laps left` : "Healthy"}</span>
    </div>
  );
}