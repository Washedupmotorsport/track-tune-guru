import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  GitBranch, Disc, ArrowRight, Brain, MessageSquare, AlertTriangle,
  HardHat, CheckCircle2, CircleDot, XCircle, Pin, Radio, Cloud,
  Fuel, Timer, Wrench, Wand2, CalendarDays, TrendingUp, TrendingDown, Minus,
  Activity, Flag,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useState, type ComponentType } from "react";

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
        .select("id, title, detail, category, occurrences, confidence, pinned, last_observed_at, priority")
        .eq("status", "active")
        .in("priority", ["critical", "testing", "monitor"])
        .order("last_observed_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as MemoryRow[];
    },
  });

  const priorityM = useMutation({
    mutationFn: async (vars: { id: string; priority: "critical" | "testing" | "monitor" | "resolved" }) => {
      const patch: { priority: string; status?: string } = { priority: vars.priority };
      if (vars.priority === "resolved") patch.status = "archived";
      const { error } = await supabase.from("engineering_memory").update(patch).eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Marked ${vars.priority}`);
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
  const priorityGroups = useMemo(() => {
    const order: Array<"critical" | "testing" | "monitor"> = ["critical", "testing", "monitor"];
    return order.map((p) => ({ key: p, items: priorities.filter((i) => i.priority === p) }));
  }, [priorities]);
  const criticalIssues = priorityGroups[0].items.length;
  const testingIssues = priorityGroups[1].items.length;
  const session = sessionQ.data;
  const setup = activeSetupQ.data;
  const nextEvent = nextEventQ.data;
  const openDamage = damageQ.data ?? [];
  const criticalDamage = openDamage.filter((d) => d.severity === "critical" || d.severity === "major").length;

  const fuelUsed = session && session.fuel_start_l != null && session.fuel_end_l != null
    ? Math.max(0, session.fuel_start_l - session.fuel_end_l) : null;

  return (
    <div className="space-y-3">
      {/* HEADER BAR ====================================================== */}
      <header className="rounded-md border border-border bg-card">
        <div className="flex items-stretch divide-x divide-border text-xs">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="font-mono uppercase tracking-[0.18em] text-primary">Cockpit</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 min-w-0">
            <Radio className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Last run</span>
            {session ? (
              <Link to="/sessions/$sessionId" params={{ sessionId: session.id }} className="truncate font-display font-bold uppercase tracking-wider hover:text-primary">
                {session.name}{session.track ? ` · ${session.track}` : ""}
              </Link>
            ) : (
              <span className="text-muted-foreground">no sessions</span>
            )}
            {session && (
              <span className="text-muted-foreground hidden md:inline">· {session.session_type} · {timeAgo(session.started_at, now)}</span>
            )}
          </div>
          <div className="hidden md:flex items-center gap-3 px-3 py-2 text-muted-foreground">
            {session?.weather && <span className="inline-flex items-center gap-1"><Cloud className="w-3 h-3" />{session.weather}</span>}
            {session?.air_temp_c != null && <span>air {session.air_temp_c}°</span>}
            {session?.track_temp_c != null && <span>track {session.track_temp_c}°</span>}
          </div>
          <div className="ml-auto flex items-center gap-2 px-3 py-2">
            <Link to="/driver" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary border border-border rounded px-2 py-1">
              Driver →
            </Link>
            <Link to="/pitwall" className="font-mono text-[10px] uppercase tracking-widest text-primary hover:underline border border-primary/40 bg-primary/10 rounded px-2 py-1">
              Pit wall
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border border-t border-border text-xs">
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
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Kpi icon={AlertTriangle} label="Critical issues" value={criticalIssues} tone={criticalIssues > 0 ? "alert" : undefined} />
        <Kpi icon={CircleDot} label="In testing" value={testingIssues} tone={testingIssues > 0 ? "warn" : undefined} />
        <Kpi icon={GitBranch} label="Pending verdicts" value={pendingChanges.length} tone={pendingChanges.length > 0 ? "warn" : undefined} />
        <Kpi icon={MessageSquare} label="Critical flags" value={criticalFlags} tone={criticalFlags > 0 ? "alert" : undefined} />
        <Kpi icon={Disc} label="Tyre flags" value={tyreFlags.length} tone={tyreFlags.length > 0 ? "warn" : undefined} />
        <Kpi icon={Wrench} label="Open concerns" value={openDamage.length} tone={criticalDamage > 0 ? "alert" : openDamage.length > 0 ? "warn" : undefined} />
      </div>

      {/* ENGINEERING PRIORITIES ========================================= */}
      <Panel
        icon={AlertTriangle}
        title="Engineering priorities"
        count={priorities.length}
        action={{ to: "/engineering-memory", label: "Manage" }}
        tone={criticalIssues > 0 ? "alert" : testingIssues > 0 ? "warn" : undefined}
      >
        {prioritiesQ.isLoading && <PanelEmpty>Loading…</PanelEmpty>}
        {!prioritiesQ.isLoading && priorities.length === 0 && (
          <PanelEmpty>No active priorities. Flag a recurring issue from the memory page.</PanelEmpty>
        )}
        {priorities.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
            {priorityGroups.map((g) => (
              <div key={g.key} className="min-w-0">
                <div className={`flex items-center gap-2 px-2.5 py-1 border-b border-border ${priorityHeadTone(g.key)}`}>
                  <span className={`inline-flex items-center px-1.5 h-4 rounded text-[9px] font-mono uppercase tracking-widest ${priorityBadgeTone(g.key)}`}>
                    {g.key}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">· {g.items.length}</span>
                </div>
                {g.items.length === 0 ? (
                  <div className="px-3 py-3 text-[11px] text-muted-foreground">—</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {g.items.slice(0, 6).map((m) => (
                      <li key={m.id} className="p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-medium truncate flex-1">{m.title}</span>
                          <Chip>{m.category}</Chip>
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">×{m.occurrences}</span>
                        </div>
                        {m.detail && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{m.detail}</p>}
                        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                          {g.key !== "critical" && (
                            <Verdict tone="bad" icon={AlertTriangle} label="Critical"
                              onClick={() => priorityM.mutate({ id: m.id, priority: "critical" })}
                              disabled={priorityM.isPending} />
                          )}
                          {g.key !== "testing" && (
                            <Verdict tone="warn" icon={CircleDot} label="Testing"
                              onClick={() => priorityM.mutate({ id: m.id, priority: "testing" })}
                              disabled={priorityM.isPending} />
                          )}
                          {g.key !== "monitor" && (
                            <Verdict tone="ok" icon={Brain} label="Monitor"
                              onClick={() => priorityM.mutate({ id: m.id, priority: "monitor" })}
                              disabled={priorityM.isPending} />
                          )}
                          <Verdict tone="ok" icon={CheckCircle2} label="Resolved"
                            onClick={() => priorityM.mutate({ id: m.id, priority: "resolved" })}
                            disabled={priorityM.isPending} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* COCKPIT GRID =================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* COL A — verdicts + driver inbox */}
        <section className="space-y-3">
          <Panel icon={GitBranch} title="Open verdicts" count={pendingChanges.length}
                 action={{ to: "/iteration", label: "Log change" }}>
            {changesQ.isLoading && <PanelEmpty>Loading…</PanelEmpty>}
            {!changesQ.isLoading && pendingChanges.length === 0 && (
              <PanelEmpty>Every change has a verdict.</PanelEmpty>
            )}
            <ul className="divide-y divide-border">
              {pendingChanges.slice(0, 6).map((r) => (
                <li key={r.id} className="p-2.5">
                  <div className="flex items-center gap-2">
                    <Chip>{r.area}</Chip>
                    <Link to="/setups/$setupId" params={{ setupId: r.setup_id }}
                      className="text-[13px] font-medium truncate hover:text-primary flex-1 min-w-0">
                      {r.summary}
                    </Link>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">{shortDate(r.created_at)}</span>
                  </div>
                  {(r.expected_effect || r.reason) && (
                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                      {r.expected_effect ? <span className="text-foreground/80">Expect: </span> : null}
                      {r.expected_effect ?? r.reason}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-1">
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
                <li key={f.id} className="p-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-1.5 h-4 rounded border text-[9px] font-mono uppercase tracking-widest ${severityTone(f.severity)}`}>
                      {f.severity}
                    </span>
                    {f.corner && <span className="text-[10px] font-mono uppercase text-muted-foreground">{f.corner}</span>}
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">· {f.category}</span>
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground">{shortDate(f.recorded_at)}</span>
                  </div>
                  <p className="text-[12px] mt-1 leading-snug">{f.description}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        {/* COL B — tyres + confidence trend */}
        <section className="space-y-3">
          <Panel icon={Disc} title="Tyre status" count={tyreFlags.length}
                 action={{ to: "/tyre-setup", label: "Pressures" }}
                 tone={tyreFlags.length > 0 ? "warn" : undefined}>
            {!tyresQ.data && <PanelEmpty>No tyre log yet.</PanelEmpty>}
            {tyresQ.data && (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono uppercase tracking-widest">{tyresQ.data.tire_set}</span>
                  {tyresQ.data.compound && <span>· {tyresQ.data.compound}</span>}
                  <span className="ml-auto font-mono">{shortDate(tyresQ.data.recorded_at)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <TyreCell corner="FL" psi={tyresQ.data.hot_fl} />
                  <TyreCell corner="FR" psi={tyresQ.data.hot_fr} />
                  <TyreCell corner="RL" psi={tyresQ.data.hot_rl} />
                  <TyreCell corner="RR" psi={tyresQ.data.hot_rr} />
                </div>
                {tyreFlags.length > 0 && (
                  <ul className="text-[11px] space-y-1 pt-1 border-t border-border">
                    {tyreFlags.map((f) => (
                      <li key={f.corner} className="flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 text-accent" />
                        <span className="font-mono">{f.corner} {f.psi.toFixed(1)} psi</span>
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
              <div className="p-3">
                <div className="flex items-end gap-1 h-16">
                  {confValues.map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col justify-end items-center" title={`${v}/10`}>
                      <div className="w-full bg-primary/70 rounded-t-sm" style={{ height: `${(v / 10) * 100}%` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  <span>last {confValues.length} runs</span>
                  <span className="inline-flex items-center gap-1">
                    {confDelta == null ? null : confDelta > 0
                      ? <><TrendingUp className="w-3 h-3 text-primary" /> +{confDelta}</>
                      : confDelta < 0
                        ? <><TrendingDown className="w-3 h-3 text-destructive" /> {confDelta}</>
                        : <><Minus className="w-3 h-3" /> flat</>}
                  </span>
                </div>
              </div>
            )}
          </Panel>
        </section>

        {/* COL C — recurring trends + concerns */}
        <section className="space-y-3">
          <Panel icon={Brain} title="Recurring trends" count={(memoryQ.data ?? []).length}
                 action={{ to: "/engineering-memory", label: "All memory" }}>
            {(memoryQ.data ?? []).length === 0 && <PanelEmpty>Pin recurring traits as you see them.</PanelEmpty>}
            <ul className="divide-y divide-border">
              {(memoryQ.data ?? []).map((m) => (
                <li key={m.id} className="p-2.5 flex items-start gap-2">
                  {m.pinned
                    ? <Pin className="w-3 h-3 text-primary mt-1 shrink-0" />
                    : <span className="w-3 h-3 inline-block mt-1 shrink-0" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-medium truncate">{m.title}</span>
                      <Chip>{m.category}</Chip>
                      <span className="text-[10px] font-mono text-muted-foreground">×{m.occurrences}</span>
                    </div>
                    {m.detail && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{m.detail}</p>}
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
                <li key={d.id} className="p-2.5 flex items-center gap-2">
                  <span className={`inline-flex items-center px-1.5 h-4 rounded border text-[9px] font-mono uppercase tracking-widest ${severityTone(d.severity)}`}>
                    {d.severity}
                  </span>
                  <span className="text-[12px] font-medium truncate flex-1">{d.component}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{d.status}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{shortDate(d.occurred_at)}</span>
                </li>
              ))}
            </ul>
          </Panel>

          {(criticalFlags > 0 || criticalDamage > 0 || (confDelta != null && confDelta <= -2)) && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <div className="flex items-center gap-2 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                <span className="font-display font-bold uppercase tracking-wider">Attention</span>
              </div>
              <ul className="mt-1.5 text-[11px] text-muted-foreground space-y-0.5 list-disc pl-5">
                {criticalFlags > 0 && <li>{criticalFlags} critical driver flag{criticalFlags > 1 ? "s" : ""}</li>}
                {criticalDamage > 0 && <li>{criticalDamage} major/critical damage report{criticalDamage > 1 ? "s" : ""} open</li>}
                {confDelta != null && confDelta <= -2 && <li>Confidence down {Math.abs(confDelta)} pt vs prior</li>}
              </ul>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Link to="/post-debrief" className="border border-border rounded px-2 h-6 inline-flex items-center text-[10px] font-mono uppercase tracking-widest hover:border-primary hover:text-primary">Open debrief</Link>
                <Link to="/iteration"   className="border border-border rounded px-2 h-6 inline-flex items-center text-[10px] font-mono uppercase tracking-widest hover:border-primary hover:text-primary">Plan change</Link>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* SUPPORTING TOOLS (thin) */}
      <div className="pt-3 border-t border-border flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <span className="text-foreground/70 inline-flex items-center gap-1"><HardHat className="w-3 h-3" /> Tools</span>
        <Link to="/setup-library" className="hover:text-primary">Setup library</Link>
        <Link to="/iteration"     className="hover:text-primary">Iteration log</Link>
        <Link to="/corners"       className="hover:text-primary">Corner balance</Link>
        <Link to="/analysis"      className="hover:text-primary">Session compare</Link>
        <Link to="/tyre-compare"  className="hover:text-primary">Tyre compare</Link>
        <Link to="/tyre-wear"     className="hover:text-primary">Tyre wear</Link>
        <Link to="/sessions"      className="hover:text-primary">Sessions</Link>
        <Link to="/weekends"      className="hover:text-primary">Weekends</Link>
        <Link to="/flags"         className="hover:text-primary"><Flag className="w-3 h-3 inline -mt-0.5" /> Incidents</Link>
        <span className="ml-auto inline-flex items-center gap-1"><Timer className="w-3 h-3" />{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
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
    <div className={`rounded-md border px-2.5 py-2 flex items-center gap-2 ${cls}`}>
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground leading-none">{label}</div>
        <div className="font-display text-xl font-bold leading-tight">{value}</div>
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
      <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
        <Icon className="w-3 h-3" /> {label}
        {link && <ArrowRight className="w-3 h-3 ml-auto opacity-50" />}
      </div>
      <div className="font-display text-base font-bold leading-tight mt-0.5 truncate">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
    </>
  );
  const wrapCls = `block px-3 py-2 ${cls} ${link ? "hover:bg-muted/30" : ""}`;
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
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <div className={`flex items-center gap-2 px-2.5 py-1.5 border-b ${head}`}>
        <Icon className="w-3.5 h-3.5 text-primary" />
        <h2 className="font-display text-[12px] font-bold uppercase tracking-wider">{title}</h2>
        {count != null && <span className="text-[10px] font-mono text-muted-foreground">· {count}</span>}
        {action && (
          <Link to={action.to} className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-4 text-center text-[12px] text-muted-foreground">{children}</div>;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-1.5 h-4 rounded border border-border bg-muted/30 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
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
    <div className={`rounded border px-2 py-1.5 flex items-center justify-between ${cls}`}>
      <span className="text-[10px] font-mono uppercase tracking-widest opacity-70">{corner}</span>
      <span className="font-display text-sm font-bold">{psi != null ? `${psi.toFixed(1)}` : "—"}<span className="text-[9px] font-mono opacity-60 ml-0.5">psi</span></span>
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
      className={`inline-flex items-center gap-1 px-1.5 h-6 rounded border text-[10px] font-mono uppercase tracking-widest disabled:opacity-50 ${cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </button>
  );
}

function severityTone(s: string) {
  if (s === "critical") return "border-destructive/50 bg-destructive/15 text-destructive";
  if (s === "warning" || s === "major") return "border-accent/50 bg-accent/15 text-accent";
  return "border-border bg-muted/30 text-muted-foreground";
}

function priorityBadgeTone(p: string) {
  if (p === "critical") return "border border-destructive/50 bg-destructive/15 text-destructive";
  if (p === "testing") return "border border-accent/50 bg-accent/15 text-accent";
  if (p === "resolved") return "border border-border bg-muted/40 text-muted-foreground";
  return "border border-primary/40 bg-primary/10 text-primary";
}

function priorityHeadTone(p: string) {
  if (p === "critical") return "bg-destructive/10";
  if (p === "testing") return "bg-accent/10";
  return "bg-muted/30";
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
