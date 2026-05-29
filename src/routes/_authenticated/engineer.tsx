import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  GitBranch, Disc, Gauge, ArrowRight, Brain, MessageSquare, AlertTriangle,
  HardHat, CheckCircle2, CircleDot, XCircle, Pin, ClipboardList, Radio, Cloud,
} from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/engineer")({
  head: () => ({
    meta: [
      { title: "Engineer — My Race Engineer" },
      { name: "description", content: "Engineer workflow: setup changes, tyre analysis, balance adjustments, session comparisons." },
    ],
  }),
  component: EngineerHub,
});

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
};
type TyreRow = {
  id: string; tire_set: string; compound: string | null;
  hot_fl: number | null; hot_fr: number | null; hot_rl: number | null; hot_rr: number | null;
  recorded_at: string;
};
type SessionRow = {
  id: string; name: string; track: string | null; weather: string | null;
  air_temp_c: number | null; track_temp_c: number | null; started_at: string;
  session_type: string;
};
type ConfRow = { overall: number | null; recorded_at: string };

function EngineerHub() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const sessionQ = useQuery({
    queryKey: ["engineer-hub-session", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, name, track, weather, air_temp_c, track_temp_c, started_at, session_type")
        .order("started_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as SessionRow | null;
    },
  });

  const changesQ = useQuery({
    queryKey: ["engineer-hub-changes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setup_changes")
        .select("id, summary, reason, expected_effect, outcome_status, created_at, setup_id, area")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ChangeRow[];
    },
  });

  const inboxQ = useQuery({
    queryKey: ["engineer-hub-inbox", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_feedback")
        .select("id, description, severity, corner, category, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as FeedbackRow[];
    },
  });

  const memoryQ = useQuery({
    queryKey: ["engineer-hub-memory", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engineering_memory")
        .select("id, title, detail, category, occurrences, confidence, pinned, last_observed_at")
        .eq("status", "active")
        .order("pinned", { ascending: false })
        .order("last_observed_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as MemoryRow[];
    },
  });

  const tyresQ = useQuery({
    queryKey: ["engineer-hub-tyres", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tire_logs")
        .select("id, tire_set, compound, hot_fl, hot_fr, hot_rl, hot_rr, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as TyreRow | null;
    },
  });

  const confQ = useQuery({
    queryKey: ["engineer-hub-conf", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_confidence")
        .select("overall, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(2);
      if (error) throw error;
      return (data ?? []) as ConfRow[];
    },
  });

  const verdictM = useMutation({
    mutationFn: async (vars: { id: string; status: "confirmed" | "partial" | "rejected" }) => {
      const { error } = await supabase
        .from("setup_changes")
        .update({ outcome_status: vars.status, measured_at: new Date().toISOString() })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Marked ${vars.status}`);
      qc.invalidateQueries({ queryKey: ["engineer-hub-changes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const pendingChanges = useMemo(
    () => (changesQ.data ?? []).filter((r) => r.outcome_status === "pending"),
    [changesQ.data],
  );
  const recentChanges = useMemo(
    () => (changesQ.data ?? []).filter((r) => r.outcome_status !== "pending").slice(0, 5),
    [changesQ.data],
  );

  // Tyre flags: hot pressure outside a 25–33 psi sanity band → call it out.
  const tyreFlags = useMemo(() => {
    const t = tyresQ.data;
    if (!t) return [] as { corner: string; psi: number; reason: string }[];
    const out: { corner: string; psi: number; reason: string }[] = [];
    const check = (corner: string, v: number | null) => {
      if (v == null) return;
      if (v < 25) out.push({ corner, psi: v, reason: "under-pressure" });
      else if (v > 33) out.push({ corner, psi: v, reason: "over-pressure" });
    };
    check("FL", t.hot_fl); check("FR", t.hot_fr); check("RL", t.hot_rl); check("RR", t.hot_rr);
    return out;
  }, [tyresQ.data]);

  const criticalFlags = (inboxQ.data ?? []).filter((f) => f.severity === "critical").length;
  const confDelta = (() => {
    const a = confQ.data?.[0]?.overall;
    const b = confQ.data?.[1]?.overall;
    if (a == null || b == null) return null;
    return a - b;
  })();
  const lastConf = confQ.data?.[0]?.overall ?? null;
  const session = sessionQ.data;

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary inline-flex items-center gap-1">
            <HardHat className="w-3 h-3" /> Engineer workspace
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Pit wall cockpit</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            What needs deciding right now — pending changes, recurring trends, tyre flags, driver inbox.
          </p>
        </div>
        <Link
          to="/driver"
          className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary border border-border rounded-md px-2.5 py-1.5"
        >
          ← Switch to driver
        </Link>
      </div>

      {/* Last run strip — what context the engineer is reading inside of */}
      <div className="mt-5 rounded-lg border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Last run</span>
        </div>
        {session ? (
          <>
            <div className="font-display font-bold uppercase tracking-wider">{session.name}</div>
            {session.track && (
              <div className="text-muted-foreground">· {session.track}</div>
            )}
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {session.session_type} · {new Date(session.started_at).toLocaleString()}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {session.weather && <span className="inline-flex items-center gap-1"><Cloud className="w-3 h-3" />{session.weather}</span>}
              {session.air_temp_c != null && <span>air {session.air_temp_c}°C</span>}
              {session.track_temp_c != null && <span>track {session.track_temp_c}°C</span>}
            </div>
            <Link
              to="/sessions/$sessionId"
              params={{ sessionId: session.id }}
              className="ml-auto text-[10px] font-mono uppercase tracking-widest text-primary hover:underline inline-flex items-center gap-1"
            >
              Open session <ArrowRight className="w-3 h-3" />
            </Link>
          </>
        ) : (
          <span className="text-muted-foreground text-xs">No sessions yet — log one to start the loop.</span>
        )}
      </div>

      {/* KPI strip — urgent things only */}
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Pending verdicts"
          value={String(pendingChanges.length)}
          hint="Changes awaiting on-track confirmation"
          tone={pendingChanges.length > 0 ? "warn" : undefined}
        />
        <Stat
          label="Critical driver flags"
          value={String(criticalFlags)}
          hint="Out of last 8 entries"
          tone={criticalFlags > 0 ? "alert" : undefined}
        />
        <Stat
          label="Tyre flags"
          value={String(tyreFlags.length)}
          hint={tyresQ.data ? "From latest tyre log" : "No tyre log yet"}
          tone={tyreFlags.length > 0 ? "warn" : undefined}
        />
        <Stat
          label="Confidence"
          value={lastConf != null ? `${lastConf}/10` : "—"}
          hint={confDelta != null ? (confDelta === 0 ? "→ flat vs prior" : confDelta > 0 ? `▲ +${confDelta} vs prior` : `▼ ${confDelta} vs prior`) : "Score it after the next run"}
          tone={confDelta != null && confDelta < 0 ? "alert" : undefined}
        />
      </div>

      <div className="mt-6 grid lg:grid-cols-[1fr_360px] gap-6">
        <section className="space-y-6">
          {/* Open verdicts — inline decisions, no extra screen */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="w-4 h-4 text-primary" />
              <h2 className="font-display text-sm font-bold uppercase tracking-wider">Open verdicts</h2>
              <span className="text-[10px] font-mono text-muted-foreground">· {pendingChanges.length} awaiting</span>
              <Link to="/iteration" className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">
                Log change →
              </Link>
            </div>
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {changesQ.isLoading && <div className="p-4 text-xs text-muted-foreground">Loading…</div>}
              {!changesQ.isLoading && pendingChanges.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nothing pending. Every logged change has a verdict.
                </div>
              )}
              {pendingChanges.map((r) => (
                <div key={r.id} className="p-3 flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-1.5 h-5 rounded border border-border bg-muted/30 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        {r.area}
                      </span>
                      <Link
                        to="/setups/$setupId"
                        params={{ setupId: r.setup_id }}
                        className="text-sm font-medium truncate hover:text-primary"
                      >
                        {r.summary}
                      </Link>
                      <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {(r.reason || r.expected_effect) && (
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {r.expected_effect ? <span className="text-foreground/80">Expect: </span> : null}
                        {r.expected_effect ?? r.reason}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 basis-full md:basis-auto">
                    <VerdictButton onClick={() => verdictM.mutate({ id: r.id, status: "confirmed" })} tone="ok"   icon={CheckCircle2} label="Confirm" disabled={verdictM.isPending} />
                    <VerdictButton onClick={() => verdictM.mutate({ id: r.id, status: "partial"   })} tone="warn" icon={CircleDot}     label="Partial" disabled={verdictM.isPending} />
                    <VerdictButton onClick={() => verdictM.mutate({ id: r.id, status: "rejected"  })} tone="bad"  icon={XCircle}       label="Reject"  disabled={verdictM.isPending} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recurring trends — pulled from engineering memory */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-primary" />
              <h2 className="font-display text-sm font-bold uppercase tracking-wider">Recurring trends</h2>
              <Link to="/engineering-memory" className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">
                All memory →
              </Link>
            </div>
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {(memoryQ.data ?? []).length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No engineering memory yet. Pin a recurring trait from <Link to="/engineering-memory" className="text-primary hover:underline">memory</Link>.
                </div>
              )}
              {(memoryQ.data ?? []).map((m) => (
                <div key={m.id} className="p-3 flex items-start gap-3">
                  {m.pinned ? <Pin className="w-3.5 h-3.5 text-primary mt-1" /> : <span className="w-3.5 h-3.5 inline-block mt-1" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-sm font-medium truncate">{m.title}</div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{m.category}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">×{m.occurrences}</span>
                    </div>
                    {m.detail && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.detail}</div>}
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground shrink-0">
                    {new Date(m.last_observed_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recently resolved — proof the loop is closing */}
          {recentChanges.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">Recently resolved</h2>
              </div>
              <div className="rounded-lg border border-border bg-card/60 divide-y divide-border">
                {recentChanges.map((r) => (
                  <Link
                    key={r.id}
                    to="/setups/$setupId"
                    params={{ setupId: r.setup_id }}
                    className="px-3 py-2 flex items-center gap-3 hover:bg-muted/20"
                  >
                    <span className={`inline-flex items-center justify-center px-1.5 h-5 rounded border text-[10px] font-mono uppercase tracking-widest ${outcomeTone(r.outcome_status)}`}>
                      {r.outcome_status}
                    </span>
                    <span className="text-sm flex-1 min-w-0 truncate">{r.summary}</span>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          {/* Driver inbox */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h3 className="font-display font-bold uppercase tracking-wider text-sm">Driver inbox</h3>
              <Link to="/sympathy" className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">
                All →
              </Link>
            </div>
            <div className="space-y-2">
              {inboxQ.isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
              {!inboxQ.isLoading && (inboxQ.data ?? []).length === 0 && (
                <div className="text-xs text-muted-foreground">No driver feedback yet.</div>
              )}
              {(inboxQ.data ?? []).map((f) => (
                <div key={f.id} className="rounded border border-border bg-background/50 p-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center px-1.5 h-4 rounded border text-[9px] font-mono uppercase tracking-widest ${severityTone(f.severity)}`}>
                      {f.severity}
                    </span>
                    {f.corner && <span className="text-[10px] font-mono uppercase text-muted-foreground">{f.corner}</span>}
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">· {f.category}</span>
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                      {new Date(f.recorded_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-xs mt-1 leading-snug">{f.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tyre flags */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <Disc className="w-4 h-4 text-primary" />
              <h3 className="font-display font-bold uppercase tracking-wider text-sm">Tyre flags</h3>
              <Link to="/tyre-setup" className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">
                Pressures →
              </Link>
            </div>
            {!tyresQ.data && <div className="text-xs text-muted-foreground">No tyre log yet.</div>}
            {tyresQ.data && tyreFlags.length === 0 && (
              <div className="text-xs text-muted-foreground">
                Pressures in band on last log ({tyresQ.data.tire_set}{tyresQ.data.compound ? ` · ${tyresQ.data.compound}` : ""}).
              </div>
            )}
            {tyresQ.data && tyreFlags.length > 0 && (
              <ul className="space-y-1.5">
                {tyreFlags.map((f) => (
                  <li key={f.corner} className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center justify-center w-7 h-5 rounded border border-accent/50 bg-accent/15 text-accent text-[10px] font-mono uppercase tracking-widest">
                      {f.corner}
                    </span>
                    <span className="font-mono">{f.psi.toFixed(1)} psi</span>
                    <span className="text-muted-foreground">· {f.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Critical alert callout — only when something is actually wrong */}
          {(criticalFlags > 0 || (confDelta != null && confDelta < 0)) && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="font-display font-bold uppercase tracking-wider">Attention</span>
              </div>
              <ul className="mt-2 text-xs text-muted-foreground space-y-1 list-disc pl-5">
                {criticalFlags > 0 && <li>{criticalFlags} critical driver flag{criticalFlags > 1 ? "s" : ""} in inbox</li>}
                {confDelta != null && confDelta < 0 && <li>Driver confidence down {Math.abs(confDelta)} pt vs prior session</li>}
              </ul>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Link to="/post-debrief" className="border border-border rounded px-2 h-6 inline-flex items-center text-[10px] font-mono uppercase tracking-widest hover:border-primary hover:text-primary">
                  Open debrief
                </Link>
                <Link to="/iteration" className="border border-border rounded px-2 h-6 inline-flex items-center text-[10px] font-mono uppercase tracking-widest hover:border-primary hover:text-primary">
                  Plan a change
                </Link>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Thin supporting-tools footer — kept tiny so it doesn't become a link grid again */}
      <div className="mt-8 pt-4 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <span className="text-foreground/70">Supporting</span>
        <Link to="/setup-library" className="hover:text-primary">Setup library</Link>
        <Link to="/iteration"     className="hover:text-primary">Iteration log</Link>
        <Link to="/corners"       className="hover:text-primary">Corner balance</Link>
        <Link to="/analysis"      className="hover:text-primary">Session compare</Link>
        <Link to="/tyre-compare"  className="hover:text-primary">Tyre compare</Link>
        <Link to="/tyre-wear"     className="hover:text-primary">Tyre wear</Link>
        <Link to="/confidence"    className="hover:text-primary">Confidence</Link>
        <Link to="/philosophies"  className="hover:text-primary">Philosophies</Link>
      </div>
    </div>
  );
}

function outcomeTone(s: string) {
  if (s === "confirmed") return "border-primary/40 bg-primary/10 text-primary";
  if (s === "partial") return "border-accent/50 bg-accent/15 text-accent";
  if (s === "rejected") return "border-destructive/50 bg-destructive/15 text-destructive";
  return "border-border bg-muted/30 text-muted-foreground";
}

function severityTone(s: string) {
  if (s === "critical") return "border-destructive/50 bg-destructive/15 text-destructive";
  if (s === "warning") return "border-accent/50 bg-accent/15 text-accent";
  return "border-border bg-muted/30 text-muted-foreground";
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" | "alert" }) {
  const toneCls =
    tone === "alert" ? "border-destructive/40 bg-destructive/5"
    : tone === "warn"  ? "border-accent/40 bg-accent/5"
    : "border-border bg-card";
  return (
    <div className={`rounded-lg border p-3 shadow-card ${toneCls}`}>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold mt-0.5">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function VerdictButton({
  onClick, icon: Icon, label, tone, disabled,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "ok" | "warn" | "bad";
  disabled?: boolean;
}) {
  const cls =
    tone === "ok"   ? "border-primary/40 text-primary hover:bg-primary/10"
    : tone === "warn" ? "border-accent/50 text-accent hover:bg-accent/10"
    : "border-destructive/50 text-destructive hover:bg-destructive/10";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 px-2 h-7 rounded border text-[10px] font-mono uppercase tracking-widest disabled:opacity-50 ${cls}`}
    >
      <Icon className="w-3 h-3" /> {label}
    </button>
  );
}