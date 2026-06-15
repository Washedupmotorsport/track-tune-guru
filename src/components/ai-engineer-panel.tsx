import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Brain, Sparkles, Loader as Loader2, TriangleAlert as AlertTriangle, ArrowRight, CircleCheck as CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useActiveWeekend } from "@/lib/active-weekend";
import { useAuth } from "@/lib/auth-context";
import { getCurrentWeather, type WeatherSnap } from "@/lib/weather";
import {
  getEngineerRecommendations,
  type EngineerResult,
  type EngineerRecommendation,
} from "@/lib/advisor.functions";

export function AiEngineerPanel() {
  const { user } = useAuth();
  const { activeWeekend, activeCar, activeTrack, activeSession } = useActiveWeekend();
  const run = useServerFn(getEngineerRecommendations);
  const [result, setResult] = useState<EngineerResult | null>(null);

  const m = useMutation({
    mutationFn: async () => {
      let weather: WeatherSnap | null = null;
      try { weather = await getCurrentWeather(); } catch { /* optional */ }
      return run({
        data: {
          eventId: activeWeekend?.id ?? null,
          weather: weather ?? null,
        },
      });
    },
    onSuccess: (r) => setResult(r),
    onError: (e) => toast.error(e instanceof Error ? e.message : "AI Engineer failed"),
  });

  const disabled = !user || !activeWeekend || m.isPending;

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
        <Brain className="w-4 h-4 text-primary" />
        <h2 className="font-display text-sm font-bold">AI Engineer</h2>
        <span className="text-xs text-muted-foreground truncate">
          {activeWeekend ? `· ${activeWeekend.title}` : "· no active weekend"}
        </span>
        <button
          type="button"
          onClick={() => m.mutate()}
          disabled={disabled}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 text-primary text-xs font-semibold px-3 h-8 hover:bg-primary/15 disabled:opacity-50"
        >
          {m.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {result ? "Re-run" : "Run analysis"}
        </button>
      </div>

      {/* Context strip — what was loaded */}
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border border-b border-border text-xs">
        <Ctx label="Weekend" value={activeWeekend?.title ?? "—"} />
        <Ctx label="Car" value={activeCar ? (activeCar.name ?? (`${activeCar.make ?? ""} ${activeCar.model ?? ""}`.trim() || "—")) : "—"} />
        <Ctx label="Track" value={activeTrack?.name ?? activeWeekend?.track ?? "—"} />
        <Ctx label="Session" value={activeSession?.name ?? "—"} />
      </div>

      {!activeWeekend && (
        <div className="p-6 text-sm text-muted-foreground">
          Pick an active weekend (top-left in the header) to get recommendations grounded in your real data.
        </div>
      )}

      {!result && activeWeekend && !m.isPending && (
        <div className="p-6 text-sm text-muted-foreground">
          Click <span className="font-semibold text-foreground">Run analysis</span> to load weekend, car, track, session, weather, tyres, setup, recent changes, driver feedback, debrief notes and engineering memory — then ask the AI Engineer for grounded recommendations.
        </div>
      )}

      {m.isPending && (
        <div className="p-6 text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading weekend context and analysing…
        </div>
      )}

      {result && (
        <div className="p-4 space-y-4">
          {result.summary && (
            <p className="text-sm leading-relaxed text-foreground/90">{result.summary}</p>
          )}

          {result.missing.length > 0 && (
            <div className="rounded-lg border border-accent/40 bg-accent/5 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-accent">
                <AlertTriangle className="w-4 h-4" /> Missing data
              </div>
              <ul className="mt-2 text-xs text-muted-foreground space-y-1 list-disc pl-5">
                {result.missing.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Add what's missing and re-run for stronger recommendations.
              </p>
            </div>
          )}

          {result.recommendations.length === 0 && result.missing.length === 0 && (
            <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              No actionable changes from the current data. Log more sessions or driver feedback to refine.
            </div>
          )}

          {result.recommendations.length > 0 && (
            <ul className="space-y-3">
              {result.recommendations.map((r, i) => (
                <RecCard key={i} rec={r} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Ctx({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 min-w-0">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="font-medium text-xs truncate">{value}</div>
    </div>
  );
}

function RecCard({ rec }: { rec: EngineerRecommendation }) {
  const tone =
    rec.confidence === "high" ? "border-primary/40 bg-primary/5 text-primary"
    : rec.confidence === "medium" ? "border-accent/40 bg-accent/5 text-accent"
    : "border-border bg-muted/30 text-muted-foreground";

  const related = rec.related ?? {};

  return (
    <li className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {rec.area && (
              <span className="inline-flex items-center px-2 h-5 rounded-md border border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                {rec.area}
              </span>
            )}
            <span className={`inline-flex items-center px-2 h-5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
              {rec.confidence} confidence
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold leading-snug">{rec.recommendation}</p>
          {rec.reason && (
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              <span className="text-foreground/80 font-medium">Why: </span>{rec.reason}
            </p>
          )}

          {rec.supporting_data.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Supporting data</div>
              <ul className="text-xs space-y-1 list-disc pl-5 text-muted-foreground">
                {rec.supporting_data.map((s, i) => <li key={i} className="leading-relaxed">{s}</li>)}
              </ul>
            </div>
          )}

          {(related.session_id || related.setup_id || related.debrief_id || related.tire_log_id || related.memory_id || related.feedback_id) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {related.session_id && (
                <RelatedLink to="/sessions/$sessionId" params={{ sessionId: related.session_id }} label="Session" />
              )}
              {related.setup_id && (
                <RelatedLink to="/setups/$setupId" params={{ setupId: related.setup_id }} label="Setup" />
              )}
              {related.tire_log_id && (
                <RelatedLink to="/tyre-setup" label="Tyre log" />
              )}
              {related.debrief_id && (
                <RelatedLink to="/post-debrief" label="Debrief" />
              )}
              {related.memory_id && (
                <RelatedLink to="/engineering-memory" label="Memory" />
              )}
              {related.feedback_id && (
                <RelatedLink to="/debrief" label="Driver feedback" />
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function RelatedLink({ to, params, label }: { to: string; params?: Record<string, string>; label: string }) {
  return (
    <Link
      to={to as string}
      params={params as never}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary border border-border rounded-md px-2 h-6"
    >
      {label} <ArrowRight className="w-3 h-3" />
    </Link>
  );
}