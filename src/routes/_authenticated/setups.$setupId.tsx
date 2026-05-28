import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Loader2, Sparkles, AlertTriangle, Timer, Trash2, Plus, Trophy, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getDiscipline } from "@/lib/disciplines";
import { getSetupAdvice, type AdvisorResult } from "@/lib/advisor.functions";
import { useAuth } from "@/lib/auth-context";
import { parseLapTime, formatLapTime } from "@/lib/lap-time";
import { exportSetupPdf } from "@/lib/setup-pdf";
import { useCarAccess, canEdit } from "@/lib/use-car-access";
import { LapImportDialog } from "@/components/lap-import-dialog";
import { SetupConsole } from "@/components/setup-console";

export const Route = createFileRoute("/_authenticated/setups/$setupId")({
  component: SetupDetail,
});

type SetupRow = {
  id: string; name: string; track: string | null; conditions: string | null;
  notes: string | null; discipline: string; car_id: string; updated_at: string;
  setup_data: Record<string, string | number | null>;
};

function SetupDetail() {
  const { setupId } = Route.useParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const adviseFn = useServerFn(getSetupAdvice);

  const [advisor, setAdvisor] = useState({ weather: "", goal: "", driverNotes: "" });
  const [advice, setAdvice] = useState<AdvisorResult | null>(null);

  const advise = useMutation({
    mutationFn: async () => adviseFn({ data: { setupId, ...advisor } }),
    onSuccess: (r) => setAdvice(r),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Advisor failed"),
  });

  const setupQ = useQuery({
    queryKey: ["setup", setupId],
    queryFn: async () => {
      const { data, error } = await supabase.from("setups").select("*").eq("id", setupId).single();
      if (error) throw error;
      return data as unknown as SetupRow;
    },
  });
  const carQ = useQuery({
    queryKey: ["car-owner", setupQ.data?.car_id],
    enabled: !!setupQ.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("user_id").eq("id", setupQ.data!.car_id).single();
      if (error) throw error;
      return data;
    },
  });
  const carNameQ = useQuery({
    queryKey: ["car-name", setupQ.data?.car_id],
    enabled: !!setupQ.data,
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("name").eq("id", setupQ.data!.car_id).single();
      if (error) throw error;
      return data?.name as string;
    },
  });
  const accessQ = useCarAccess(setupQ.data?.car_id, carQ.data?.user_id);
  const writable = canEdit(accessQ.data);
  const role = accessQ.data;

  const [meta, setMeta] = useState({ name: "", track: "", conditions: "", notes: "" });
  const [data, setData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (setupQ.data) {
      setMeta({
        name: setupQ.data.name,
        track: setupQ.data.track ?? "",
        conditions: setupQ.data.conditions ?? "",
        notes: setupQ.data.notes ?? "",
      });
      const initial: Record<string, string> = {};
      Object.entries(setupQ.data.setup_data || {}).forEach(([k, v]) => {
        initial[k] = v == null ? "" : String(v);
      });
      setData(initial);
    }
  }, [setupQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("setups").update({
        name: meta.name,
        track: meta.track || null,
        conditions: meta.conditions || null,
        notes: meta.notes || null,
        setup_data: data,
      }).eq("id", setupId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Setup saved");
      qc.invalidateQueries({ queryKey: ["setup", setupId] });
      qc.invalidateQueries({ queryKey: ["setups"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (setupQ.isLoading || !setupQ.data) {
    return <div className="text-muted-foreground">Loading…</div>;
  }

  const disc = getDiscipline(setupQ.data.discipline);

  return (
    <div>
      <Link to="/cars/$carId" params={{ carId: setupQ.data.car_id }} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to car
      </Link>

      <div className="mt-4 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
            {disc.label} setup
            {role && role !== "owner" && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-accent/20 text-accent">{role}</span>
            )}
          </div>
          <Input value={meta.name} readOnly={!writable} onChange={(e) => setMeta({ ...meta, name: e.target.value })}
            className="mt-1 font-display !text-3xl font-bold !h-auto !py-2 !px-3 bg-transparent border-transparent hover:border-border focus-visible:border-primary" />
        </div>
        {writable && (
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="shadow-glow">
            {save.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save
          </Button>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={async () => {
          try {
            const { data: car } = await supabase.from("cars").select("name, make, model, year").eq("id", setupQ.data!.car_id).single();
            const { data: laps } = await supabase.from("laps").select("lap_number, lap_time_ms, sector_1_ms, sector_2_ms, sector_3_ms, conditions, notes").eq("setup_id", setupId).order("recorded_at");
            exportSetupPdf({
              setup: { ...setupQ.data!, ...meta, setup_data: data, updated_at: setupQ.data!.updated_at ?? new Date().toISOString() } as Parameters<typeof exportSetupPdf>[0]["setup"],
              car: car ?? null,
              laps: laps ?? [],
            });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Export failed");
          }
        }}>
          <Download className="w-4 h-4 mr-1" /> Export PDF
        </Button>
      </div>

      <div className="mt-4">
        <SetupConsole
          data={data}
          setData={setData}
          meta={meta}
          writable={writable}
          carName={carNameQ.data ?? ""}
        />
      </div>

      <div className="mt-6 grid md:grid-cols-3 gap-4 rounded-lg border border-border bg-card p-5">
        <div><Label>Track</Label><Input readOnly={!writable} value={meta.track} onChange={(e) => setMeta({ ...meta, track: e.target.value })} /></div>
        <div><Label>Conditions</Label><Input readOnly={!writable} value={meta.conditions} onChange={(e) => setMeta({ ...meta, conditions: e.target.value })} /></div>
        <div className="md:col-span-1"><Label>Notes</Label><Input readOnly={!writable} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} placeholder="Lap times, feel…" /></div>
      </div>

      <div className="mt-6 space-y-3">
        {disc.sections.map((section) => (
          <div key={section.title} className="rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-border" />
              <h2 className="font-display text-lg font-bold uppercase tracking-wider">{section.title}</h2>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {section.fields.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    {f.label}{f.unit && <span className="text-primary"> ({f.unit})</span>}
                  </Label>
                  <Input
                    type={f.type === "number" ? "number" : "text"}
                    step="any"
                    readOnly={!writable}
                    value={data[f.key] ?? ""}
                    onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                    className="mt-1 font-mono"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-lg border border-border bg-card p-5">
          <Label>Session notes</Label>
          <Textarea rows={4} readOnly={!writable} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
            placeholder="What changed, what felt better, next steps…" />
        </div>

        <LapLog setupId={setupId} carId={setupQ.data.car_id} userId={user?.id ?? ""} defaultConditions={meta.conditions} canEdit={writable} />

        <div className="rounded-lg border border-primary/40 bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-display text-lg font-bold uppercase tracking-wider">Setup Advisor</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            AI race engineer. Tell it the weather and what you're trying to improve.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Weather / track</Label>
              <Input value={advisor.weather} onChange={(e) => setAdvisor({ ...advisor, weather: e.target.value })}
                placeholder="Wet, 14°C, falling temp" />
            </div>
            <div>
              <Label>Goal</Label>
              <Input value={advisor.goal} onChange={(e) => setAdvisor({ ...advisor, goal: e.target.value })}
                placeholder="Less mid-corner understeer" />
            </div>
            <div>
              <Label>Driver notes</Label>
              <Input value={advisor.driverNotes} onChange={(e) => setAdvisor({ ...advisor, driverNotes: e.target.value })}
                placeholder="Pushes wide on entry, snappy on throttle" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => advise.mutate()} disabled={advise.isPending} className="shadow-glow">
              {advise.isPending
                ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analyzing…</>
                : <><Sparkles className="w-4 h-4 mr-1" /> Get recommendations</>}
            </Button>
          </div>

          {advice && (
            <div className="mt-6 space-y-4">
              {advice.summary && (
                <div className="rounded-md border border-border bg-background/50 p-4">
                  <div className="text-xs font-mono uppercase tracking-widest text-primary mb-1">Summary</div>
                  <p className="text-sm">{advice.summary}</p>
                </div>
              )}
              <div className="space-y-2">
                {advice.recommendations.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="w-4 h-4" /> No specific recommendations.
                  </div>
                )}
                {advice.recommendations.map((r, i) => (
                  <div key={i} className="rounded-md border border-border bg-background/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-display font-bold text-sm uppercase tracking-wider">{r.area}</div>
                      <span className={
                        "text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded " +
                        (r.priority === "high"
                          ? "bg-destructive/20 text-destructive"
                          : r.priority === "medium"
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground")
                      }>{r.priority}</span>
                    </div>
                    <div className="mt-2 text-sm font-mono text-foreground">{r.change}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{r.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        {writable && (
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="shadow-glow">
            {save.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save setup
          </Button>
        )}
      </div>

    </div>
  );
}

type Lap = {
  id: string;
  lap_number: number | null;
  lap_time_ms: number;
  sector_1_ms: number | null;
  sector_2_ms: number | null;
  sector_3_ms: number | null;
  conditions: string | null;
  tire_set: string | null;
  fuel_load: number | null;
  notes: string | null;
  recorded_at: string;
};

function LapLog({ setupId, carId, userId, defaultConditions, canEdit }: {
  setupId: string; carId: string; userId: string; defaultConditions: string; canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    lap_number: "", lap_time: "", s1: "", s2: "", s3: "",
    conditions: "", tire_set: "", fuel_load: "", notes: "",
  });

  const lapsQ = useQuery({
    queryKey: ["laps", setupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("laps")
        .select("*")
        .eq("setup_id", setupId)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data as Lap[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const ms = parseLapTime(form.lap_time);
      if (ms == null) throw new Error("Bad lap time. Use 1:23.456 or 83.456");
      const s1 = form.s1 ? parseLapTime(form.s1) : null;
      const s2 = form.s2 ? parseLapTime(form.s2) : null;
      const s3 = form.s3 ? parseLapTime(form.s3) : null;
      const fuel = form.fuel_load ? parseFloat(form.fuel_load) : null;
      const lapNum = form.lap_number ? parseInt(form.lap_number, 10) : null;
      const { error } = await supabase.from("laps").insert({
        user_id: userId,
        setup_id: setupId,
        car_id: carId,
        lap_number: lapNum,
        lap_time_ms: ms,
        sector_1_ms: s1,
        sector_2_ms: s2,
        sector_3_ms: s3,
        conditions: form.conditions || defaultConditions || null,
        tire_set: form.tire_set || null,
        fuel_load: fuel,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lap logged");
      setForm({ ...form, lap_time: "", s1: "", s2: "", s3: "", notes: "",
        lap_number: form.lap_number ? String(parseInt(form.lap_number, 10) + 1) : "" });
      qc.invalidateQueries({ queryKey: ["laps", setupId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("laps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["laps", setupId] }),
  });

  const laps = lapsQ.data ?? [];
  const best = laps.reduce<number | null>((b, l) => (b == null || l.lap_time_ms < b ? l.lap_time_ms : b), null);
  const avg = laps.length > 0 ? Math.round(laps.reduce((s, l) => s + l.lap_time_ms, 0) / laps.length) : null;

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 mb-1">
        <Timer className="w-5 h-5 text-primary" />
        <h2 className="font-display text-lg font-bold uppercase tracking-wider">Lap Log</h2>
        {canEdit && (
          <div className="ml-auto">
            <LapImportDialog setupId={setupId} carId={carId} userId={userId} defaultConditions={defaultConditions} />
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Log laps against this setup. Format: <span className="font-mono text-foreground">1:23.456</span> or <span className="font-mono text-foreground">83.456</span>.
      </p>

      {canEdit && (
      <>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Lap #</Label>
          <Input value={form.lap_number} onChange={(e) => setForm({ ...form, lap_number: e.target.value })} className="font-mono mt-1" placeholder="1" />
        </div>
        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Lap time *</Label>
          <Input value={form.lap_time} onChange={(e) => setForm({ ...form, lap_time: e.target.value })} className="font-mono mt-1" placeholder="1:23.456" />
        </div>
        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">S1</Label>
          <Input value={form.s1} onChange={(e) => setForm({ ...form, s1: e.target.value })} className="font-mono mt-1" placeholder="optional" />
        </div>
        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">S2</Label>
          <Input value={form.s2} onChange={(e) => setForm({ ...form, s2: e.target.value })} className="font-mono mt-1" />
        </div>
        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">S3</Label>
          <Input value={form.s3} onChange={(e) => setForm({ ...form, s3: e.target.value })} className="font-mono mt-1" />
        </div>
        <div>
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Fuel (L)</Label>
          <Input value={form.fuel_load} onChange={(e) => setForm({ ...form, fuel_load: e.target.value })} className="font-mono mt-1" type="number" step="any" />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Conditions</Label>
          <Input value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} className="mt-1" placeholder={defaultConditions || "Dry, 22°C"} />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Tire set</Label>
          <Input value={form.tire_set} onChange={(e) => setForm({ ...form, tire_set: e.target.value })} className="mt-1" placeholder="Set A, 3 heat cycles" />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Notes</Label>
          <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" placeholder="Locked rears at T3" />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending || !form.lap_time}>
          {add.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />} Log lap
        </Button>
      </div>
      </>
      )}

      {laps.length > 0 && (
        <>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <div><span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Laps:</span> <span className="font-display font-bold">{laps.length}</span></div>
            <div className="flex items-center gap-1"><Trophy className="w-4 h-4 text-primary" /><span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Best:</span> <span className="font-display font-bold">{formatLapTime(best)}</span></div>
            <div><span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Avg:</span> <span className="font-display font-bold">{formatLapTime(avg)}</span></div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Lap</th>
                  <th className="py-2 pr-3">S1</th>
                  <th className="py-2 pr-3">S2</th>
                  <th className="py-2 pr-3">S3</th>
                  <th className="py-2 pr-3">Fuel</th>
                  <th className="py-2 pr-3">Conditions</th>
                  <th className="py-2 pr-3">Notes</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {laps.map((l) => (
                  <tr key={l.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-mono">{l.lap_number ?? "—"}</td>
                    <td className={"py-2 pr-3 font-mono " + (l.lap_time_ms === best ? "text-primary font-bold" : "")}>{formatLapTime(l.lap_time_ms)}</td>
                    <td className="py-2 pr-3 font-mono text-muted-foreground">{formatLapTime(l.sector_1_ms)}</td>
                    <td className="py-2 pr-3 font-mono text-muted-foreground">{formatLapTime(l.sector_2_ms)}</td>
                    <td className="py-2 pr-3 font-mono text-muted-foreground">{formatLapTime(l.sector_3_ms)}</td>
                    <td className="py-2 pr-3 font-mono text-muted-foreground">{l.fuel_load ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{l.conditions ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{l.notes ?? "—"}</td>
                    <td className="py-2 text-right">
                      {canEdit && (
                        <button onClick={() => { if (confirm("Delete lap?")) del.mutate(l.id); }} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}