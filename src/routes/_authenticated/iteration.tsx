import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GitBranch, Plus, ArrowRight, CheckCircle2, XCircle, CircleDot,
  ClipboardCheck, Wand2, Gauge, Disc, Wind, Mountain, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { formatLapTime } from "@/lib/lap-time";

export const Route = createFileRoute("/_authenticated/iteration")({
  component: IterationPage,
});

type Car = { id: string; name: string };
type Setup = { id: string; name: string; car_id: string; track: string | null; updated_at: string };
type Session = { id: string; name: string; started_at: string };

type ChangeRow = {
  id: string;
  car_id: string;
  setup_id: string;
  parent_setup_id: string | null;
  session_id: string | null;
  area: string;
  summary: string;
  reason: string | null;
  expected_effect: string | null;
  changes: Record<string, { from: string | number | null; to: string | number | null }>;
  outcome_status: "pending" | "confirmed" | "partial" | "rejected";
  outcome_notes: string | null;
  driver_response: string | null;
  lap_delta_ms: number | null;
  confidence_delta: number | null;
  measured_at: string | null;
  created_at: string;
};

const AREAS = [
  { id: "balance",  label: "Balance",   icon: Gauge },
  { id: "tyre",     label: "Tyre",      icon: Disc },
  { id: "brake",    label: "Brake",     icon: CircleDot },
  { id: "aero",     label: "Aero",      icon: Wind },
  { id: "damper",   label: "Damper",    icon: Settings2 },
  { id: "spring",   label: "Spring/ARB", icon: Settings2 },
  { id: "geometry", label: "Geometry",  icon: Settings2 },
  { id: "diff",     label: "Diff",      icon: Settings2 },
  { id: "kerb",     label: "Kerb/ride", icon: Mountain },
  { id: "other",    label: "Other",     icon: Wand2 },
] as const;

const OUTCOME_META: Record<ChangeRow["outcome_status"], { label: string; tone: string; Icon: React.ComponentType<{ className?: string }> }> = {
  pending:   { label: "Pending run",  tone: "border-border bg-muted/30 text-muted-foreground", Icon: CircleDot },
  confirmed: { label: "Confirmed",    tone: "border-primary/40 bg-primary/10 text-primary",     Icon: CheckCircle2 },
  partial:   { label: "Partial",      tone: "border-accent/50 bg-accent/15 text-accent",        Icon: ClipboardCheck },
  rejected:  { label: "Rejected",     tone: "border-destructive/50 bg-destructive/15 text-destructive", Icon: XCircle },
};

function IterationPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const carsQ = useQuery({
    queryKey: ["iteration-cars", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id,name").order("created_at");
      if (error) throw error;
      return data as Car[];
    },
    enabled: !!user,
  });

  const [carId, setCarId] = useState<string>("");
  useEffect(() => {
    if (!carId && carsQ.data?.length) setCarId(carsQ.data[0].id);
  }, [carsQ.data, carId]);

  const setupsQ = useQuery({
    queryKey: ["iteration-setups", carId],
    enabled: !!carId,
    queryFn: async () => {
      const { data, error } = await supabase.from("setups")
        .select("id,name,car_id,track,updated_at")
        .eq("car_id", carId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Setup[];
    },
  });

  const sessionsQ = useQuery({
    queryKey: ["iteration-sessions", carId],
    enabled: !!carId,
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions")
        .select("id,name,started_at,car_id")
        .eq("car_id", carId)
        .order("started_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as Session[];
    },
  });

  const changesQ = useQuery({
    queryKey: ["setup-changes", carId],
    enabled: !!carId,
    queryFn: async () => {
      const { data, error } = await supabase.from("setup_changes")
        .select("*")
        .eq("car_id", carId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ChangeRow[];
    },
  });

  // Quick stats
  const stats = useMemo(() => {
    const rows = changesQ.data ?? [];
    return {
      total: rows.length,
      pending: rows.filter((r) => r.outcome_status === "pending").length,
      confirmed: rows.filter((r) => r.outcome_status === "confirmed").length,
      gain: rows
        .filter((r) => r.outcome_status === "confirmed" && r.lap_delta_ms != null && r.lap_delta_ms < 0)
        .reduce((acc, r) => acc + (r.lap_delta_ms ?? 0), 0),
    };
  }, [changesQ.data]);

  return (
    <div>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary inline-flex items-center gap-1">
            <GitBranch className="w-3 h-3" /> Engineering memory
          </div>
          <h1 className="font-display text-4xl font-bold mt-1">Setup iteration</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Every setup change carries a <span className="text-foreground">reason</span> → <span className="text-foreground">expected effect</span> → <span className="text-foreground">measured outcome</span> trail. Build a real engineering record across the weekend.
          </p>
        </div>
        <div className="min-w-[220px]">
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Car</Label>
          <Select value={carId} onValueChange={setCarId}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a car" /></SelectTrigger>
            <SelectContent>
              {(carsQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <Stat label="Iterations" value={String(stats.total)} />
        <Stat label="Pending run" value={String(stats.pending)} />
        <Stat label="Confirmed" value={String(stats.confirmed)} />
        <Stat label="Cumulative gain" value={stats.gain ? formatLapTime(Math.abs(stats.gain)) : "—"} hint={stats.gain ? "vs prior baseline" : undefined} />
      </div>

      <div className="grid lg:grid-cols-[420px_1fr] gap-6 mt-8">
        <LogChangeForm
          carId={carId}
          userId={user?.id}
          setups={setupsQ.data ?? []}
          sessions={sessionsQ.data ?? []}
          onSaved={() => qc.invalidateQueries({ queryKey: ["setup-changes", carId] })}
        />
        <HistoryColumn
          rows={changesQ.data ?? []}
          setups={setupsQ.data ?? []}
          sessions={sessionsQ.data ?? []}
          loading={changesQ.isLoading}
          onUpdated={() => qc.invalidateQueries({ queryKey: ["setup-changes", carId] })}
        />
      </div>
    </div>
  );
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

function LogChangeForm({
  carId, userId, setups, sessions, onSaved,
}: {
  carId: string;
  userId: string | undefined;
  setups: Setup[];
  sessions: Session[];
  onSaved: () => void;
}) {
  const [setupId, setSetupId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("none");
  const [area, setArea] = useState<string>("balance");
  const [summary, setSummary] = useState("");
  const [reason, setReason] = useState("");
  const [expected, setExpected] = useState("");
  const [changesText, setChangesText] = useState(""); // "front ARB: 3 → 4"

  useEffect(() => {
    if (!setupId && setups.length) setSetupId(setups[0].id);
    if (setupId && !setups.find((s) => s.id === setupId)) setSetupId(setups[0]?.id ?? "");
  }, [setups, setupId]);

  const parseChanges = (txt: string): Record<string, { from: string; to: string }> => {
    const out: Record<string, { from: string; to: string }> = {};
    txt.split("\n").map((l) => l.trim()).filter(Boolean).forEach((line) => {
      // "label: from → to"  also accepts -> and =>
      const m = line.match(/^(.+?)\s*:\s*(.+?)\s*(?:→|->|=>)\s*(.+)$/);
      if (m) out[m[1].trim()] = { from: m[2].trim(), to: m[3].trim() };
    });
    return out;
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      if (!carId) throw new Error("Pick a car");
      if (!setupId) throw new Error("Pick a setup");
      if (summary.trim().length < 3) throw new Error("Add a short summary");
      const { error } = await supabase.from("setup_changes").insert({
        user_id: userId,
        car_id: carId,
        setup_id: setupId,
        session_id: sessionId === "none" ? null : sessionId,
        area,
        summary: summary.trim(),
        reason: reason.trim() || null,
        expected_effect: expected.trim() || null,
        changes: parseChanges(changesText),
        outcome_status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Change logged");
      setSummary(""); setReason(""); setExpected(""); setChangesText("");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  return (
    <div className="rounded-lg border border-border bg-card shadow-card p-5 h-fit sticky top-16">
      <div className="flex items-center gap-2 mb-4">
        <Plus className="w-4 h-4 text-primary" />
        <h2 className="font-display text-lg font-bold uppercase tracking-wider">Log change</h2>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Setup</Label>
          <Select value={setupId} onValueChange={setSetupId} disabled={!setups.length}>
            <SelectTrigger className="mt-1"><SelectValue placeholder={setups.length ? "Pick a setup" : "No setups yet"} /></SelectTrigger>
            <SelectContent>
              {setups.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}{s.track ? ` · ${s.track}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Area</Label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AREAS.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Session</Label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Summary</Label>
          <Input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Soften rear rebound 1 click"
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Reason</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rear stepping out over kerbs in T7, rebound feels overdamped"
            rows={2}
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Expected effect</Label>
          <Textarea
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            placeholder="Better rear platform on kerb release, mid-corner rotation unchanged"
            rows={2}
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Changes <span className="text-muted-foreground/70 normal-case font-sans">— one per line, format: <code className="text-[10px]">label: from → to</code></span>
          </Label>
          <Textarea
            value={changesText}
            onChange={(e) => setChangesText(e.target.value)}
            placeholder={"Rear rebound: 8 → 7\nRear ride height: 60 → 62"}
            rows={3}
            className="mt-1 font-mono text-xs"
          />
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full shadow-glow">
          {save.isPending ? "Logging…" : "Log change"}
        </Button>
      </div>
    </div>
  );
}

function HistoryColumn({
  rows, setups, sessions, loading, onUpdated,
}: {
  rows: ChangeRow[];
  setups: Setup[];
  sessions: Session[];
  loading: boolean;
  onUpdated: () => void;
}) {
  const setupName = (id: string) => setups.find((s) => s.id === id)?.name ?? "Unknown setup";
  const sessionName = (id: string | null) => id ? sessions.find((s) => s.id === id)?.name ?? null : null;

  if (loading) {
    return <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Loading engineering memory…</div>;
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-10 text-center">
        <GitBranch className="w-8 h-8 mx-auto text-muted-foreground/60" />
        <div className="font-display text-lg font-bold mt-3">No iterations yet</div>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Log the first change for this car. Even a single click of rear rebound deserves a reason and an expected effect — that's how the weekend builds memory.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/baseline" className="text-primary hover:underline">Generate a baseline</Link>
          <ArrowRight className="w-3 h-3" />
          <Link to="/setups" className="text-primary hover:underline">Open a setup</Link>
          <ArrowRight className="w-3 h-3" />
          <span>Log first change</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <ChangeCard
          key={r.id}
          row={r}
          setupName={setupName(r.setup_id)}
          sessionName={sessionName(r.session_id)}
          onUpdated={onUpdated}
        />
      ))}
    </div>
  );
}

function ChangeCard({
  row, setupName, sessionName, onUpdated,
}: {
  row: ChangeRow;
  setupName: string;
  sessionName: string | null;
  onUpdated: () => void;
}) {
  const meta = OUTCOME_META[row.outcome_status];
  const AreaIcon = AREAS.find((a) => a.id === row.area)?.icon ?? Wand2;
  const [open, setOpen] = useState(false);
  const [lapDelta, setLapDelta] = useState<string>(row.lap_delta_ms != null ? String(row.lap_delta_ms / 1000) : "");
  const [confDelta, setConfDelta] = useState<string>(row.confidence_delta != null ? String(row.confidence_delta) : "");
  const [notes, setNotes] = useState<string>(row.outcome_notes ?? "");
  const [driverResponse, setDriverResponse] = useState<string>(row.driver_response ?? "");
  const [status, setStatus] = useState<ChangeRow["outcome_status"]>(row.outcome_status);

  const recordOutcome = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("setup_changes").update({
        outcome_status: status,
        outcome_notes: notes.trim() || null,
        driver_response: driverResponse.trim() || null,
        lap_delta_ms: lapDelta === "" ? null : Math.round(parseFloat(lapDelta) * 1000),
        confidence_delta: confDelta === "" ? null : parseInt(confDelta, 10),
        measured_at: new Date().toISOString(),
      }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Outcome recorded"); setOpen(false); onUpdated(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("setup_changes").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); onUpdated(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const changeEntries = Object.entries(row.changes ?? {});

  return (
    <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
      <div className="px-4 py-3 flex items-start gap-3 border-b border-border/60">
        <div className="mt-0.5 w-9 h-9 rounded-md border border-border bg-muted/40 flex items-center justify-center text-primary">
          <AreaIcon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-display text-base font-bold leading-tight">{row.summary}</div>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase tracking-widest ${meta.tone}`}>
              <meta.Icon className="w-3 h-3" /> {meta.label}
            </span>
          </div>
          <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
            <Link to="/setups/$setupId" params={{ setupId: row.setup_id }} className="hover:text-primary">{setupName}</Link>
            {sessionName && <> · {sessionName}</>}
            <> · {new Date(row.created_at).toLocaleDateString()}</>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 grid md:grid-cols-2 gap-3 text-sm">
        <Trail label="Reason"          value={row.reason} placeholder="No reason recorded" />
        <Trail label="Expected effect" value={row.expected_effect} placeholder="No expectation recorded" />
      </div>

      {changeEntries.length > 0 && (
        <div className="px-4 pb-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Adjustments</div>
          <div className="flex flex-wrap gap-1.5">
            {changeEntries.map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 rounded border border-border bg-muted/30 px-2 py-0.5 text-xs font-mono">
                <span className="text-muted-foreground">{k}:</span>
                <span>{String(v?.from ?? "—")}</span>
                <ArrowRight className="w-3 h-3 text-primary" />
                <span className="text-foreground">{String(v?.to ?? "—")}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {row.outcome_status !== "pending" && (
        <div className="px-4 pb-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Measured outcome</div>
          <div className="flex flex-wrap gap-3 text-sm">
            {row.lap_delta_ms != null && (
              <Metric label="Lap delta" value={`${row.lap_delta_ms <= 0 ? "−" : "+"}${formatLapTime(Math.abs(row.lap_delta_ms))}`} tone={row.lap_delta_ms < 0 ? "good" : row.lap_delta_ms > 0 ? "bad" : "neutral"} />
            )}
            {row.confidence_delta != null && (
              <Metric label="Confidence" value={`${row.confidence_delta > 0 ? "+" : ""}${row.confidence_delta}`} tone={row.confidence_delta > 0 ? "good" : row.confidence_delta < 0 ? "bad" : "neutral"} />
            )}
          </div>
          {row.outcome_notes && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{row.outcome_notes}</p>}
        </div>
      )}

      <div className="px-4 py-2 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : row.outcome_status === "pending" ? "Record outcome" : "Update outcome"}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
          Delete
        </Button>
      </div>

      {open && (
        <div className="px-4 py-3 border-t border-border/60 bg-background/40 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ChangeRow["outcome_status"])}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Lap Δ (s)</Label>
              <Input
                type="number" step="0.01" inputMode="decimal" placeholder="-0.35"
                value={lapDelta} onChange={(e) => setLapDelta(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Confidence Δ</Label>
              <Input
                type="number" step="1" inputMode="numeric" placeholder="+1"
                value={confDelta} onChange={(e) => setConfDelta(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Outcome notes</Label>
            <Textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Rear platform calmer over kerbs, no loss mid-corner. Kept the change."
              className="mt-1"
            />
          </div>
          <Button size="sm" onClick={() => recordOutcome.mutate()} disabled={recordOutcome.isPending}>
            {recordOutcome.isPending ? "Saving…" : "Save outcome"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Trail({ label, value, placeholder }: { label: string; value: string | null; placeholder: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm whitespace-pre-wrap ${value ? "text-foreground" : "text-muted-foreground/60 italic"}`}>
        {value || placeholder}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" | "neutral" }) {
  const cls = tone === "good"
    ? "border-primary/40 bg-primary/10 text-primary"
    : tone === "bad"
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : "border-border bg-muted/30 text-muted-foreground";
  return (
    <div className={`inline-flex items-center gap-2 rounded border px-2 py-1 ${cls}`}>
      <span className="text-[10px] font-mono uppercase tracking-widest opacity-80">{label}</span>
      <span className="font-display font-bold">{value}</span>
    </div>
  );
}