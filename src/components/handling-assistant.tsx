import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useActiveWeekend } from "@/lib/active-weekend";
import {
  analyzeHandlingIssue,
  HANDLING_ISSUES,
  RECOMMENDATION_NOTE,
  type AnalysisInput,
  type ConditionInput,
  type HandlingAnalysis,
  type IssueId,
  type TyreSnapshot,
} from "@/lib/handling-assistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Stethoscope,
  AlertTriangle,
  FlaskConical,
  CheckCircle2,
  XCircle,
  Save,
  GitCompare,
} from "lucide-react";
import { toast } from "sonner";

type SavedRecommendation = {
  id: string;
  title: string;
  occurred_at: string;
  metadata: {
    issue_label?: string;
    status?: "proposed" | "verified" | "rejected";
    recommended_test?: string;
    expected_result?: string;
    actual_adjustment?: string | null;
    actual_result?: string | null;
  };
};

const CORNER_SPEEDS = ["low", "medium", "high"];
const BRAKING_PHASES = ["none", "initial", "mid", "trail"];
const THROTTLE_POSITIONS = ["off", "partial", "full"];
const TYRE_CONDITIONS = ["new", "scrubbed", "worn", "unknown"];

function Section({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "warn";
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div
        className={`text-[10px] font-mono uppercase tracking-widest mb-1.5 ${tone === "warn" ? "text-amber-500" : "text-muted-foreground"}`}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

export function HandlingAssistant({ sessionId, carId }: { sessionId?: string; carId?: string }) {
  const { activeCar, activeSession } = useActiveWeekend();
  const selectedSession =
    sessionId ?? (carId && carId !== activeCar?.id ? undefined : activeSession?.id);
  const selectedCar = carId ?? activeCar?.id;
  return (
    <HandlingAssistantContent
      key={`${selectedCar ?? ""}:${selectedSession ?? ""}`}
      carId={selectedCar}
      sessionId={selectedSession}
    />
  );
}

function HandlingAssistantContent({ carId, sessionId }: { carId?: string; sessionId?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [issueId, setIssueId] = useState<IssueId | "">("");
  const [conditions, setConditions] = useState<ConditionInput>({});
  const [analysis, setAnalysis] = useState<HandlingAnalysis | null>(null);
  const [safetyAck, setSafetyAck] = useState(false);

  const sessionQ = useQuery({
    queryKey: ["assistant-session", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from("sessions")
        .select("id,car_id,setup_id,name")
        .eq("id", sessionId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const effectiveCar = sessionId ? sessionQ.data?.car_id : carId;
  const carQ = useQuery({
    queryKey: ["assistant-car", effectiveCar],
    enabled: !!effectiveCar,
    queryFn: async () => {
      if (!effectiveCar) return null;
      const { data, error } = await supabase
        .from("cars")
        .select("id,name")
        .eq("id", effectiveCar)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const activeCar = carQ.data;
  const setupQ = useQuery({
    queryKey: ["assistant-setup", effectiveCar, sessionId, sessionQ.data?.setup_id],
    enabled: !!effectiveCar,
    queryFn: async () => {
      if (!effectiveCar || (sessionId && !sessionQ.data?.setup_id)) return null;
      let q = supabase.from("setups").select("id,name,setup_data").eq("car_id", effectiveCar);
      if (sessionId && sessionQ.data?.setup_id) q = q.eq("id", sessionQ.data.setup_id);
      const { data, error } = await q.order("updated_at", { ascending: false }).limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const tyreQ = useQuery({
    queryKey: ["assistant-tyre", effectiveCar, sessionId],
    enabled: !!effectiveCar,
    queryFn: async () => {
      if (!effectiveCar) return null;
      let q = supabase
        .from("tire_logs")
        .select(
          "compound,cold_fl,cold_fr,cold_rl,cold_rr,hot_fl,hot_fr,hot_rl,hot_rr,heat_cycles,tread_fl,tread_fr,tread_rl,tread_rr",
        )
        .eq("car_id", effectiveCar);
      if (sessionId) q = q.eq("session_id", sessionId);
      const { data, error } = await q.order("recorded_at", { ascending: false }).limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as TyreSnapshot | null;
    },
  });

  const sessionsQ = useQuery({
    queryKey: ["assistant-sessions", effectiveCar],
    enabled: !!effectiveCar,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("car_id", effectiveCar ?? "");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const savedQ = useQuery({
    queryKey: ["assistant-recommendations", effectiveCar, sessionId],
    enabled: !!user && !!effectiveCar,
    queryFn: async () => {
      let query = supabase
        .from("timeline_events")
        .select("id,title,occurred_at,metadata,session_id")
        .eq("type", "handling_recommendation")
        .eq("metadata->>car_id", effectiveCar ?? "");
      if (sessionId) query = query.eq("session_id", sessionId);
      const { data, error } = await query.order("occurred_at", { ascending: false }).limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as SavedRecommendation[];
    },
  });

  const input: AnalysisInput | null = useMemo(() => {
    if (!issueId) return null;
    return {
      issueId,
      conditions,
      setupData: (setupQ.data?.setup_data as Record<string, string | number | null>) ?? {},
      tyre: tyreQ.data ?? null,
      sessionsCount: sessionsQ.data ?? 0,
    };
  }, [issueId, conditions, setupQ.data, tyreQ.data, sessionsQ.data]);

  useEffect(() => {
    setAnalysis(null);
    setSafetyAck(false);
  }, [input]);

  const save = useMutation({
    mutationFn: async (status: "proposed" | "rejected") => {
      if (
        !user ||
        !analysis ||
        !effectiveCar ||
        (sessionId && sessionQ.data?.car_id !== effectiveCar)
      )
        throw new Error("Nothing to save yet");
      const { error } = await supabase.from("timeline_events").insert({
        user_id: user.id,
        session_id: sessionId ?? null,
        type: "handling_recommendation",
        title: `${analysis.issue.label}: proposed test`,
        description: analysis.recommendedTest,
        metadata: {
          issue_id: analysis.issue.id,
          issue_label: analysis.issue.label,
          conditions,
          causes: analysis.causes,
          recommended_test: analysis.recommendedTest,
          expected_result: analysis.expectedResult,
          also_affects: analysis.alsoAffects,
          missing_data: analysis.missingData,
          setup_name: setupQ.data?.name ?? null,
          car_id: effectiveCar ?? null,
          status,
          actual_adjustment: null,
          actual_result: null,
        },
        occurred_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: (_d, status) => {
      toast.success(
        status === "proposed" ? "Saved as a proposed test" : "Recommendation dismissed",
      );
      qc.invalidateQueries({ queryKey: ["assistant-recommendations"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const recordActual = useMutation({
    mutationFn: async ({
      id,
      adjustment,
      result,
    }: {
      id: string;
      adjustment: string;
      result: string;
    }) => {
      const row = (savedQ.data ?? []).find((r) => r.id === id);
      if (!row || !effectiveCar) throw new Error("Recommendation unavailable for this car");
      const { error } = await supabase
        .from("timeline_events")
        .update({
          metadata: {
            ...(row?.metadata ?? {}),
            status: "verified",
            actual_adjustment: adjustment,
            actual_result: result,
          },
        })
        .eq("id", id)
        .eq("metadata->>car_id", effectiveCar);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Actual result recorded — now a verified result");
      qc.invalidateQueries({ queryKey: ["assistant-recommendations"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  if (!activeCar) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
        <Stethoscope className="w-8 h-8 mx-auto mb-3 opacity-60" />
        Select a car (and ideally an active weekend) so the assistant can review recorded setup and
        tyre data.
      </div>
    );
  }

  const setCond = (k: keyof ConditionInput, v: string) =>
    setConditions((c) => ({ ...c, [k]: v === "unset" ? undefined : v }));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-primary" />
          <div className="font-display font-bold">Handling issue assistant</div>
        </div>
        <p className="text-xs text-muted-foreground">
          Reviews{" "}
          <strong>{setupQ.data ? `setup “${setupQ.data.name}”` : "your recorded setup"}</strong>
          {tyreQ.data ? ", the latest tyre log" : ""}
          {sessionsQ.data
            ? ` and ${sessionsQ.data} recorded session${sessionsQ.data === 1 ? "" : "s"}`
            : ""}{" "}
          for {activeCar.name}. It proposes one test at a time — it never changes your setup.
        </p>

        {/* HANDLING ISSUE */}
        <Section title="Handling issue">
          <Select
            value={issueId}
            onValueChange={(v) => {
              setIssueId(v as IssueId);
              setAnalysis(null);
              setSafetyAck(false);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="What is the car doing?" />
            </SelectTrigger>
            <SelectContent>
              {HANDLING_ISSUES.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.label}
                  {i.safetyCritical ? " ⚠" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Section>

        {/* CONDITIONS */}
        <Section title="When does it happen?">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Select
              value={conditions.cornerSpeed ?? "unset"}
              onValueChange={(v) => setCond("cornerSpeed", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Corner speed" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Corner speed…</SelectItem>
                {CORNER_SPEEDS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={conditions.brakingPhase ?? "unset"}
              onValueChange={(v) => setCond("brakingPhase", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Braking phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Braking phase…</SelectItem>
                {BRAKING_PHASES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={conditions.throttlePosition ?? "unset"}
              onValueChange={(v) => setCond("throttlePosition", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Throttle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Throttle…</SelectItem>
                {THROTTLE_POSITIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={conditions.tyreCondition ?? "unset"}
              onValueChange={(v) => setCond("tyreCondition", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tyre condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Tyre condition…</SelectItem>
                {TYRE_CONDITIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="col-span-2"
              placeholder="Track conditions (dry, damp, dusty…)"
              maxLength={80}
              value={conditions.trackConditions ?? ""}
              onChange={(e) =>
                setConditions((c) => ({ ...c, trackConditions: e.target.value || undefined }))
              }
            />
          </div>
        </Section>

        <Button
          disabled={
            !input ||
            setupQ.isLoading ||
            tyreQ.isLoading ||
            sessionsQ.isLoading ||
            sessionQ.isLoading ||
            setupQ.isError ||
            tyreQ.isError
          }
          onClick={() => input && setAnalysis(analyzeHandlingIssue(input))}
          className="w-full sm:w-auto"
        >
          <FlaskConical className="w-4 h-4 mr-1.5" /> Analyse with recorded data
        </Button>
      </div>

      {analysis && (
        <div className="rounded-lg border border-primary/40 bg-card p-4 space-y-3">
          {analysis.safetyNote && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{analysis.safetyNote}</span>
            </div>
          )}

          <Section title="Possible causes">
            <ol className="space-y-2 text-sm list-decimal list-inside">
              {analysis.causes.map((c) => (
                <li key={c.id}>
                  {c.text}
                  {c.evidence && (
                    <div className="text-[11px] font-mono text-muted-foreground ml-5 mt-0.5">
                      {c.evidence}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Recommended test">
            <p className="text-sm font-medium">{analysis.recommendedTest}</p>
          </Section>

          <Section title="Expected result">
            <p className="text-sm">{analysis.expectedResult}</p>
            <p className="text-xs text-muted-foreground mt-1">Also watch: {analysis.alsoAffects}</p>
          </Section>

          {analysis.missingData.length > 0 && (
            <Section title="Information missing" tone="warn">
              <ul className="text-xs space-y-1 list-disc list-inside">
                {analysis.missingData.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </Section>
          )}

          <div className="text-[11px] text-muted-foreground">
            Reviewed:{" "}
            {analysis.dataConsidered.length
              ? analysis.dataConsidered.join(" · ")
              : "no recorded data available yet"}
          </div>
          <div className="text-[11px] italic text-muted-foreground">{RECOMMENDATION_NOTE}</div>

          {analysis.issue.safetyCritical && (
            <label className="flex items-start gap-2 text-xs rounded-md border border-border p-2 cursor-pointer">
              <Checkbox
                checked={safetyAck}
                onCheckedChange={(v) => setSafetyAck(v === true)}
                className="mt-0.5"
              />
              <span>
                I understand this changes braking, suspension or stability behaviour and I will test
                it gradually.
              </span>
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => save.mutate("proposed")}
              disabled={save.isPending || (analysis.issue.safetyCritical && !safetyAck)}
            >
              <Save className="w-4 h-4 mr-1.5" /> Save as proposed test
            </Button>
            <Button
              variant="outline"
              onClick={() => save.mutate("rejected")}
              disabled={save.isPending}
            >
              <XCircle className="w-4 h-4 mr-1.5" /> Reject
            </Button>
          </div>
        </div>
      )}

      {/* Saved recommendations — proposed vs verified */}
      {(savedQ.data ?? []).length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Saved recommendations
          </div>
          {(savedQ.data ?? []).map((r) => (
            <SavedCard
              key={r.id}
              rec={r}
              onRecord={(adjustment, result) =>
                recordActual.mutate({ id: r.id, adjustment, result })
              }
              pending={recordActual.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SavedCard({
  rec,
  onRecord,
  pending,
}: {
  rec: SavedRecommendation;
  onRecord: (adj: string, res: string) => void;
  pending: boolean;
}) {
  const [adj, setAdj] = useState("");
  const [res, setRes] = useState("");
  const [open, setOpen] = useState(false);
  const status = rec.metadata?.status ?? "proposed";
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-medium">{rec.metadata?.issue_label ?? rec.title}</div>
        <Badge
          variant="outline"
          className={
            status === "verified"
              ? "text-emerald-500 border-emerald-500/40"
              : status === "rejected"
                ? "text-muted-foreground"
                : "text-primary border-primary/40"
          }
        >
          {status === "verified"
            ? "Verified result"
            : status === "rejected"
              ? "Rejected"
              : "Proposed test"}
        </Badge>
      </div>
      {rec.metadata?.recommended_test && (
        <div className="text-xs text-muted-foreground">Test: {rec.metadata.recommended_test}</div>
      )}
      {status === "verified" && (
        <div className="text-xs space-y-1">
          <div>
            <span className="font-mono uppercase text-[10px] text-muted-foreground">
              Actual adjustment:{" "}
            </span>
            {rec.metadata?.actual_adjustment}
          </div>
          <div>
            <span className="font-mono uppercase text-[10px] text-muted-foreground">
              Actual result:{" "}
            </span>
            {rec.metadata?.actual_result}
          </div>
          <Link
            to="/sessions-compare"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <GitCompare className="w-3 h-3" /> Compare the before/after sessions
          </Link>
        </div>
      )}
      {status === "proposed" && !open && (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Record actual adjustment & result
        </Button>
      )}
      {status === "proposed" && open && (
        <div className="space-y-2">
          <Input
            placeholder="What did you actually change?"
            maxLength={200}
            value={adj}
            onChange={(e) => setAdj(e.target.value)}
          />
          <Textarea
            placeholder="What happened in the next session?"
            maxLength={500}
            value={res}
            onChange={(e) => setRes(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending || !adj.trim() || !res.trim()}
              onClick={() => onRecord(adj.trim(), res.trim())}
            >
              Save verified result
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
