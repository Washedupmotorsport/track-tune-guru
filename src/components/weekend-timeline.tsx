import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Flag, Wrench, Disc, MessageSquare, ClipboardCheck, Trophy, Sparkles,
  ChevronRight, GitBranch,
} from "lucide-react";
import { formatLapTime } from "@/lib/lap-time";

type Sess = {
  id: string; name: string; session_type: string;
  started_at: string; driver: string | null; weather: string | null;
  air_temp_c: number | null; track_temp_c: number | null;
};

type Item = {
  id: string;
  ts: number;
  kind: "session" | "setup" | "tyre" | "feedback" | "debrief" | "ai" | "lap";
  title: string;
  body?: string;
  meta?: string;
  sessionId?: string;
  setupId?: string;
  href?: { to: string; params?: Record<string, string> };
  tone?: "primary" | "accent" | "muted";
};

const KIND_STYLE: Record<Item["kind"], { icon: typeof Flag; label: string; dot: string }> = {
  session:  { icon: Flag,           label: "Session",     dot: "bg-primary" },
  setup:    { icon: Wrench,         label: "Setup",       dot: "bg-accent" },
  tyre:     { icon: Disc,           label: "Tyres",       dot: "bg-foreground/70" },
  feedback: { icon: MessageSquare,  label: "Driver",      dot: "bg-foreground/40" },
  debrief:  { icon: ClipboardCheck, label: "Debrief",     dot: "bg-primary/60" },
  ai:       { icon: Sparkles,       label: "AI engineer", dot: "bg-accent/70" },
  lap:      { icon: Trophy,         label: "Best lap",    dot: "bg-primary" },
};

export function WeekendTimeline({
  sessions, carId,
}: { sessions: Sess[]; carId: string | null }) {
  const sessionIds = sessions.map((s) => s.id);
  const enabled = sessionIds.length > 0;

  const changesQ = useQuery({
    queryKey: ["wt-changes", sessionIds.join(",")], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("setup_changes")
        .select("id, session_id, setup_id, summary, area, reason, lap_delta_ms, created_at")
        .in("session_id", sessionIds);
      if (error) throw error; return data ?? [];
    },
  });
  const tyresQ = useQuery({
    queryKey: ["wt-tyres", sessionIds.join(",")], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("tire_logs")
        .select("id, session_id, tire_set, compound, heat_cycles, ambient_c, track_c, recorded_at")
        .in("session_id", sessionIds);
      if (error) throw error; return data ?? [];
    },
  });
  const fbQ = useQuery({
    queryKey: ["wt-fb", sessionIds.join(",")], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("driver_feedback")
        .select("id, session_id, setup_id, category, phase, corner, severity, description, recorded_at")
        .in("session_id", sessionIds);
      if (error) throw error; return data ?? [];
    },
  });
  const debQ = useQuery({
    queryKey: ["wt-deb", sessionIds.join(",")], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("session_debriefs")
        .select("id, session_id, improved, worsened, needs_work, suggested_changes, ai_summary, created_at")
        .in("session_id", sessionIds);
      if (error) throw error; return data ?? [];
    },
  });
  const lapsQ = useQuery({
    queryKey: ["wt-laps", sessionIds.join(",")], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("laps")
        .select("session_id, lap_number, lap_time_ms, recorded_at")
        .in("session_id", sessionIds);
      if (error) throw error; return data ?? [];
    },
  });

  const items: Item[] = [];

  for (const s of sessions) {
    const meta = [
      s.driver, s.weather,
      s.air_temp_c != null ? `${s.air_temp_c}°C air` : null,
      s.track_temp_c != null ? `${s.track_temp_c}°C track` : null,
    ].filter(Boolean).join(" · ");
    items.push({
      id: `s:${s.id}`, ts: new Date(s.started_at).getTime(), kind: "session",
      title: `${s.session_type.toUpperCase()} — ${s.name}`, meta,
      sessionId: s.id, href: { to: "/sessions/$sessionId", params: { sessionId: s.id } },
    });
  }

  for (const c of changesQ.data ?? []) {
    items.push({
      id: `c:${c.id}`, ts: new Date(c.created_at).getTime(), kind: "setup",
      title: c.summary,
      meta: c.area + (c.lap_delta_ms != null ? ` · ${(c.lap_delta_ms / 1000).toFixed(3)}s delta` : ""),
      body: c.reason ?? undefined,
      setupId: c.setup_id, sessionId: c.session_id ?? undefined,
      href: c.setup_id ? { to: "/setups/$setupId", params: { setupId: c.setup_id } } : undefined,
    });
  }

  for (const t of tyresQ.data ?? []) {
    items.push({
      id: `t:${t.id}`, ts: new Date(t.recorded_at).getTime(), kind: "tyre",
      title: `${t.tire_set}${t.compound ? ` · ${t.compound}` : ""}`,
      meta: [
        t.heat_cycles != null ? `${t.heat_cycles} cycles` : null,
        t.ambient_c != null ? `${t.ambient_c}°C air` : null,
        t.track_c != null ? `${t.track_c}°C track` : null,
      ].filter(Boolean).join(" · "),
      sessionId: t.session_id ?? undefined,
      href: { to: "/tires" },
    });
  }

  for (const f of fbQ.data ?? []) {
    items.push({
      id: `f:${f.id}`, ts: new Date(f.recorded_at).getTime(), kind: "feedback",
      title: f.description,
      meta: [f.category, f.phase, f.corner, f.severity].filter(Boolean).join(" · "),
      sessionId: f.session_id ?? undefined, setupId: f.setup_id ?? undefined,
      href: f.session_id ? { to: "/sessions/$sessionId", params: { sessionId: f.session_id } } : undefined,
    });
  }

  for (const d of debQ.data ?? []) {
    const summary = (d.ai_summary as { summary?: string } | null)?.summary;
    const headline = d.improved || d.needs_work || d.worsened || "Debrief recorded";
    items.push({
      id: `d:${d.id}`, ts: new Date(d.created_at).getTime(), kind: "debrief",
      title: headline, body: d.suggested_changes ?? undefined,
      meta: summary ? "AI summary attached" : undefined,
      sessionId: d.session_id ?? undefined,
      href: d.session_id ? { to: "/sessions/$sessionId", params: { sessionId: d.session_id } } : { to: "/debrief" },
    });
    if (summary) {
      items.push({
        id: `a:${d.id}`, ts: new Date(d.created_at).getTime() + 1, kind: "ai",
        title: "AI engineer recommendation", body: summary,
        meta: "based on debrief, lap stats and recent history",
        sessionId: d.session_id ?? undefined,
        href: { to: "/engineer" },
      });
    }
  }

  // Best lap per session as a "lap improvement" marker
  const bestPerSession = new Map<string, { ms: number; n: number | null; ts: number }>();
  for (const l of lapsQ.data ?? []) {
    if (!l.lap_time_ms || !l.session_id) continue;
    const cur = bestPerSession.get(l.session_id);
    if (!cur || l.lap_time_ms < cur.ms) {
      bestPerSession.set(l.session_id, { ms: l.lap_time_ms, n: l.lap_number ?? null, ts: new Date(l.recorded_at).getTime() });
    }
  }
  for (const [sid, b] of bestPerSession) {
    const s = sessions.find((x) => x.id === sid);
    items.push({
      id: `b:${sid}`, ts: b.ts || (s ? new Date(s.started_at).getTime() : 0), kind: "lap",
      title: `Best lap ${formatLapTime(b.ms)}`,
      meta: s ? `${s.session_type.toUpperCase()} · ${s.name}${b.n != null ? ` · L${b.n}` : ""}` : undefined,
      sessionId: sid, href: { to: "/sessions/$sessionId", params: { sessionId: sid } },
    });
  }

  items.sort((a, b) => b.ts - a.ts);

  const loading = changesQ.isLoading || tyresQ.isLoading || fbQ.isLoading || debQ.isLoading || lapsQ.isLoading;
  void carId;

  return (
    <div className="rounded-sm border border-border bg-card">
      <div className="px-3 py-2 border-b border-border/60 bg-muted/20 flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-primary" />
        <span className="font-display text-xs font-bold uppercase tracking-[0.15em]">Weekend timeline</span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{items.length} events</span>
        <Link to="/timeline" className="ml-auto text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground hover:text-primary">
          Full timeline →
        </Link>
      </div>
      {!enabled ? (
        <div className="px-3 py-4 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
          Add a session to start logging the weekend timeline.
        </div>
      ) : loading && items.length === 0 ? (
        <div className="px-3 py-4 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="px-3 py-4 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
          No setup changes, tyre data, feedback or debriefs yet.
        </div>
      ) : (
        <ol className="divide-y divide-border/60">
          {items.slice(0, 40).map((it) => {
            const style = KIND_STYLE[it.kind];
            const Icon = style.icon;
            const time = new Date(it.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const day = new Date(it.ts).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
            const inner = (
              <div className="flex items-start gap-3 px-3 py-2.5">
                <div className="flex flex-col items-center pt-1">
                  <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                </div>
                <div className="shrink-0 w-20 text-right">
                  <div className="font-mono text-[11px] tabular-nums text-foreground">{time}</div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{day}</div>
                </div>
                <Icon className="w-3.5 h-3.5 text-muted-foreground mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-primary">{style.label}</span>
                    {it.meta && <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{it.meta}</span>}
                  </div>
                  <div className="font-display text-sm font-bold tracking-tight truncate">{it.title}</div>
                  {it.body && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{it.body}</div>}
                </div>
                {it.href && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-2" />}
              </div>
            );
            return (
              <li key={it.id} className="hover:bg-muted/20 transition-colors">
                {it.href ? (
                  // @ts-expect-error dynamic href shape
                  <Link to={it.href.to} params={it.href.params}>{inner}</Link>
                ) : inner}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}