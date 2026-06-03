import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CalendarDays, MapPin, ChevronRight, Flag, Timer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/weekends")({ component: WeekendsPage });

type Evt = {
  id: string; title: string; event_type: string; status: string;
  track: string | null; starts_at: string; ends_at: string | null;
  location: string | null; car_id: string | null;
};
type SessAgg = { id: string; event_id: string | null; session_type: string };

const STATUS_TONE: Record<string, string> = {
  planned: "bg-muted text-muted-foreground border-border",
  running: "bg-primary/20 text-primary border-primary/40",
  complete: "bg-accent/10 text-accent border-accent/40",
};

function WeekendsPage() {
  const { user } = useAuth();

  const eventsQ = useQuery({
    queryKey: ["weekends", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("calendar_events")
        .select("id, title, event_type, status, track, starts_at, ends_at, location, car_id")
        .in("event_type", ["race", "test"])
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data as Evt[];
    }, enabled: !!user,
  });

  const sessQ = useQuery({
    queryKey: ["weekend-session-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions").select("id, event_id, session_type");
      if (error) throw error;
      const m = new Map<string, number>();
      (data as SessAgg[] ?? []).forEach((s) => {
        if (!s.event_id) return;
        m.set(s.event_id, (m.get(s.event_id) ?? 0) + 1);
      });
      return m;
    },
  });

  const events = eventsQ.data ?? [];
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= now - 86400000).reverse();
  const past = events.filter((e) => new Date(e.starts_at).getTime() < now - 86400000);

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.15em] text-primary flex items-center gap-1">
            <Flag className="w-3 h-3" /> Race control
          </div>
          <h1 className="font-display text-4xl font-bold mt-1 uppercase tracking-tight">Race Weekends</h1>
          <p className="text-sm text-muted-foreground mt-1">Practice, qualifying, sprint and endurance — managed end to end.</p>
        </div>
        <Link to="/calendar" className="text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <CalendarDays className="w-4 h-4" /> Manage calendar
        </Link>
      </div>

      <Section title="Upcoming / current" events={upcoming} counts={sessQ.data} />
      <Section title="Completed" events={past} counts={sessQ.data} muted />

      {events.length === 0 && (
        <div className="mt-6 rounded-sm border border-dashed border-border p-12 text-center">
          <Flag className="w-10 h-10 mx-auto text-muted-foreground" />
          <h2 className="mt-4 font-display text-xl font-bold uppercase tracking-tight">No race weekends yet</h2>
          <p className="text-sm text-muted-foreground mt-1">Create a race or test event from the calendar to start a weekend plan.</p>
          <Link to="/calendar" className="inline-flex items-center gap-1 mt-4 text-sm text-primary hover:underline">
            <CalendarDays className="w-4 h-4" /> Open calendar
          </Link>
        </div>
      )}
    </div>
  );
}

function Section({ title, events, counts, muted }: { title: string; events: Evt[]; counts: Map<string, number> | undefined; muted?: boolean }) {
  if (events.length === 0) return null;
  const now = Date.now();
  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-px flex-1 bg-border" />
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">{title}</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className={`rounded-sm border border-border bg-card divide-y divide-border/60 ${muted ? "opacity-80" : ""}`}>
        {events.map((e) => {
          const startsMs = new Date(e.starts_at).getTime();
          const daysOut = Math.ceil((startsMs - now) / 86400000);
          const tone = STATUS_TONE[e.status] ?? STATUS_TONE.planned;
          const sessions = counts?.get(e.id) ?? 0;
          return (
            <Link key={e.id} to="/weekends/$eventId" params={{ eventId: e.id }}
              className="group flex items-center gap-3 px-3 py-3 hover:bg-muted/20 transition-colors">
              <div className="w-14 text-center shrink-0">
                <div className="font-display text-2xl font-bold text-primary leading-none tabular-nums">
                  {daysOut > 0 ? `${daysOut}` : daysOut === 0 ? "GO" : "—"}
                </div>
                <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground mt-1">
                  {daysOut > 0 ? "days" : daysOut === 0 ? "today" : new Date(e.starts_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-sm bg-primary/20 text-primary">{e.event_type}</span>
                  <span className={`font-mono text-[10px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-sm border ${tone}`}>{e.status}</span>
                </div>
                <div className="font-display text-base font-bold uppercase tracking-tight truncate mt-0.5">{e.title}</div>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-3 flex-wrap mt-0.5">
                  {e.track && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{e.track}</span>}
                  <span>{new Date(e.starts_at).toLocaleDateString([], { dateStyle: "medium" })}{e.ends_at && ` → ${new Date(e.ends_at).toLocaleDateString([], { dateStyle: "medium" })}`}</span>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-4 font-mono tabular-nums text-xs shrink-0">
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground flex items-center justify-end gap-1"><Timer className="w-3 h-3" />Sessions</div>
                  <div className="text-sm font-bold">{sessions}</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}