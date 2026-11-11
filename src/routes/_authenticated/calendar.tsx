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
import { CalendarDays, Plus, ArrowLeft, Trash2, Clock, Flag } from "lucide-react";
import { toast } from "sonner";
import { ReminderSettingsButton } from "@/components/reminder-settings";
import { circuitProgress, seasonSummary, isRun } from "@/lib/race-calendar";
import { CheckCircle2, CircleDashed, Ban, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [
    { title: "Calendar | My Race Engineer" },
    { name: "description", content: "Calendar: race-weekend tools and records for My Race Engineer." },
    { property: "og:title", content: "Calendar | My Race Engineer" },
    { property: "og:description", content: "Calendar: race-weekend tools and records for My Race Engineer." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
 component: CalendarPage });

type Car = { id: string; name: string };
type Evt = {
  id: string; car_id: string | null; title: string; event_type: string;
  track: string | null; starts_at: string; ends_at: string | null;
  location: string | null; notes: string | null;
  status: string; track_id: string | null;
};
const TYPES = ["race", "test", "deadline", "scrutineering", "workshop"];

function CalendarPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ car_id: "none", title: "", event_type: "race", track: "", starts_at: "", ends_at: "", location: "", notes: "" });

  const carsQ = useQuery({
    queryKey: ["cars-min", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id, name").order("created_at");
      if (error) throw error;
      return data as Car[];
    }, enabled: !!user,
  });

  const eventsQ = useQuery({
    queryKey: ["calendar", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("calendar_events").select("*").order("starts_at");
      if (error) throw error;
      return data as Evt[];
    }, enabled: !!user,
  });

  const tracksQ = useQuery({
    queryKey: ["tracks-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tracks").select("id, name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    }, enabled: !!user,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("calendar_events").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.starts_at) throw new Error("Title and date required");
      const { error } = await supabase.from("calendar_events").insert({
        user_id: user!.id, car_id: form.car_id === "none" ? null : form.car_id,
        title: form.title, event_type: form.event_type,
        track: form.track || null,
        track_id: tracksQ.data?.find((t) => t.name.toLowerCase() === form.track.trim().toLowerCase())?.id ?? null,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        location: form.location || null, notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event added");
      setOpen(false);
      setForm({ car_id: "none", title: "", event_type: "race", track: "", starts_at: "", ends_at: "", location: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("calendar_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
  });

  const now = Date.now();
  const events = eventsQ.data ?? [];
  const upcoming = events.filter((e) => !isRun(e, now) && e.status !== "cancelled");
  const past = events.filter((e) => isRun(e, now) || e.status === "cancelled");
  const summary = seasonSummary(events, now);
  const circuits = circuitProgress(events, now);
  const monthLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const carName = (id: string | null) => id ? (carsQ.data?.find((c) => c.id === id)?.name ?? "—") : null;

  const daysUntil = (iso: string) => {
    const ms = new Date(iso).getTime() - now;
    return Math.ceil(ms / 86400000);
  };

  return (
    <div>
      <Link to="/garage" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to garage
      </Link>
      <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Schedule</div>
          <h1 className="font-display text-4xl font-bold mt-1">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">Plan your race weekends and see which circuits are left to run.</p>
        </div>
        <div className="flex items-center gap-2">
          <ReminderSettingsButton />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-glow"><Plus className="w-4 h-4 mr-1" /> New event</Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader><DialogTitle>New event</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Brands Hatch round 3" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Track / location</Label><Input list="calendar-tracks" value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })} placeholder="Queensland Raceway" />
                  <datalist id="calendar-tracks">{(tracksQ.data ?? []).map((t) => <option key={t.id} value={t.name} />)}</datalist></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start *</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
                <div><Label>End</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
              </div>
              <div>
                <Label>Car (optional)</Label>
                <Select value={form.car_id} onValueChange={(v) => setForm({ ...form, car_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— none —</SelectItem>
                    {(carsQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Add event</Button></DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {eventsQ.isLoading && <div className="mt-8 text-sm text-muted-foreground">Loading calendar…</div>}
      {eventsQ.isError && <div className="mt-8 text-sm text-destructive">Couldn't load your calendar. Try refreshing.</div>}

      <section className="mt-8 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold uppercase tracking-wider">Season progress</h2>
            <p className="text-xs text-muted-foreground mt-1">Race and test rounds. Past rounds count as run unless cancelled.</p>
          </div>
          <div className="flex gap-6 font-mono text-sm">
            <div><div className="text-2xl font-display font-bold text-primary">{summary.run}/{summary.rounds}</div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Rounds run</div></div>
            <div><div className="text-2xl font-display font-bold text-primary">{summary.circuitsLeft}</div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Circuits left</div></div>
          </div>
        </div>
        {summary.rounds > 0 && (
          <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${(summary.run / summary.rounds) * 100}%` }} /></div>
        )}
        {circuits.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Add a race or test event with a circuit to start tracking your season.</p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {circuits.map((c) => {
              const done = c.run >= c.rounds;
              return (
                <li key={c.key} className={`flex items-center gap-3 rounded-md border border-border p-3 min-w-0 ${done ? "opacity-70" : ""}`}>
                  {done ? <CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> : <CircleDashed className="w-5 h-5 text-muted-foreground shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="font-display font-bold truncate">{c.name}</div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {c.run}/{c.rounds} run{c.nextDate ? ` · next ${new Date(c.nextDate).toLocaleDateString()}` : done ? " · done" : ""}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <h2 className="mt-8 font-display text-xl font-bold uppercase tracking-wider">Upcoming</h2>
      <div className="mt-3 space-y-2">
        {upcoming.length === 0 && <div className="text-sm text-muted-foreground">Nothing on the calendar.</div>}
        {upcoming.map((e, i) => {
          const d = daysUntil(e.starts_at);
          const month = monthLabel(e.starts_at);
          const showMonth = i === 0 || monthLabel(upcoming[i - 1].starts_at) !== month;
          return (
            <div key={e.id}>
            {showMonth && <div className="pt-3 pb-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">{month}</div>}
            <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
              <div className="font-display text-2xl font-bold text-primary w-16 text-center">
                {d <= 0 ? "Now" : `${d}d`}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-primary/20 text-primary">{e.event_type}</span>
                  {carName(e.car_id) && <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{carName(e.car_id)}</span>}
                </div>
                <div className="font-display font-bold mt-1">{e.title}</div>
                <div className="text-xs font-mono text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" /> {new Date(e.starts_at).toLocaleString()}
                  {e.track && ` · ${e.track}`}
                </div>
              </div>
              {(e.event_type === "race" || e.event_type === "test") && (
                <>
                  <button aria-label="Mark as run" title="Mark as run" onClick={() => setStatus.mutate({ id: e.id, status: "completed" })} className="text-muted-foreground hover:text-primary"><CheckCircle2 className="w-4 h-4" /></button>
                  <button aria-label="Mark as cancelled" title="Mark as cancelled" onClick={() => setStatus.mutate({ id: e.id, status: "cancelled" })} className="text-muted-foreground hover:text-destructive"><Ban className="w-4 h-4" /></button>
                </>
              )}
              <button aria-label="Delete event" onClick={() => { if (confirm("Delete?")) del.mutate(e.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              {(e.event_type === "race" || e.event_type === "test") && (
                <Link to="/weekends/$eventId" params={{ eventId: e.id }}
                  className="ml-2 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em] text-primary hover:underline">
                  <Flag className="w-3 h-3" /> Weekend
                </Link>
              )}
            </div>
            </div>
          );
        })}
      </div>

      {past.length > 0 && (
        <>
          <h2 className="mt-6 font-display text-xl font-bold uppercase tracking-wider text-muted-foreground">Past</h2>
          <div className="mt-3 space-y-2 opacity-60">
            {[...past].sort((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, 15).map((e) => (
              <div key={e.id} className="rounded-lg border border-border bg-card p-3 text-sm flex justify-between">
                <span className="min-w-0"><span className="font-mono text-xs text-muted-foreground">{new Date(e.starts_at).toLocaleDateString()}</span> · {e.title}{e.track ? ` · ${e.track}` : ""}{e.status === "cancelled" && <span className="ml-2 font-mono text-[10px] uppercase text-destructive">Cancelled</span>}</span>
                <span className="flex items-center gap-2 shrink-0">
                {e.status !== "planned" && <button aria-label="Move back to upcoming" title="Move back to upcoming" onClick={() => setStatus.mutate({ id: e.id, status: "planned" })} className="text-muted-foreground hover:text-primary"><RotateCcw className="w-4 h-4" /></button>}
                <button onClick={() => { if (confirm("Delete?")) del.mutate(e.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}