import { createFileRoute, Link } from "@tanstack/react-router";
import { GuidedTour } from "@/components/guided-tour";
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
import {
  Plus, Car, Trash2, Users, Share2, Timer, FileText, Trophy,
  Radio, Flag, ClipboardList, ChevronRight, Disc, Wand2, Camera, Loader2,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
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
      const m: Record<string, { setups: number; sessions: number; lastOut: string | null; best: number | null }> = {};
      const ensure = (id: string) => {
        if (!m[id]) m[id] = { setups: 0, sessions: 0, lastOut: null, best: null };
        return m[id];
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

  const statFor = (id: string) => statsQ.data?.[id] ?? { setups: 0, sessions: 0, lastOut: null as string | null, best: null as number | null };
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
      <GuidedTour tourKey="garage" />
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

      <TracksideRail userId={user!.id} />

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
  c: CarRow & { photo_path?: string | null }; stat: { setups: number; sessions: number; lastOut: string | null; best: number | null };
  fmtAgo: (s: string | null) => string; shared?: boolean; onDelete?: () => void;
}) {
  return (
    <div className={`group relative rounded-sm border border-border bg-card transition-colors ${shared ? "hover:border-accent" : "hover:border-primary"}`}>
      <CarPhoto carId={c.id} photoPath={c.photo_path ?? null} editable={!shared} />
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/20">
        <div className="flex items-center gap-2 min-w-0">
          <Car className={`w-4 h-4 shrink-0 ${shared ? "text-accent" : "text-primary"}`} />
          <span className={`font-mono text-[10px] uppercase tracking-[0.15em] truncate ${shared ? "text-accent" : "text-primary"}`}>{c.discipline}</span>
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

function CarPhoto({ carId, photoPath, editable }: { carId: string; photoPath: string | null; editable: boolean }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!photoPath) { setUrl(null); return; }
    (async () => {
      const { data } = await supabase.storage.from("photos").createSignedUrl(photoPath, 3600);
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [photoPath]);

  const onPick = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${carId}/cover/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("photos").upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;
      if (photoPath) await supabase.storage.from("photos").remove([photoPath]);
      const { error } = await supabase.from("cars").update({ photo_path: path }).eq("id", carId);
      if (error) throw error;
      toast.success("Photo updated");
      qc.invalidateQueries({ queryKey: ["cars"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted/30 border-b border-border/60">
      {url ? (
        <img src={url} alt="Car" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <Car className="w-10 h-10 opacity-30" />
        </div>
      )}
      {editable && (
        <>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); fileRef.current?.click(); }}
            disabled={uploading}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-sm bg-background/85 backdrop-blur px-2 py-1 text-[10px] font-mono uppercase tracking-[0.15em] border border-border hover:border-primary hover:text-primary transition-colors"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
            {url ? "Change" : "Add photo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }}
          />
        </>
      )}
    </div>
  );
}

// ---------------- Trackside rail (engineer's clipboard) ----------------
// Surfaces the most-recent session, its setup, latest tyre log and driver
// confidence so the homepage answers "what were we doing last time, and
// what's the next thing to do?" without taps.

type LastSession = {
  id: string; name: string; car_id: string; started_at: string;
  session_type: string; track: string | null; driver: string | null;
  setup_id: string | null;
};
type LastSetup = { id: string; name: string };
type LastTire = {
  recorded_at: string; tire_set: string; compound: string | null;
  hot_fl: number | null; hot_fr: number | null; hot_rl: number | null; hot_rr: number | null;
};
type LastConf = { overall: number; recorded_at: string };
type LastLap = { lap_time_ms: number };

function TracksideRail({ userId }: { userId: string }) {
  const sessQ = useQuery({
    queryKey: ["rail-last-session", userId],
    queryFn: async () => {
      const { data } = await supabase.from("sessions")
        .select("id, name, car_id, started_at, session_type, track, driver, setup_id")
        .order("started_at", { ascending: false }).limit(1).maybeSingle();
      return (data ?? null) as LastSession | null;
    },
  });
  const session = sessQ.data;

  const setupQ = useQuery({
    queryKey: ["rail-setup", session?.setup_id],
    enabled: !!session?.setup_id,
    queryFn: async () => {
      const { data } = await supabase.from("setups").select("id, name").eq("id", session!.setup_id!).maybeSingle();
      return (data ?? null) as LastSetup | null;
    },
  });
  const tireQ = useQuery({
    queryKey: ["rail-tire", session?.id],
    enabled: !!session?.id,
    queryFn: async () => {
      const { data } = await supabase.from("tire_logs")
        .select("recorded_at, tire_set, compound, hot_fl, hot_fr, hot_rl, hot_rr")
        .eq("session_id", session!.id)
        .order("recorded_at", { ascending: false }).limit(1).maybeSingle();
      return (data ?? null) as LastTire | null;
    },
  });
  const confQ = useQuery({
    queryKey: ["rail-conf", session?.id],
    enabled: !!session?.id,
    queryFn: async () => {
      const { data } = await supabase.from("driver_confidence")
        .select("overall, recorded_at").eq("session_id", session!.id)
        .order("recorded_at", { ascending: false }).limit(1).maybeSingle();
      return (data ?? null) as LastConf | null;
    },
  });
  const lapQ = useQuery({
    queryKey: ["rail-best", session?.id],
    enabled: !!session?.id,
    queryFn: async () => {
      const { data } = await supabase.from("laps")
        .select("lap_time_ms").eq("session_id", session!.id)
        .order("lap_time_ms", { ascending: true }).limit(1).maybeSingle();
      return (data ?? null) as LastLap | null;
    },
  });

  if (!session) return null;

  const hot = tireQ.data
    ? [tireQ.data.hot_fl, tireQ.data.hot_fr, tireQ.data.hot_rl, tireQ.data.hot_rr].filter((v): v is number => v != null)
    : [];
  const hotAvg = hot.length ? +(hot.reduce((s, v) => s + v, 0) / hot.length).toFixed(1) : null;

  const ago = sessionAgo(session.started_at);

  return (
    <section
      aria-label="Last run — engineer's clipboard"
      className="mb-6 rounded-lg border border-primary/30 bg-gradient-to-br from-primary/[0.06] to-transparent"
    >
      <header className="flex items-center gap-2 px-4 pt-3 text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
        <Radio className="w-3.5 h-3.5" /> Last run · {ago}
        <span className="ml-auto text-muted-foreground">{session.driver ?? "Driver"} · {session.track ?? "Track"}</span>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3 p-4">
        {/* Context */}
        <div className="rounded-md border border-border bg-card/60 p-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <div className="font-display text-2xl font-bold uppercase tracking-tight leading-none">{session.name}</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{session.session_type}</div>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 mt-3 text-xs">
            <RailMetric label="Best lap"  value={lapQ.data ? formatLapTime(lapQ.data.lap_time_ms) : "—"} mono />
            <RailMetric label="Confidence" value={confQ.data ? `${confQ.data.overall}/10` : "—"} mono />
            <RailMetric label="Hot avg"   value={hotAvg != null ? `${hotAvg} psi` : "—"} mono />
            <RailMetric label="Tyre set"  value={tireQ.data?.tire_set ?? "—"} />
          </dl>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em]">
            {setupQ.data && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-accent/40 bg-accent/5 text-accent">
                <Wand2 className="w-3 h-3" /> {setupQ.data.name}
              </span>
            )}
            {tireQ.data?.compound && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-primary/40 bg-primary/5 text-primary">
                <Disc className="w-3 h-3" /> {tireQ.data.compound}
              </span>
            )}
          </div>
        </div>

        {/* Next actions — glove-friendly tap targets */}
        <div className="grid grid-cols-2 gap-2">
          <RailAction to="/pitwall"  tone="primary" icon={Radio} label="Pit wall" sub="Live board" />
          <RailAction
            to="/sessions/$sessionId" params={{ sessionId: session.id }}
            tone="default" icon={Timer} label="Open run" sub="Last session"
          />
          <RailAction to="/debrief" tone="default" icon={ClipboardList} label="Debrief" sub="Log feedback" />
        </div>
      </div>
    </section>
  );
}

function RailMetric({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 truncate ${mono ? "font-mono tabular-nums text-base font-semibold" : "text-sm font-medium"}`}>{value}</dd>
    </div>
  );
}

function RailAction({
  to, params, tone, icon: Icon, label, sub,
}: {
  to: string;
  params?: Record<string, string>;
  tone: "primary" | "default";
  icon: typeof Flag;
  label: string;
  sub: string;
}) {
  const cls = tone === "primary"
    ? "border-primary/50 bg-primary/15 text-primary hover:bg-primary/20"
    : "border-border bg-card/60 hover:border-primary/40 hover:text-primary";
  return (
    <Link
      to={to as never}
      params={params as never}
      className={`group min-h-[64px] rounded-md border ${cls} px-3 py-2 flex items-center gap-3 transition-colors`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs font-mono uppercase tracking-[0.18em] truncate">{label}</div>
        <div className="text-[10px] text-muted-foreground truncate">{sub}</div>
      </div>
      <ChevronRight className="w-4 h-4 ml-auto opacity-50 group-hover:opacity-100" />
    </Link>
  );
}

function sessionAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
