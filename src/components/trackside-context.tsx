import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { getCurrentWeather } from "@/lib/weather";
import { Flag, Timer, MapPin, CloudSun } from "lucide-react";
import { useActiveWeekend } from "@/lib/active-weekend";

export function TracksideContext() {
  const { user } = useAuth();
  const { activeWeekend, activeTrack, activeSession } = useActiveWeekend();

  const weatherQ = useQuery({
    queryKey: ["trackside-weather", user?.id],
    queryFn: getCurrentWeather,
    enabled: !!user,
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
    retry: 1,
  });

  const event = activeWeekend;
  const session = activeSession;
  const trackName = activeTrack?.name ?? event?.track ?? null;

  const weather = weatherQ.data;
  const weatherValue = weather
    ? `${weather.air_temp_c}°C  ${weather.weather}`
    : "—";
  const weatherSub = weather
    ? `${weather.wind_kph} kph wind`
    : "Tap to log";

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
        value={weatherValue}
        sub={weatherSub}
        to="/track-evolution"
        muted={!weather}
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