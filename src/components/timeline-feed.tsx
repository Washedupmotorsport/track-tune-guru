import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Activity, Flag, Wrench, Disc, MessageSquare, NotebookPen, Sparkles,
  ClipboardCheck, TrendingDown, PlayCircle, CheckCircle2, Gauge,
} from "lucide-react";

export type TimelineEvt = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  occurred_at: string;
  event_id: string | null;
  session_id: string | null;
  setup_id: string | null;
  setup_change_id: string | null;
  tire_stint_id: string | null;
  tire_log_id: string | null;
  feedback_id: string | null;
  debrief_id: string | null;
  memory_id: string | null;
  lap_id: string | null;
  metadata: Record<string, unknown> | null;
};

const META: Record<string, { icon: typeof Flag; tone: string; label: string }> = {
  session_started:        { icon: PlayCircle,      tone: "text-chart-2",     label: "Session started" },
  session_completed:      { icon: CheckCircle2,    tone: "text-primary",     label: "Session completed" },
  setup_changed:          { icon: Wrench,          tone: "text-accent",      label: "Setup changed" },
  tyre_pressure_changed:  { icon: Gauge,           tone: "text-chart-3",     label: "Tyre pressures" },
  tyre_set_changed:       { icon: Disc,            tone: "text-chart-3",     label: "Tyre set changed" },
  driver_comment:         { icon: MessageSquare,   tone: "text-chart-2",     label: "Driver comment" },
  ai_recommendation:      { icon: Sparkles,        tone: "text-primary",     label: "AI recommendation" },
  debrief_completed:      { icon: ClipboardCheck,  tone: "text-primary",     label: "Debrief" },
  lap_improved:           { icon: TrendingDown,    tone: "text-primary",     label: "Lap improved" },
  memory_created:         { icon: NotebookPen,     tone: "text-accent",      label: "Notebook" },
};

function backLinks(e: TimelineEvt) {
  const links: { to: string; params?: Record<string, string>; label: string }[] = [];
  if (e.event_id) links.push({ to: "/weekends/$eventId", params: { eventId: e.event_id }, label: "weekend" });
  if (e.session_id) links.push({ to: "/sessions/$sessionId", params: { sessionId: e.session_id }, label: "session" });
  if (e.setup_id) links.push({ to: "/setups/$setupId", params: { setupId: e.setup_id }, label: "setup" });
  if (e.setup_change_id) links.push({ to: "/iteration", label: "setup change" });
  if (e.debrief_id) links.push({ to: "/post-debrief", label: "debrief" });
  if (e.memory_id) links.push({ to: "/engineering-memory", label: "notebook" });
  if (e.tire_stint_id || e.tire_log_id) links.push({ to: "/tyres", label: "tyres" });
  return links;
}

export function TimelineFeed({
  eventId,
  limit = 50,
  title = "Activity timeline",
  emptyHint,
}: {
  eventId?: string | null;
  limit?: number;
  title?: string;
  emptyHint?: string;
}) {
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["timeline_events", user?.id, eventId ?? "all", limit],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      let qb = supabase
        .from("timeline_events" as never)
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (eventId) qb = qb.eq("event_id", eventId);
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as unknown as TimelineEvt[];
    },
  });

  const items = q.data ?? [];

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
        <Activity className="w-4 h-4 text-primary" />
        <h3 className="font-display text-sm font-bold">{title}</h3>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {items.length} {items.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
        {q.isLoading && (
          <div className="p-4 text-xs text-muted-foreground">Loading timeline…</div>
        )}
        {!q.isLoading && items.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {emptyHint ?? "Nothing logged yet — actions across the app will appear here automatically."}
          </div>
        )}
        {items.map((e) => {
          const meta = META[e.type] ?? { icon: Flag, tone: "text-muted-foreground", label: e.type };
          const Icon = meta.icon;
          const links = backLinks(e);
          return (
            <div key={e.id} className="p-3 flex gap-3">
              <div className={`shrink-0 mt-0.5 ${meta.tone}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {meta.label}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground/80 tabular-nums">
                    {new Date(e.occurred_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </div>
                <div className="text-sm font-medium leading-snug mt-0.5">{e.title}</div>
                {e.description && (
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{e.description}</div>
                )}
                {links.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {links.map((l, i) => (
                      <Link
                        key={i}
                        to={l.to as never}
                        params={l.params as never}
                        className="inline-flex items-center px-1.5 h-5 rounded border border-border bg-background/40 hover:border-primary/50 font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:text-primary"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper for app code to record one-off timeline entries (e.g. AI recommendations
// that don't already trigger a DB write).
export async function recordTimelineEvent(input: {
  user_id: string;
  type: string;
  title: string;
  description?: string | null;
  event_id?: string | null;
  session_id?: string | null;
  setup_id?: string | null;
  debrief_id?: string | null;
  memory_id?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("timeline_events" as never).insert(input as never);
  if (error) throw error;
}