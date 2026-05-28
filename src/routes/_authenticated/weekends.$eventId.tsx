import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft, Flag, MapPin, Plus, Timer, Trophy, AlertTriangle, Disc,
  Droplet, Cloud, ClipboardCheck, ChevronRight, NotebookPen,
} from "lucide-react";
import { toast } from "sonner";
import { formatLapTime } from "@/lib/lap-time";

export const Route = createFileRoute("/_authenticated/weekends/$eventId")({ component: WeekendHub });

type Evt = {
  id: string; user_id: string; car_id: string | null; title: string;
  event_type: string; status: string; track: string | null;
  starts_at: string; ends_at: string | null; location: string | null;
  notes: string | null; checklist: Record<string, boolean> | null;
};

const CHECKLIST_TEMPLATES: Record<string, string[]> = {
  race: [
    "Entry confirmed", "Scrutineering booked", "Tyres allocated", "Fuel ordered",
    "Setup baselined", "Spares & tools loaded", "Trailer/transport confirmed",
    "Driver briefing", "Pit board ready", "Garage pass collected",
  ],
  test: [
    "Test plan written", "Setup baselined", "Tyres ready", "Fuel sufficient",
    "Data logger checked", "Spares packed",
  ],
};

const SESSION_GROUPS: { label: string; types: string[] }[] = [
  { label: "Practice", types: ["practice", "testing"] },
  { label: "Qualifying", types: ["qualifying"] },
  { label: "Race", types: ["race"] },
];

const STATUS_OPTIONS = ["planned", "running", "complete"];

function WeekendHub() {
  const { eventId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const evtQ = useQuery({
    queryKey: ["weekend", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("calendar_events").select("*").eq("id", eventId).single();
      if (error) throw error;
      return data as unknown as Evt;
    },
  });

  const sessionsQ = useQuery({
    queryKey: ["weekend-sessions", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions")
        .select("id, name, session_type, started_at, driver, weather, air_temp_c, track_temp_c, fuel_start_l, fuel_end_l, setup_id")
        .eq("event_id", eventId)
        .order("started_at");
      if (error) throw error;
      return data;
    },
  });

  const sessionIds = (sessionsQ.data ?? []).map((s) => s.id);

  const lapsQ = useQuery({
    queryKey: ["weekend-laps", eventId, sessionIds.join(",")],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("laps").select("session_id, lap_time_ms").in("session_id", sessionIds);
      if (error) throw error;
      return data;
    },
  });

  const incidentsQ = useQuery({
    queryKey: ["weekend-incidents", eventId, sessionIds.join(",")],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("incidents").select("id, flag, description, session_id, occurred_at").in("session_id", sessionIds).order("occurred_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const tireQ = useQuery({
    queryKey: ["weekend-tires", eventId, sessionIds.join(",")],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("tire_logs").select("id, tire_set, compound, heat_cycles, session_id").in("session_id", sessionIds);
      if (error) throw error;
      return data;
    },
  });

  const notesQ = useQuery({
    queryKey: ["weekend-notes", evtQ.data?.car_id],
    enabled: !!evtQ.data?.car_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_notes")
        .select("id, title, body, created_at, tags")
        .eq("car_id", evtQ.data!.car_id!)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const updateEvent = useMutation({
    mutationFn: async (patch: Partial<Evt>) => {
      const { error } = await supabase.from("calendar_events").update(patch as never).eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekend", eventId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const toggleStatus = (status: string) => updateEvent.mutate({ status });

  const e = evtQ.data;

  const checklist = useMemo(() => {
    if (!e) return {} as Record<string, boolean>;
    const existing = (e.checklist ?? {}) as Record<string, boolean>;
    if (Object.keys(existing).length > 0) return existing;
    const template = CHECKLIST_TEMPLATES[e.event_type] ?? CHECKLIST_TEMPLATES.race;
    return Object.fromEntries(template.map((label) => [label, false]));
  }, [e]);

  const toggleItem = (label: string) => {
    const next = { ...checklist, [label]: !checklist[label] };
    updateEvent.mutate({ checklist: next });
  };

  const checklistDone = Object.values(checklist).filter(Boolean).length;
  const checklistTotal = Object.keys(checklist).length;

  const sessions = sessionsQ.data ?? [];
  const laps = lapsQ.data ?? [];
  const incidents = incidentsQ.data ?? [];
  const tires = tireQ.data ?? [];

  const totalLaps = laps.length;
  const bestLap = laps.reduce<number | null>((b, l) => b == null || l.lap_time_ms < b ? l.lap_time_ms : b, null);
  const fuelUsed = sessions.reduce((s, x) => {
    if (x.fuel_start_l != null && x.fuel_end_l != null) return s + (Number(x.fuel_start_l) - Number(x.fuel_end_l));
    return s;
  }, 0);
  const uniqueSets = new Set(tires.map((t) => `${t.tire_set}|${t.compound ?? ""}`)).size;

  if (evtQ.isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!e) return <div>Not found.</div>;

  return (
    <div>
      <Link to="/weekends" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to weekends
      </Link>

      <div className="mt-4 rounded-sm border border-border bg-card">
        <div className="px-3 py-2 border-b border-border/60 bg-muted/20 flex items-center gap-3 flex-wrap">
          <Flag className="w-4 h-4 text-primary" />
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary">{e.event_type} weekend</span>
          <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
            {new Date(e.starts_at).toLocaleDateString([], { dateStyle: "medium" })}
            {e.ends_at && ` → ${new Date(e.ends_at).toLocaleDateString([], { dateStyle: "medium" })}`}
          </span>
        </div>
        <div className="p-3 flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold uppercase tracking-tight leading-tight">{e.title}</h1>
            <div className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
              {e.track && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{e.track}</span>}
              {e.location && <span>{e.location}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Status</Label>
            <Select value={e.status} onValueChange={toggleStatus}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat icon={<Timer className="w-3 h-3" />} label="Sessions" value={String(sessions.length)} />
        <Stat icon={<Trophy className="w-3 h-3" />} label="Best lap" value={formatLapTime(bestLap)} accent mono />
        <Stat label="Total laps" value={String(totalLaps)} mono />
        <Stat icon={<Disc className="w-3 h-3" />} label="Tyre sets" value={String(uniqueSets)} mono />
        <Stat icon={<Droplet className="w-3 h-3" />} label="Fuel used" value={fuelUsed > 0 ? `${fuelUsed.toFixed(1)} L` : "—"} mono />
      </div>

      <div className="mt-4 grid lg:grid-cols-[1fr_320px] gap-3">
        <div className="space-y-3">
          {SESSION_GROUPS.map((g) => {
            const rows = sessions.filter((s) => g.types.includes(s.session_type));
            const groupLaps = laps.filter((l) => rows.some((r) => r.id === l.session_id));
            return (
              <div key={g.label} className="rounded-sm border border-border bg-card">
                <div className="px-3 py-2 border-b border-border/60 bg-muted/20 flex items-center gap-3">
                  <span className="font-display text-xs font-bold uppercase tracking-[0.15em]">{g.label}</span>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{rows.length} session{rows.length === 1 ? "" : "s"} · {groupLaps.length} laps</span>
                  <div className="ml-auto">
                    <NewSessionButton eventId={eventId} carId={e.car_id} userId={user!.id} defaultType={g.types[0]} track={e.track} onCreated={() => qc.invalidateQueries({ queryKey: ["weekend-sessions", eventId] })} />
                  </div>
                </div>
                {rows.length === 0 ? (
                  <div className="px-3 py-4 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">No {g.label.toLowerCase()} sessions yet.</div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {rows.map((s) => {
                      const sl = laps.filter((l) => l.session_id === s.id);
                      const best = sl.reduce<number | null>((b, l) => b == null || l.lap_time_ms < b ? l.lap_time_ms : b, null);
                      const fuel = s.fuel_start_l != null && s.fuel_end_l != null ? (Number(s.fuel_start_l) - Number(s.fuel_end_l)) : null;
                      return (
                        <Link key={s.id} to="/sessions/$sessionId" params={{ sessionId: s.id }}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted/20 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="font-display font-bold uppercase tracking-tight truncate">{s.name}</div>
                            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                              <span>{new Date(s.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              {s.driver && <span>· {s.driver}</span>}
                              {s.weather && <span className="inline-flex items-center gap-1"><Cloud className="w-3 h-3" />{s.weather}</span>}
                              {s.air_temp_c != null && <span>{s.air_temp_c}°C</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 font-mono tabular-nums text-xs shrink-0">
                            <Cell label="Laps" value={String(sl.length)} />
                            <Cell label="Best" value={formatLapTime(best)} accent />
                            {fuel != null && <Cell label="Fuel" value={`${fuel.toFixed(1)}L`} />}
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="rounded-sm border border-border bg-card">
            <div className="px-3 py-2 border-b border-border/60 bg-muted/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary" />
              <span className="font-display text-xs font-bold uppercase tracking-[0.15em]">Issues & incidents</span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{incidents.length}</span>
            </div>
            {incidents.length === 0 ? (
              <div className="px-3 py-3 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">No incidents logged for this weekend.</div>
            ) : (
              <ul className="divide-y divide-border/60">
                {incidents.slice(0, 10).map((i) => (
                  <li key={i.id} className="px-3 py-2 flex items-center gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-sm bg-primary/20 text-primary">{i.flag}</span>
                    <span className="flex-1 min-w-0 truncate text-sm">{i.description ?? "—"}</span>
                    <span className="text-[10px] font-mono tabular-nums text-muted-foreground">{new Date(i.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {e.car_id && (
            <div className="rounded-sm border border-border bg-card">
              <div className="px-3 py-2 border-b border-border/60 bg-muted/20 flex items-center gap-2">
                <NotebookPen className="w-4 h-4 text-primary" />
                <span className="font-display text-xs font-bold uppercase tracking-[0.15em]">Recent driver notes</span>
                <Link to="/notes" className="ml-auto text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground hover:text-primary">All notes →</Link>
              </div>
              {(notesQ.data ?? []).length === 0 ? (
                <div className="px-3 py-3 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">No notes yet for this car.</div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {(notesQ.data ?? []).map((n) => (
                    <li key={n.id} className="px-3 py-2">
                      <div className="font-display font-bold uppercase tracking-tight text-sm">{n.title}</div>
                      {n.body && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-sm border border-border bg-card">
            <div className="px-3 py-2 border-b border-border/60 bg-muted/20 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-primary" />
              <span className="font-display text-xs font-bold uppercase tracking-[0.15em]">Prep checklist</span>
              <span className="ml-auto font-mono text-[10px] tabular-nums text-primary">{checklistDone}/{checklistTotal}</span>
            </div>
            <div className="h-1 bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${checklistTotal ? (checklistDone / checklistTotal) * 100 : 0}%` }} />
            </div>
            <ul className="p-2 space-y-1">
              {Object.entries(checklist).map(([label, done]) => (
                <li key={label} className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted/30 cursor-pointer" onClick={() => toggleItem(label)}>
                  <Checkbox checked={done} onCheckedChange={() => toggleItem(label)} />
                  <span className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`}>{label}</span>
                </li>
              ))}
            </ul>
            <AddChecklistItem onAdd={(label) => updateEvent.mutate({ checklist: { ...checklist, [label]: false } })} />
          </div>

          <div className="rounded-sm border border-border bg-card p-3">
            <div className="font-display text-xs font-bold uppercase tracking-[0.15em] mb-2">Quick actions</div>
            <div className="grid gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate({ to: "/sessions" })}>
                <Timer className="w-4 h-4 mr-1" /> All sessions
              </Button>
              {e.car_id && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/cars/$carId" params={{ carId: e.car_id }}>Open car</Link>
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link to="/tires">Tyre logs</Link>
              </Button>
            </div>
          </div>

          <WeekendNotes evt={e} onSaved={() => qc.invalidateQueries({ queryKey: ["weekend", eventId] })} />
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, mono, accent }: { icon?: React.ReactNode; label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="rounded-sm border border-border bg-card px-3 py-2">
      <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{icon}{label}</div>
      <div className={`mt-0.5 text-lg font-bold truncate ${mono ? "font-mono tabular-nums" : "font-display"} ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function AddChecklistItem({ onAdd }: { onAdd: (label: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form className="border-t border-border/60 p-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV(""); } }}>
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="Add task" className="h-9 text-sm" />
      <Button type="submit" size="sm" disabled={!v.trim()}><Plus className="w-4 h-4" /></Button>
    </form>
  );
}

function WeekendNotes({ evt, onSaved }: { evt: Evt; onSaved: () => void }) {
  const [v, setV] = useState(evt.notes ?? "");
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("calendar_events").update({ notes: v || null }).eq("id", evt.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <div className="rounded-sm border border-border bg-card p-3">
      <div className="font-display text-xs font-bold uppercase tracking-[0.15em] mb-2">Weekend notes</div>
      <Textarea value={v} onChange={(e) => setV(e.target.value)} rows={4} placeholder="Strategy, weather call, key learnings…" />
      <Button size="sm" className="mt-2 w-full" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
    </div>
  );
}

function NewSessionButton({ eventId, carId, userId, defaultType, track, onCreated }: {
  eventId: string; carId: string | null; userId: string; defaultType: string; track: string | null; onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [driver, setDriver] = useState("");
  const [fuel, setFuel] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!carId) throw new Error("This weekend has no car attached — set one on the calendar entry first.");
      const { error } = await supabase.from("sessions").insert({
        user_id: userId, car_id: carId, event_id: eventId,
        name: name || defaultType, session_type: defaultType,
        track: track || null, driver: driver || null,
        fuel_start_l: fuel ? Number(fuel) : null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Session added");
      setOpen(false); setName(""); setDriver(""); setFuel("");
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] font-mono uppercase tracking-[0.15em]">
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New {defaultType} session</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`FP1`} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Driver</Label><Input value={driver} onChange={(e) => setDriver(e.target.value)} /></div>
            <div><Label>Fuel start (L)</Label><Input type="number" step="any" value={fuel} onChange={(e) => setFuel(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>Create session</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}