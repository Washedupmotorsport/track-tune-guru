import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Wand2, GitBranch, GitCompare, Disc, Gauge, BookOpen, ArrowRight,
  Brain, ClipboardList, MessageSquare, AlertTriangle, TrendingDown,
  HardHat, BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/engineer")({
  head: () => ({
    meta: [
      { title: "Engineer — My Race Engineer" },
      { name: "description", content: "Engineer workflow: setup changes, tyre analysis, balance adjustments, session comparisons." },
    ],
  }),
  component: EngineerHub,
});

type ChangeRow = { id: string; summary: string; outcome_status: string; created_at: string; setup_id: string };
type FeedbackRow = { id: string; description: string; severity: string; corner: string | null; recorded_at: string };

function EngineerHub() {
  const { user } = useAuth();

  const changesQ = useQuery({
    queryKey: ["engineer-hub-changes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setup_changes")
        .select("id, summary, outcome_status, created_at, setup_id")
        .order("created_at", { ascending: false })
        .limit(6);
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
        .select("id, description, severity, corner, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as FeedbackRow[];
    },
  });

  const pending = (changesQ.data ?? []).filter((r) => r.outcome_status === "pending").length;

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary inline-flex items-center gap-1">
            <HardHat className="w-3 h-3" /> Engineer workspace
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Race engineer</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Read the driver's feedback, adjust balance, log the change with a rationale, compare sessions.
          </p>
        </div>
        <Link
          to="/driver"
          className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary border border-border rounded-md px-2.5 py-1.5"
        >
          ← Switch to driver
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Pending iterations" value={String(pending)} hint="Awaiting on-track verdict" />
        <Stat label="Recent changes" value={String(changesQ.data?.length ?? 0)} hint="Last 6 entries" />
        <Stat label="Inbox" value={String(inboxQ.data?.length ?? 0)} hint="Latest driver feedback" />
        <Stat label="Critical flags" value={String((inboxQ.data ?? []).filter((f) => f.severity === "critical").length)} />
      </div>

      <div className="mt-8 grid lg:grid-cols-[1fr_360px] gap-6">
        <section>
          <h2 className="font-display text-lg font-bold uppercase tracking-wider mb-3">Engineer toolbox</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <ActionCard to="/iteration" icon={GitBranch} title="Setup changes" desc="Log every change with reason, expected effect, outcome, and driver response." />
            <ActionCard to="/setups" icon={Wand2} title="Setups" desc="Open the active setup, edit balance, ride height, dampers, geometry." />
            <ActionCard to="/tyre-wear" icon={TrendingDown} title="Tyre analysis" desc="Pressures, temps, wear, stints. Spot the trend before it bites." />
            <ActionCard to="/tyre-compare" icon={GitCompare} title="Tyre compare" desc="Compare sets and compounds across sessions." />
            <ActionCard to="/corners" icon={Disc} title="Balance / corners" desc="Corner-by-corner balance map for surgical adjustments." />
            <ActionCard to="/analysis" icon={BarChart3} title="Session compare" desc="Side-by-side session and lap comparison." />
            <ActionCard to="/engineering-memory" icon={Brain} title="Engineering memory" desc="Long-term notebook of recurring traits and sensitivities." />
            <ActionCard to="/philosophies" icon={BookOpen} title="Philosophies" desc="Underlying setup directions and trade-offs." />
          </div>

          <h2 className="font-display text-lg font-bold uppercase tracking-wider mt-8 mb-3">Recent setup changes</h2>
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {(changesQ.data ?? []).length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No changes logged yet. <Link to="/iteration" className="text-primary hover:underline">Log the first one →</Link>
              </div>
            )}
            {(changesQ.data ?? []).map((r) => (
              <Link
                key={r.id}
                to="/setups/$setupId"
                params={{ setupId: r.setup_id }}
                className="px-4 py-3 flex items-center gap-3 hover:bg-muted/20"
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
        </section>

        <aside>
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
                    <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                      {new Date(f.recorded_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-xs mt-1 leading-snug">{f.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-card/40 p-4 mt-4">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-accent" />
              <span>Need a quick fix?</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Link to="/confidence" className="border border-border rounded-md px-2 py-1 hover:border-primary hover:text-primary inline-flex items-center gap-1">
                <Gauge className="w-3 h-3" /> Confidence
              </Link>
              <Link to="/debrief" className="border border-border rounded-md px-2 py-1 hover:border-primary hover:text-primary inline-flex items-center gap-1">
                <ClipboardList className="w-3 h-3" /> Debrief
              </Link>
              <Link to="/flags" className="border border-border rounded-md px-2 py-1 hover:border-primary hover:text-primary inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Incidents
              </Link>
            </div>
          </div>
        </aside>
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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-card">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold mt-0.5">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function ActionCard({
  to, icon: Icon, title, desc,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-lg border border-border bg-card p-4 shadow-card hover:border-primary/50 hover:bg-card/80 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border bg-muted/30 text-primary">
          <Icon className="w-4 h-4" />
        </span>
        <div className="font-display font-bold uppercase tracking-wider text-sm">{title}</div>
        <ArrowRight className="w-3.5 h-3.5 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{desc}</p>
    </Link>
  );
}