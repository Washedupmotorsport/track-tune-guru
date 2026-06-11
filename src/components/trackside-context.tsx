import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Flag, Timer, MapPin, CloudSun } from "lucide-react";

type Event = { id: string; title: string; starts_at: string; ends_at: string | null; track: string | null; track_id: string | null };
type Session = { id: string; name: string; session_type: string; started_at: string; track: string | null; track_id: string | null };
type Track = { id: string; name: string };

export function TracksideContext() {
  const { user } = useAuth();

  const eventQ = useQuery({
    queryKey: ["trackside-event", user?.id],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      // Prefer an event currently in progress
      const cur = await supabase
        .from("calendar_events")
        .select("id, title, starts_at, ends_at, track, track_id")
        .lte("starts_at", nowIso)
        .or(`ends_at.gte.${nowIso},ends_at.is.null`)
        .order("starts_at", { ascending: false })
        .limit(1);
      if (cur.data && cur.data.length) return cur.data[0] as Event;
      // Else: next upcoming
      const next = await supabase
        .from("calendar_events")
        .select("id, title, starts_at, ends_at, track, track_id")
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(1);
      return (next.data?.[0] as Event) ?? null;
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const sessionQ = useQuery({
    queryKey: ["trackside-session", user?.id],
    queryFn: async () => {
      const since = new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString();
      const { data } = await supabase
        .from("sessions")
        .select("id, name, session_type, started_at, track, track_id")
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(1);
      return (data?.[0] as Session) ?? null;
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const trackId = sessionQ.data?.track_id ?? eventQ.data?.track_id ?? null;
  const trackQ = useQuery({
    queryKey: ["trackside-track", trackId],
    queryFn: async () => {
      if (!trackId) return null;
      const { data } = await supabase.from("tracks").select("id, name").eq("id", trackId).maybeSingle();
      return (data as Track) ?? null;
    },
    enabled: !!user && !!trackId,
  });

  const event = eventQ.data;
  const session = sessionQ.data;
  const trackName =
    trackQ.data?.name ?? session?.track ?? event?.track ?? null;

  return (
    <div className="hidden md:flex items-stretch gap-0 rounded-md border border-border bg-card/40 overflow-hidden">
      <ContextCell
        icon={Flag}
        label="Weekend"
        value={event?.title ?? "No event"}
        sub={event ? formatWindow(event.starts_at, event.ends_at) : "Plan one →"}
        to="/weekends"
        muted={!event}
      />
      <Divider />
      <ContextCell
        icon={Timer}
        label="Session"
        value={session?.name ?? "Idle"}
        sub={session ? session.session_type.toUpperCase() : "No active session"}
        to="/sessions"
        muted={!session}
      />
      <Divider />
      <ContextCell
        icon={MapPin}
        label="Track"
        value={trackName ?? "Unassigned"}
        sub={trackName ? "Profile" : "Pick from database"}
        to="/tracks"
        muted={!trackName}
      />
      <Divider />
      <ContextCell
        icon={CloudSun}
        label="Weather"
        value="—"
        sub="Tap to log"
        to="/track-evolution"
        muted
      />
    </div>
  );
}

function ContextCell({
  icon: Icon, label, value, sub, to, muted,
}: {
  icon: typeof Flag; label: string; value: string; sub: string; to: string; muted?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-2 px-3 py-1.5 hover:bg-primary/5 transition-colors min-w-0"
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 ${muted ? "text-muted-foreground" : "text-primary"}`} />
      <div className="min-w-0 leading-tight">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className={`font-display text-xs font-bold tracking-tight truncate max-w-[140px] ${muted ? "text-muted-foreground" : "text-foreground group-hover:text-primary"}`}>
          {value}
        </div>
      </div>
      <span className="hidden xl:block font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70 truncate max-w-[120px]">{sub}</span>
    </Link>
  );
}

function Divider() {
  return <span aria-hidden className="w-px self-stretch bg-border/70" />;
}

function formatWindow(start: string, end: string | null) {
  const s = new Date(start);
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  const sStr = s.toLocaleDateString(undefined, opts);
  if (!end) return sStr;
  const e = new Date(end);
  const eStr = e.toLocaleDateString(undefined, opts);
  return sStr === eStr ? sStr : `${sStr} – ${eStr}`;
}