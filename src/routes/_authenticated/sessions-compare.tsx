import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useActiveWeekend } from "@/lib/active-weekend";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, GitCompare, Save, TriangleAlert as AlertTriangle, Download } from "lucide-react";
import { exportComparisonPdf } from "@/lib/compare-pdf";
import { toast } from "sonner";
import { formatLapTime } from "@/lib/lap-time";
import {
  diffSetupData,
  lapStats,
  comparePerformance,
  buildWhatImproved,
  formatDeltaMs,
  CORRELATION_NOTE,
  type LapRow,
  type SetupData,
} from "@/lib/session-compare";

type Search = { a?: string; b?: string };

export const Route = createFileRoute("/_authenticated/sessions-compare")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    a: typeof s.a === "string" ? s.a : undefined,
    b: typeof s.b === "string" ? s.b : undefined,
  }),
  head: () => ({ meta: [
    { title: "Compare Sessions | My Race Engineer" },
    { name: "description", content: "Compare two sessions side by side: setup changes, lap times and conditions in My Race Engineer." },
    { property: "og:title", content: "Compare Sessions | My Race Engineer" },
    { property: "og:description", content: "Compare two sessions side by side: setup changes, lap times and conditions in My Race Engineer." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CompareSessionsPage,
});

type SessionRow = {
  id: string; name: string; session_type: string; car_id: string; setup_id: string | null;
  track: string | null; weather: string | null;
  air_temp_c: number | null; track_temp_c: number | null;
  fuel_start_l: number | null; fuel_end_l: number | null;
  started_at: string;
};
type SetupRow = { id: string; name: string; setup_data: SetupData };
type TyreRow = { compound: string | null; tire_set: string; tread_fl: number | null; tread_fr: number | null; tread_rl: number | null; tread_rr: number | null; recorded_at: string };
type FeedbackRow = { id: string; corner: string | null; category: string; description: string; severity: string };

function CompareSessionsPage() {
  const { user } = useAuth();
  const { activeCar } = useActiveWeekend();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [carId, setCarId] = useState<string>("");
  const [testNext, setTestNext] = useState("");
  const initedRef = useRef(false);

  // Default the car filter to the active car once it loads.
  useEffect(() => {
    if (!initedRef.current && activeCar?.id) {
      initedRef.current = true;
      setCarId(activeCar.id);
    }
  }, [activeCar]);

  const carsQ = useQuery({
    queryKey: ["cars-mini", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id,name").order("created_at");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
    enabled: !!user,
  });

  const sessionsQ = useQuery({
    queryKey: ["sessions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions").select("*").order("started_at", { ascending: false });
      if (error) throw error;
      return data as SessionRow[];
    },
    enabled: !!user,
  });

  const carSessions = useMemo(
    () => (sessionsQ.data ?? []).filter((s) => !carId || s.car_id === carId),
    [sessionsQ.data, carId],
  );
  const sessionA = carSessions.find((s) => s.id === search.a) ?? null;
  const sessionB = carSessions.find((s) => s.id === search.b) ?? null;
  const bothPicked = !!(sessionA && sessionB && sessionA.id !== sessionB.id);

  const setupsQ = useQuery({
    queryKey: ["compare-setups", sessionA?.setup_id, sessionB?.setup_id],
    queryFn: async () => {
      const ids = [sessionA?.setup_id, sessionB?.setup_id].filter((x): x is string => !!x);
      if (ids.length === 0) return [] as SetupRow[];
      const { data, error } = await supabase.from("setups").select("id,name,setup_data").in("id", ids);
      if (error) throw error;
      return data as SetupRow[];
    },
    enabled: bothPicked,
  });

  const lapsQ = useQuery({
    queryKey: ["compare-laps", search.a, search.b],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("laps")
        .select("session_id,lap_time_ms,sector_1_ms,sector_2_ms,sector_3_ms")
        .in("session_id", [search.a!, search.b!]);
      if (error) throw error;
      return data as (LapRow & { session_id: string })[];
    },
    enabled: bothPicked,
  });

  const tyresQ = useQuery({
    queryKey: ["compare-tyres", search.a, search.b],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tire_logs")
        .select("session_id,compound,tire_set,tread_fl,tread_fr,tread_rl,tread_rr,recorded_at")
        .in("session_id", [search.a!, search.b!])
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return data as (TyreRow & { session_id: string })[];
    },
    enabled: bothPicked,
  });

  const feedbackQ = useQuery({
    queryKey: ["compare-feedback", search.a, search.b],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_feedback")
        .select("id,session_id,corner,category,description,severity")
        .in("session_id", [search.a!, search.b!])
        .order("recorded_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data as (FeedbackRow & { session_id: string })[];
    },
    enabled: bothPicked,
  });

  const setupA = setupsQ.data?.find((s) => s.id === sessionA?.setup_id) ?? null;
  const setupB = setupsQ.data?.find((s) => s.id === sessionB?.setup_id) ?? null;

  const diffRows = useMemo(
    () => (setupA && setupB ? diffSetupData(setupA.setup_data ?? {}, setupB.setup_data ?? {}) : []),
    [setupA, setupB],
  );
  const changedRows = diffRows.filter((r) => r.changed);

  const statsA = useMemo(() => lapStats((lapsQ.data ?? []).filter((l) => l.session_id === search.a)), [lapsQ.data, search.a]);
  const statsB = useMemo(() => lapStats((lapsQ.data ?? []).filter((l) => l.session_id === search.b)), [lapsQ.data, search.b]);
  const perfDeltas = useMemo(() => comparePerformance(statsA, statsB), [statsA, statsB]);
  const improvedLines = useMemo(
    () => (sessionA && sessionB ? buildWhatImproved(perfDeltas, sessionA.name, sessionB.name) : []),
    [perfDeltas, sessionA, sessionB],
  );

  const latestTyre = (sid: string) => (tyresQ.data ?? []).find((t) => t.session_id === sid) ?? null;
  const feedbackFor = (sid: string) => (feedbackQ.data ?? []).filter((f) => f.session_id === sid);

  const save = useMutation({
    mutationFn: async () => {
      if (!sessionA || !sessionB || !user) throw new Error("Pick two sessions first");
      const { error } = await supabase.from("timeline_events").insert({
        user_id: user.id,
        session_id: sessionB.id,
        type: "session_comparison",
        title: `Compared ${sessionA.name} vs ${sessionB.name}`,
        description: testNext.trim() || null,
        metadata: {
          session_a_id: sessionA.id,
          session_b_id: sessionB.id,
          changes: changedRows.map((r) => ({ key: r.key, label: r.label, a: r.a, b: r.b })),
          performance: perfDeltas.map((d) => ({ label: d.label, deltaMs: d.deltaMs })),
          test_next: testNext.trim() || null,
        },
        occurred_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comparison saved to session history");
      setTestNext("");
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const pick = (key: "a" | "b", value: string) => {
    navigate({
      to: "/sessions-compare",
      search: (prev: Search) => ({ ...prev, [key]: value === "none" ? undefined : value }),
      replace: true,
    });
  };

  const sessionLabel = (s: SessionRow) =>
    `${s.name} · ${s.session_type}${s.track ? ` · ${s.track}` : ""}`;

  return (
    <div>
      <Link to="/sessions" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to sessions
      </Link>
      <div className="mt-4">
        <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
          <GitCompare className="w-3 h-3" /> Trackside
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1">Compare sessions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick two sessions from the same car to see what changed and what it coincided with.
        </p>
      </div>

      {/* Pickers: car → session A → session B */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3 rounded-lg border border-border bg-card p-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Car</div>
          <Select value={carId} onValueChange={(v) => { setCarId(v); navigate({ to: "/sessions-compare", search: {}, replace: true }); }}>
            <SelectTrigger><SelectValue placeholder="Pick a car" /></SelectTrigger>
            <SelectContent>
              {(carsQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Session A (baseline)</div>
          <Select value={search.a ?? "none"} onValueChange={(v) => pick("a", v)} disabled={!carId}>
            <SelectTrigger><SelectValue placeholder="Pick session" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— none —</SelectItem>
              {carSessions.filter((s) => s.id !== search.b).map((s) => (
                <SelectItem key={s.id} value={s.id}>{sessionLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Session B (comparison)</div>
          <Select value={search.b ?? "none"} onValueChange={(v) => pick("b", v)} disabled={!carId}>
            <SelectTrigger><SelectValue placeholder="Pick session" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— none —</SelectItem>
              {carSessions.filter((s) => s.id !== search.a).map((s) => (
                <SelectItem key={s.id} value={s.id}>{sessionLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!bothPicked && (
        <div className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          <GitCompare className="w-8 h-8 mx-auto mb-3 opacity-60" />
          {carSessions.length < 2 && carId
            ? "This car needs at least two recorded sessions to compare."
            : "Pick a car and two sessions above to start comparing."}
        </div>
      )}

      {bothPicked && sessionA && sessionB && (
        <div className="mt-6 space-y-6">
          {/* Conditions side by side */}
          <div className="grid gap-3 sm:grid-cols-2">
            {([sessionA, sessionB] as const).map((s, i) => (
              <div key={s.id} className="rounded-lg border border-border bg-card p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Session {i === 0 ? "A" : "B"}</div>
                <div className="font-display font-bold uppercase tracking-tight mt-1">{s.name}</div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Track</span><span>{s.track ?? "not recorded"}</span>
                  <span className="text-muted-foreground">Weather</span><span>{s.weather ?? "not recorded"}</span>
                  <span className="text-muted-foreground">Air temp</span><span>{s.air_temp_c != null ? `${s.air_temp_c}°C` : "not recorded"}</span>
                  <span className="text-muted-foreground">Track temp</span><span>{s.track_temp_c != null ? `${s.track_temp_c}°C` : "not recorded"}</span>
                  <span className="text-muted-foreground">Fuel start</span><span>{s.fuel_start_l != null ? `${s.fuel_start_l}L` : "not recorded"}</span>
                  <span className="text-muted-foreground">Tyres</span>
                  <span>
                    {latestTyre(s.id)
                      ? `${latestTyre(s.id)!.compound ?? "unknown compound"} · ${latestTyre(s.id)!.tire_set}`
                      : "not recorded"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* WHAT CHANGED */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-display text-lg font-bold uppercase tracking-wider">What changed?</h2>
            {!setupA || !setupB ? (
              <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary" />
                {!setupA && !setupB
                  ? "Neither session has a setup recorded — setup comparison unavailable."
                  : `${!setupA ? sessionA.name : sessionB.name} has no setup recorded, so changes can't be identified.`}
              </p>
            ) : changedRows.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No setup differences recorded between {setupA.name} and {setupB.name}.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {changedRows.map((r) => (
                  <li key={r.key} className="flex flex-wrap items-baseline gap-x-2 text-sm rounded-md bg-primary/10 border border-primary/30 px-3 py-1.5">
                    <span className="font-medium">{r.label}</span>
                    <span className="font-mono text-muted-foreground">{r.a ?? "not recorded"}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono font-bold text-primary">{r.b ?? "not recorded"}</span>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground ml-auto">{r.group}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Side-by-side setup table */}
          {setupA && setupB && diffRows.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 pt-4">
                <h2 className="font-display text-lg font-bold uppercase tracking-wider">Setups side by side</h2>
                <p className="text-xs text-muted-foreground mt-1">{setupA.name} vs {setupB.name} — changed values highlighted.</p>
              </div>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">Setting</th>
                      <th className="text-right px-3 py-2">{setupA.name}</th>
                      <th className="text-right px-3 py-2">{setupB.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffRows.map((r) => (
                      <tr key={r.key} className={`border-t border-border ${r.changed ? "bg-primary/10" : ""}`}>
                        <td className="px-3 py-1.5">
                          <span className={r.changed ? "font-medium" : "text-muted-foreground"}>{r.label}</span>
                        </td>
                        <td className={`px-3 py-1.5 text-right font-mono ${r.changed ? "font-bold" : "text-muted-foreground"}`}>
                          {r.a ?? <span className="text-[10px] uppercase tracking-widest">not recorded</span>}
                        </td>
                        <td className={`px-3 py-1.5 text-right font-mono ${r.changed ? "font-bold text-primary" : "text-muted-foreground"}`}>
                          {r.b ?? <span className="text-[10px] uppercase tracking-widest">not recorded</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Performance */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 pt-4">
              <h2 className="font-display text-lg font-bold uppercase tracking-wider">Performance</h2>
            </div>
            {statsA.count === 0 || statsB.count === 0 ? (
              <p className="px-4 pb-4 mt-2 text-sm text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary" />
                {statsA.count === 0 && statsB.count === 0
                  ? "No laps recorded in either session."
                  : `No laps recorded in ${statsA.count === 0 ? sessionA.name : sessionB.name} — lap-time comparison incomplete.`}
              </p>
            ) : (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">Measure</th>
                      <th className="text-right px-3 py-2">{sessionA.name}</th>
                      <th className="text-right px-3 py-2">{sessionB.name}</th>
                      <th className="text-right px-3 py-2">Δ (B−A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfDeltas.map((d) => (
                      <tr key={d.label} className="border-t border-border">
                        <td className="px-3 py-1.5 text-muted-foreground">{d.label}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{d.aMs != null ? formatLapTime(d.aMs) : "—"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{d.bMs != null ? formatLapTime(d.bMs) : "—"}</td>
                        <td className={`px-3 py-1.5 text-right font-mono font-bold ${d.deltaMs == null ? "" : d.deltaMs < 0 ? "text-primary" : d.deltaMs > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {d.deltaMs != null ? formatDeltaMs(d.deltaMs) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Driver feedback side by side */}
          {(feedbackFor(sessionA.id).length > 0 || feedbackFor(sessionB.id).length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {([sessionA, sessionB] as const).map((s) => (
                <div key={s.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Driver feedback · {s.name}</div>
                  {feedbackFor(s.id).length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">None recorded.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {feedbackFor(s.id).map((f) => (
                        <li key={f.id} className="rounded-md border border-border px-2.5 py-1.5">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                            {f.category}{f.corner ? ` · ${f.corner}` : ""}
                          </span>
                          <div>{f.description}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* WHAT IMPROVED */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-display text-lg font-bold uppercase tracking-wider">What improved?</h2>
            {improvedLines.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No measurable lap-time differences between these sessions.</p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {improvedLines.map((l) => <li key={l} className="font-mono">{l}</li>)}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted-foreground border-t border-border pt-3">{CORRELATION_NOTE}</p>
          </div>

          {/* WHAT SHOULD WE TEST NEXT */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-display text-lg font-bold uppercase tracking-wider">What should we test next?</h2>
            <p className="text-xs text-muted-foreground mt-1">Record one proposed adjustment for the next session.</p>
            <Textarea
              value={testNext}
              onChange={(e) => setTestNext(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="e.g. Try front compression back at 4 with the higher pressures to separate the two changes."
              className="mt-3"
            />
            <Button
              variant="outline"
              className="mt-3 mr-2"
              disabled={!sessionA || !sessionB}
              onClick={() => sessionA && sessionB && exportComparisonPdf({
                nameA: sessionA.name, nameB: sessionB.name,
                changes: changedRows, perf: perfDeltas, testNext: testNext.trim() || null,
              })}
            >
              <Download className="w-4 h-4 mr-1" /> Export PDF
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="mt-3">
              <Save className="w-4 h-4 mr-1" /> Save comparison to session history
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
