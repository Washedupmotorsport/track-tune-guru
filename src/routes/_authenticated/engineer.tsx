import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { GitBranch, Disc, ArrowRight, Brain, MessageSquare, TriangleAlert as AlertTriangle, HardHat, CircleCheck as CheckCircle2, CircleDot, Circle as XCircle, Pin, Radio, Cloud, Fuel, Timer, Wrench, Wand as Wand2, CalendarDays, TrendingUp, TrendingDown, Minus, Activity, Flag, Plus, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_authenticated/engineer")({
  head: () => ({
    meta: [
      { title: "Cockpit — My Race Engineer" },
      { name: "description", content: "Race engineer cockpit: session, setup, verdicts, tyres, confidence, memory and concerns on one screen." },
    ],
  }),
  component: EngineerCockpit,
});

// ---------- types ----------
type ChangeRow = {
  id: string; summary: string; reason: string | null; expected_effect: string | null;
  outcome_status: string; created_at: string; setup_id: string; area: string;
};
type FeedbackRow = {
  id: string; description: string; severity: string; corner: string | null;
  category: string; recorded_at: string;
};
type MemoryRow = {
  id: string; title: string; detail: string | null; category: string;
  occurrences: number; confidence: number; pinned: boolean; last_observed_at: string;
  priority: string;
};
type TyreRow = {
  id: string; tire_set: string; compound: string | null;
  hot_fl: number | null; hot_fr: number | null; hot_rl: number | null; hot_rr: number | null;
  recorded_at: string;
};
type SessionRow = {
  id: string; name: string; track: string | null; weather: string | null;
  air_temp_c: number | null; track_temp_c: number | null; started_at: string;
  session_type: string; setup_id: string | null;
  fuel_start_l: number | null; fuel_end_l: number | null;
};
type ConfRow = { overall: number | null; recorded_at: string };
type SetupRow = { id: string; name: string; track: string | null; is_baseline: boolean; updated_at: string };
type EventRow = { id: string; title: string; track: string | null; starts_at: string; event_type: string };
type DamageRow = { id: string; component: string; severity: string; status: string; occurred_at: string };

// ---------- cockpit ----------
function EngineerCockpit() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // live clock for countdown
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const sessionQ = useQuery({
    queryKey: ["cockpit-session", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, name, track, weather, air_temp_c, track_temp_c, started_at, session_type, setup_id, fuel_start_l, fuel_end_l")
        .order("started_at", { ascending: false }).limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as SessionRow | null;
    },
  });

  const nextEventQ = useQuery({
    queryKey: ["cockpit-next-event", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("id, title, track, starts_at, event_type")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true }).limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as EventRow | null;
    },
  });

  const activeSetupQ = useQuery({
    queryKey: ["cockpit-active-setup", sessionQ.data?.setup_id], enabled: !!user,
    queryFn: async () => {
      const setupId = sessionQ.data?.setup_id;
      if (setupId) {
        const { data, error } = await supabase
          .from("setups").select("id, name, track, is_baseline, updated_at").eq("id", setupId).maybeSingle();
        if (error) throw error;
        if (data) return data as SetupRow;
      }
      // fall back to most recently updated setup
      const { data, error } = await supabase
        .from("setups").select("id, name, track, is_baseline, updated_at")
        .order("updated_at", { ascending: false }).limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as SetupRow | null;
    },
  });

  const changesQ = useQuery({
    queryKey: ["cockpit-changes", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setup_changes")
        .select("id, summary, reason, expected_effect, outcome_status, created_at, setup_id, area")
        .order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as ChangeRow[];
    },
  });

  const inboxQ = useQuery({
    queryKey: ["cockpit-inbox", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_feedback")
        .select("id, description, severity, corner, category, recorded_at")
        .order("recorded_at", { ascending: false }).limit(6);
      if (error) throw error;
      return (data ?? []) as FeedbackRow[];
    },
  });

  const memoryQ = useQuery({
    queryKey: ["cockpit-memory", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineering_memory")
        .select("id, title, detail, category, occurrences, confidence, pinned, last_observed_at, priority")
        .eq("status", "active")
        .order("pinned", { ascending: false }).order("last_observed_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (data ?? []) as MemoryRow[];
    },
  });

  const prioritiesQ = useQuery({
    queryKey: ["cockpit-priorities", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineering_memory")
        .select("id, title, detail, category, occurrences, confidence, pinned, last_observed_at, priority, status")
        .in("priority", ["critical", "testing", "monitor", "resolved"])
        .order("last_observed_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as (MemoryRow & { status: string })[];
    },
  });

  const priorityM = useMutation({
    mutationFn: async (vars: { id: string; priority: "critical" | "testing" | "monitor" | "resolved" }) => {
      const { error } = await supabase.from("engineering_memory").update({ priority: vars.priority }).eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Marked ${vars.priority}`);
      qc.invalidateQueries({ queryKey: ["cockpit-priorities"] });
      qc.invalidateQueries({ queryKey: ["cockpit-memory"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deletePriorityM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("engineering_memory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["cockpit-priorities"] });
      qc.invalidateQueries({ queryKey: ["cockpit-memory"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const tyresQ = useQuery({
    queryKey: ["cockpit-tyres", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tire_logs")
        .select("id, tire_set, compound, hot_fl, hot_fr, hot_rl, hot_rr, recorded_at")
        .order("recorded_at", { ascending: false }).limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as TyreRow | null;
    },
  });

  const confQ = useQuery({
    queryKey: ["cockpit-conf", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_confidence")
        .select("overall, recorded_at")
        .order("recorded_at", { ascending: false }).limit(8);
      if (error) throw error;
      return ((data ?? []) as ConfRow[]).reverse();
    },
  });

  const damageQ = useQuery({
    queryKey: ["cockpit-damage", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damage_reports")
        .select("id, component, severity, status, occurred_at")
        .neq("status", "resolved")
        .order("occurred_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (data ?? []) as DamageRow[];
    },
  });

  const verdictM = useMutation({
    mutationFn: async (vars: { id: string; status: "testing" | "successful" | "rejected" }) => {
      const now = new Date().toISOString();
      const { error } = await supabase.from("setup_changes")
        .update({
          outcome_status: vars.status,
          measured_at: now,
          ...(vars.status === "testing" ? { testing_started_at: now } : {}),
        })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Marked ${vars.status}`);
      qc.invalidateQueries({ queryKey: ["cockpit-changes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // derived
  const pendingChanges = useMemo(
    () => (changesQ.data ?? []).filter((r) => r.outcome_status === "proposed" || r.outcome_status === "testing"),
    [changesQ.data],
  );
  const tyreFlags = useMemo(() => {
    const t = tyresQ.data;
    if (!t) return [] as { corner: string; psi: number; reason: "under" | "over" }[];
    const out: { corner: string; psi: number; reason: "under" | "over" }[] = [];
    const check = (corner: string, v: number | null) => {
      if (v == null) return;
      if (v < 25) out.push({ corner, psi: v, reason: "under" });
      else if (v > 33) out.push({ corner, psi: v, reason: "over" });
    };
    check("FL", t.hot_fl); check("FR", t.hot_fr); check("RL", t.hot_rl); check("RR", t.hot_rr);
    return out;
  }, [tyresQ.data]);

  const confValues = (confQ.data ?? []).map((c) => c.overall).filter((v): v is number => v != null);
  const lastConf = confValues.length ? confValues[confValues.length - 1] : null;
  const prevConf = confValues.length > 1 ? confValues[confValues.length - 2] : null;
  const confDelta = lastConf != null && prevConf != null ? lastConf - prevConf : null;

  const criticalFlags = (inboxQ.data ?? []).filter((f) => f.severity === "critical").length;
  const priorities = prioritiesQ.data ?? [];
  const sortedPriorities = useMemo(() => {
    const order: Record<string, number> = { critical: 0, testing: 1, monitor: 2, resolved: 3 };
    return [...priorities].sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));
  }, [priorities]);
  const criticalIssues = priorities.filter((p) => p.priority === "critical").length;
  const testingIssues = priorities.filter((p) => p.priority === "testing").length;
  const session = sessionQ.data;
  const setup = activeSetupQ.data;
  const nextEvent = nextEventQ.data;
  const openDamage = damageQ.data ?? [];
  const criticalDamage = openDamage.filter((d) => d.severity === "critical" || d.severity === "major").length;

  const fuelUsed = session && session.fuel_start_l != null && session.fuel_end_l != null
    ? Math.max(0, session.fuel_start_l - session.fuel_end_l) : null;

  const isMobile = useIsMobile();
  const [detailsOpen, setDetailsOpen] = useState<boolean | null>(null);
  const showDetails = detailsOpen ?? !isMobile;

  return (
    <div className="space-y-4 pb-16">
      {/* ENGINEERING PRIORITIES — top of screen, race-weekend triage ===== */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${criticalIssues > 0 ? "bg-destructive/10 border-destructive/40" : testingIssues > 0 ? "bg-accent/10 border-accent/40" : "bg-muted/30 border-border"}`}>
          <AlertTriangle className="w-4 h-4 text-primary" />
          <h2 className="font-display text-sm font-bold">Engineering priorities</h2>
          <span className="text-xs text-muted-foreground">· {sortedPriorities.length}</span>
          <Link to="/engineering-memory" className="ml-auto text-xs font-medium text-muted-foreground hover:text-primary">
            Manage →
          </Link>
        </div>
        {prioritiesQ.isLoading && <PanelEmpty>Loading…</PanelEmpty>}
        {!prioritiesQ.isLoading && sortedPriorities.length === 0 && (
          <PanelEmpty>No active priorities. Flag a recurring issue from the memory page.</PanelEmpty>
        )}
        {sortedPriorities.length > 0 && (
          <ul className="divide-y divide-border">
            {sortedPriorities.map((m) => (
              <PriorityRow
                key={m.id}
                item={m}
                onCycle={(id, next) => priorityM.mutate({ id, priority: next })}
                onDelete={(id) => deletePriorityM.mutate(id)}
                disabled={priorityM.isPending || deletePriorityM.isPending}
              />
            ))}
          </ul>
        )}
      </section>

      {/* HEADER BAR ====================================================== */}
      <header className="rounded-xl border border-border bg-card">
        <div className="flex items-stretch divide-x divide-border text-sm">
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-semibold text-primary tracking-wide">Cockpit</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-3 min-w-0">
            <Radio className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Last run</span>
            {session ? (
              <Link to="/sessions/$sessionId" params={{ sessionId: session.id }} className="truncate font-semibold hover:text-primary">
                {session.name}{session.track ? ` · ${session.track}` : ""}
              </Link>
            ) : (
              <span className="text-muted-foreground">no sessions</span>
            )}
            {session && (
              <span className="text-muted-foreground hidden md:inline">· {session.session_type} · {timeAgo(session.started_at, now)}</span>
            )}
          </div>
          <div className="hidden md:flex items-center gap-4 px-4 py-3 text-sm text-muted-foreground">
            {session?.weather && <span className="inline-flex items-center gap-1.5"><Cloud className="w-4 h-4" />{session.weather}</span>}
            {session?.air_temp_c != null && <span>air {session.air_temp_c}°</span>}
            {session?.track_temp_c != null && <span>track {session.track_temp_c}°</span>}
          </div>
          <div className="ml-auto flex items-center gap-2 px-4 py-3">
            <Link to="/driver" className="text-xs font-medium text-muted-foreground hover:text-primary border border-border rounded-md px-3 py-1.5">
              Driver →
            </Link>
            <Link to="/pitwall" className="text-xs font-medium text-primary hover:underline border border-primary/40 bg-primary/10 rounded-md px-3 py-1.5">
              Pit wall
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border border-t border-border">
          <CtxCell icon={Wand2} label="Active setup"
            value={setup ? setup.name : "—"}
            sub={setup ? (setup.is_baseline ? "baseline" : "iteration") + (setup.track ? ` · ${setup.track}` : "") : "no setup logged"}
            link={setup ? { to: "/setups/$setupId", params: { setupId: setup.id } } : undefined} />
          <CtxCell icon={CalendarDays} label="Next session"
            value={nextEvent ? countdown(nextEvent.starts_at, now) : "—"}
            sub={nextEvent ? `${nextEvent.title}${nextEvent.track ? ` · ${nextEvent.track}` : ""}` : "no event scheduled"}
            link={nextEvent ? { to: "/weekends/$eventId", params: { eventId: nextEvent.id } } : { to: "/calendar" }} />
          <CtxCell icon={Fuel} label="Fuel last run"
            value={fuelUsed != null ? `${fuelUsed.toFixed(1)} L` : "—"}
            sub={session?.fuel_start_l != null && session?.fuel_end_l != null
              ? `${session.fuel_start_l.toFixed(1)} → ${session.fuel_end_l.toFixed(1)} L`
              : "not logged"} />
          <CtxCell icon={Activity} label="Confidence"
            value={lastConf != null ? `${lastConf}/10` : "—"}
            sub={confDelta != null ? trendLabel(confDelta) + " vs prior" : "score after next run"}
            tone={confDelta != null && confDelta <= -2 ? "alert" : confDelta != null && confDelta < 0 ? "warn" : undefined} />
        </div>
      </header>

      {/* KPI STRIP ====================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Kpi icon={AlertTriangle} label="Critical issues" value={criticalIssues} tone={criticalIssues > 0 ? "alert" : undefined} />
        <Kpi icon={CircleDot} label="In testing" value={testingIssues} tone={testingIssues > 0 ? "warn" : undefined} />
        <Kpi icon={GitBranch} label="Pending verdicts" value={pendingChanges.length} tone={pendingChanges.length > 0 ? "warn" : undefined} />
        <Kpi icon={MessageSquare} label="Critical flags" value={criticalFlags} tone={criticalFlags > 0 ? "alert" : undefined} />
        <Kpi icon={Disc} label="Tyre flags" value={tyreFlags.length} tone={tyreFlags.length > 0 ? "warn" : undefined} />
        <Kpi icon={Wrench} label="Open concerns" value={openDamage.length} tone={criticalDamage > 0 ? "alert" : openDamage.length > 0 ? "warn" : undefined} />
      </div>

      {/* COCKPIT GRID =================================================== */}
      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !(v ?? !isMobile))}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary md:hidden"
      >
        <ChevronRight className={`w-4 h-4 transition-transform ${showDetails ? "rotate-90" : ""}`} />
        Details
      </button>
      {showDetails && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* COL A — verdicts + driver inbox */}
        <section className="space-y-4">
          <Panel icon={GitBranch} title="Open verdicts" count={pendingChanges.length}
                 action={{ to: "/iteration", label: "Log change" }}>
            {changesQ.isLoading && <PanelEmpty>Loading…</PanelEmpty>}
            {!changesQ.isLoading && pendingChanges.length === 0 && (
              <PanelEmpty>Every change has a verdict.</PanelEmpty>
            )}
            <ul className="divide-y divide-border">
              {pendingChanges.slice(0, 6).map((r) => (
                <li key={r.id} className="p-4">
                  <div className="flex items-center gap-2">
                    <Chip>{r.area}</Chip>
                    <Link to="/setups/$setupId" params={{ setupId: r.setup_id }}
                      className="text-sm font-medium truncate hover:text-primary flex-1 min-w-0">
                      {r.summary}
                    </Link>
                    <span className="text-xs text-muted-foreground shrink-0">{shortDate(r.created_at)}</span>
                  </div>
                  {(r.expected_effect || r.reason) && (
                    <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {r.expected_effect ? <span className="text-foreground/80">Expect: </span> : null}
                      {r.expected_effect ?? r.reason}
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center gap-1.5">
                    {r.outcome_status === "proposed" && (
                      <Verdict onClick={() => verdictM.mutate({ id: r.id, status: "testing" })} tone="warn" icon={CircleDot} label="Start test" disabled={verdictM.isPending} />
                    )}
                    <Verdict onClick={() => verdictM.mutate({ id: r.id, status: "successful" })} tone="ok"  icon={CheckCircle2} label="Successful" disabled={verdictM.isPending} />
                    <Verdict onClick={() => verdictM.mutate({ id: r.id, status: "rejected"   })} tone="bad" icon={XCircle}       label="Reject"     disabled={verdictM.isPending} />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel icon={MessageSquare} title="Driver inbox" count={(inboxQ.data ?? []).length}
                 action={{ to: "/debrief", label: "Debrief" }}>
            {inboxQ.isLoading && <PanelEmpty>Loading…</PanelEmpty>}
            {!inboxQ.isLoading && (inboxQ.data ?? []).length === 0 && <PanelEmpty>No driver feedback yet.</PanelEmpty>}
            <ul className="divide-y divide-border">
              {(inboxQ.data ?? []).map((f) => (
                <li key={f.id} className="p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 h-5 rounded border text-xs font-medium ${severityTone(f.severity)}`}>
                      {f.severity}
                    </span>
                    {f.corner && <span className="text-xs text-muted-foreground">{f.corner}</span>}
                    <span className="text-xs text-muted-foreground">· {f.category}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{shortDate(f.recorded_at)}</span>
                  </div>
                  <p className="text-sm mt-1.5 leading-relaxed">{f.description}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        {/* COL B — tyres + confidence trend */}
        <section className="space-y-4">
          <Panel icon={Disc} title="Tyre status" count={tyreFlags.length}
                 action={{ to: "/tyre-setup", label: "Pressures" }}
                 tone={tyreFlags.length > 0 ? "warn" : undefined}>
            {!tyresQ.data && <PanelEmpty>No tyre log yet.</PanelEmpty>}
            {tyresQ.data && (
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">{tyresQ.data.tire_set}</span>
                  {tyresQ.data.compound && <span>· {tyresQ.data.compound}</span>}
                  <span className="ml-auto">{shortDate(tyresQ.data.recorded_at)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TyreCell corner="FL" psi={tyresQ.data.hot_fl} />
                  <TyreCell corner="FR" psi={tyresQ.data.hot_fr} />
                  <TyreCell corner="RL" psi={tyresQ.data.hot_rl} />
                  <TyreCell corner="RR" psi={tyresQ.data.hot_rr} />
                </div>
                {tyreFlags.length > 0 && (
                  <ul className="text-xs space-y-1.5 pt-2 border-t border-border">
                    {tyreFlags.map((f) => (
                      <li key={f.corner} className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-accent" />
                        <span className="font-medium">{f.corner} {f.psi.toFixed(1)} psi</span>
                        <span className="text-muted-foreground">· {f.reason === "under" ? "under-pressure (<25)" : "over-pressure (>33)"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Panel>

          <Panel icon={Activity} title="Confidence trend" count={confValues.length}
                 action={{ to: "/confidence", label: "Open" }}
                 tone={confDelta != null && confDelta < 0 ? "warn" : undefined}>
            {confValues.length === 0 && <PanelEmpty>Score confidence after the next run.</PanelEmpty>}
            {confValues.length > 0 && (
              <div className="p-4">
                <div className="flex items-end gap-1.5 h-20">
                  {confValues.map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col justify-end items-center" title={`${v}/10`}>
                      <div className="w-full bg-primary/70 rounded-t-sm" style={{ height: `${(v / 10) * 100}%` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Last {confValues.length} runs</span>
                  <span className="inline-flex items-center gap-1 font-medium">
                    {confDelta == null ? null : confDelta > 0
                      ? <><TrendingUp className="w-3.5 h-3.5 text-primary" /> +{confDelta}</>
                      : confDelta < 0
                        ? <><TrendingDown className="w-3.5 h-3.5 text-destructive" /> {confDelta}</>
                        : <><Minus className="w-3.5 h-3.5" /> flat</>}
                  </span>
                </div>
              </div>
            )}
          </Panel>
        </section>

        {/* COL C — recurring trends + concerns */}
        <section className="space-y-4">
          <Panel icon={Brain} title="Recurring trends" count={(memoryQ.data ?? []).length}
                 action={{ to: "/engineering-memory", label: "All memory" }}>
            {(memoryQ.data ?? []).length === 0 && <PanelEmpty>Pin recurring traits as you see them.</PanelEmpty>}
            <ul className="divide-y divide-border">
              {(memoryQ.data ?? []).map((m) => (
                <li key={m.id} className="p-4 flex items-start gap-3">
                  {m.pinned
                    ? <Pin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    : <span className="w-4 h-4 inline-block mt-0.5 shrink-0" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{m.title}</span>
                      <Chip>{m.category}</Chip>
                      <span className="text-xs text-muted-foreground">×{m.occurrences}</span>
                    </div>
                    {m.detail && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{m.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel icon={Wrench} title="Open concerns" count={openDamage.length}
                 action={{ to: "/damage", label: "Damage log" }}
                 tone={criticalDamage > 0 ? "alert" : undefined}>
            {openDamage.length === 0 && <PanelEmpty>No open damage or maintenance flags.</PanelEmpty>}
            <ul className="divide-y divide-border">
              {openDamage.map((d) => (
                <li key={d.id} className="p-4 flex items-center gap-3">
                  <span className={`inline-flex items-center px-2 h-5 rounded border text-xs font-medium ${severityTone(d.severity)}`}>
                    {d.severity}
                  </span>
                  <span className="text-sm font-medium truncate flex-1">{d.component}</span>
                  <span className="text-xs text-muted-foreground">{d.status}</span>
                  <span className="text-xs text-muted-foreground">{shortDate(d.occurred_at)}</span>
                </li>
              ))}
            </ul>
          </Panel>

          {(criticalFlags > 0 || criticalDamage > 0 || (confDelta != null && confDelta <= -2)) && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="text-sm font-bold">Attention required</span>
              </div>
              <ul className="mt-2 text-sm text-muted-foreground space-y-1 list-disc pl-5">
                {criticalFlags > 0 && <li>{criticalFlags} critical driver flag{criticalFlags > 1 ? "s" : ""}</li>}
                {criticalDamage > 0 && <li>{criticalDamage} major/critical damage report{criticalDamage > 1 ? "s" : ""} open</li>}
                {confDelta != null && confDelta <= -2 && <li>Confidence down {Math.abs(confDelta)} pt vs prior</li>}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/post-debrief" className="border border-border rounded-md px-3 py-1.5 inline-flex items-center text-xs font-medium hover:border-primary hover:text-primary">Open debrief</Link>
                <Link to="/iteration"   className="border border-border rounded-md px-3 py-1.5 inline-flex items-center text-xs font-medium hover:border-primary hover:text-primary">Plan change</Link>
              </div>
            </div>
          )}
        </section>
      </div>
      )}

      {/* SUPPORTING TOOLS (thin) */}
      <div className="pt-4 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="text-foreground/70 inline-flex items-center gap-1.5 font-medium"><HardHat className="w-3.5 h-3.5" /> Tools</span>
        <Link to="/setup-library" className="hover:text-primary">Setup library</Link>
        <Link to="/iteration"     className="hover:text-primary">Iteration log</Link>
        <Link to="/corners"       className="hover:text-primary">Corner balance</Link>
        <Link to="/analysis"      className="hover:text-primary">Session compare</Link>
        <Link to="/tyre-compare"  className="hover:text-primary">Tyre compare</Link>
        <Link to="/tyre-wear"     className="hover:text-primary">Tyre wear</Link>
        <Link to="/sessions"      className="hover:text-primary">Sessions</Link>
        <Link to="/weekends"      className="hover:text-primary">Weekends</Link>
        <Link to="/flags"         className="hover:text-primary"><Flag className="w-3.5 h-3.5 inline -mt-0.5 mr-0.5" />Incidents</Link>
        <span className="ml-auto inline-flex items-center gap-1.5"><Timer className="w-3.5 h-3.5" />{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>

      {/* STICKY BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur-md md:bottom-[90px]" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="mx-auto max-w-[1400px] px-4 h-12 flex items-center gap-2">
          <Link
            to="/engineering-memory"
            className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.98] transition"
          >
            <Plus className="w-4 h-4" /> Priority
          </Link>
          <Link
            to="/pitwall"
            className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card text-foreground text-sm font-semibold hover:bg-muted/30 active:scale-[0.98] transition"
          >
            <Radio className="w-4 h-4" /> Open Pitwall
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------- bits ----------
function Kpi({ icon: Icon, label, value, tone }: {
  icon: ComponentType<{ className?: string }>; label: string; value: number; tone?: "warn" | "alert";
}) {
  const cls = tone === "alert" ? "border-destructive/40 bg-destructive/5"
            : tone === "warn"  ? "border-accent/40 bg-accent/5"
            : "border-border bg-card";
  return (
    <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${cls}`}>
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground leading-none mb-1">{label}</div>
        <div className="font-display text-2xl font-bold leading-none">{value}</div>
      </div>
    </div>
  );
}

function CtxCell({ icon: Icon, label, value, sub, tone, link }: {
  icon: ComponentType<{ className?: string }>; label: string; value: string; sub?: string;
  tone?: "warn" | "alert";
  link?: { to: string; params?: Record<string, string> };
}) {
  const cls = tone === "alert" ? "bg-destructive/5"
            : tone === "warn"  ? "bg-accent/5"
            : "";
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /> {label}
        {link && <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-50" />}
      </div>
      <div className="font-display text-lg font-bold leading-tight mt-1 truncate">{value}</div>
      {sub && <div className="text-xs text-muted-foreground truncate mt-0.5">{sub}</div>}
    </>
  );
  const wrapCls = `block px-4 py-3 ${cls} ${link ? "hover:bg-muted/30" : ""}`;
  if (!link) return <div className={wrapCls}>{body}</div>;
  return (
    <Link to={link.to as string} params={link.params as never} className={wrapCls}>
      {body}
    </Link>
  );
}

function Panel({ icon: Icon, title, count, action, tone, children }: {
  icon: ComponentType<{ className?: string }>; title: string; count?: number;
  action?: { to: string; label: string }; tone?: "warn" | "alert"; children: React.ReactNode;
}) {
  const head = tone === "alert" ? "bg-destructive/10 border-destructive/40"
             : tone === "warn"  ? "bg-accent/10 border-accent/40"
             : "bg-muted/30 border-border";
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${head}`}>
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="font-display text-sm font-bold">{title}</h2>
        {count != null && <span className="text-xs text-muted-foreground">· {count}</span>}
        {action && (
          <Link to={action.to} className="ml-auto text-xs font-medium text-muted-foreground hover:text-primary">
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-6 text-center text-sm text-muted-foreground">{children}</div>;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 h-5 rounded-md border border-border bg-muted/30 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

function TyreCell({ corner, psi }: { corner: string; psi: number | null }) {
  const flagged = psi != null && (psi < 25 || psi > 33);
  const cls = flagged ? "border-accent/50 bg-accent/10 text-accent"
                      : psi == null ? "border-border bg-muted/20 text-muted-foreground"
                                    : "border-border bg-background";
  return (
    <div className={`rounded-lg border px-3 py-2.5 flex items-center justify-between ${cls}`}>
      <span className="text-xs font-medium opacity-70">{corner}</span>
      <span className="font-display text-base font-bold">{psi != null ? `${psi.toFixed(1)}` : "—"}<span className="text-xs opacity-60 ml-1">psi</span></span>
    </div>
  );
}

function Verdict({ onClick, icon: Icon, label, tone, disabled }: {
  onClick: () => void; icon: ComponentType<{ className?: string }>;
  label: string; tone: "ok" | "warn" | "bad"; disabled?: boolean;
}) {
  const cls = tone === "ok"   ? "border-primary/40 text-primary hover:bg-primary/10"
            : tone === "warn" ? "border-accent/50 text-accent hover:bg-accent/10"
            : "border-destructive/50 text-destructive hover:bg-destructive/10";
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md border text-xs font-medium disabled:opacity-50 ${cls}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function severityTone(s: string) {
  if (s === "critical") return "border-destructive/50 bg-destructive/15 text-destructive";
  if (s === "warning" || s === "major") return "border-accent/50 bg-accent/15 text-accent";
  return "border-border bg-muted/30 text-muted-foreground";
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function timeAgo(iso: string, now: Date) {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function countdown(iso: string, now: Date) {
  const diff = (new Date(iso).getTime() - now.getTime()) / 1000;
  if (diff <= 0) return "live";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function trendLabel(delta: number) {
  if (delta > 0) return `▲ +${delta}`;
  if (delta < 0) return `▼ ${delta}`;
  return "→ flat";
}

const PRIORITY_ORDER: Array<"critical" | "testing" | "monitor" | "resolved"> = ["critical", "testing", "monitor", "resolved"];

function nextPriority(current: string): "critical" | "testing" | "monitor" | "resolved" {
  const idx = PRIORITY_ORDER.indexOf(current as typeof PRIORITY_ORDER[number]);
  return PRIORITY_ORDER[(idx + 1) % PRIORITY_ORDER.length];
}

function priorityPillClass(p: string) {
  if (p === "critical") return "bg-destructive text-destructive-foreground";
  if (p === "testing") return "bg-amber-500 text-white";
  if (p === "monitor") return "bg-blue-500 text-white";
  return "bg-emerald-500 text-white";
}

function PriorityRow({ item, onCycle, onDelete, disabled }: {
  item: MemoryRow;
  onCycle: (id: string, next: "critical" | "testing" | "monitor" | "resolved") => void;
  onDelete: (id: string) => void;
  disabled: boolean;
}) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const handlePointerDown = useCallback(() => {
    didLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      if (confirm("Delete this priority?")) {
        onDelete(item.id);
      }
    }, 600);
  }, [item.id, onDelete]);

  const handlePointerUp = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (!didLongPress.current) {
      onCycle(item.id, nextPriority(item.priority));
    }
  }, [item.id, item.priority, onCycle]);

  const handlePointerLeave = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  return (
    <li className="flex items-center h-16 px-4 gap-3">
      <span className={`shrink-0 inline-flex items-center px-2.5 h-6 rounded-full text-[11px] font-bold uppercase tracking-wider ${priorityPillClass(item.priority)}`}>
        {item.priority}
      </span>
      <span className="font-mono font-semibold text-sm truncate flex-1 min-w-0">
        {item.title}
      </span>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-md border border-border hover:bg-muted/30 active:scale-95 transition disabled:opacity-50 touch-manipulation select-none"
        title="Tap to advance status, hold to delete"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </li>
  );
}
