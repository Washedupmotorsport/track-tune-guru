import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Loader2, Sparkles, AlertTriangle, Timer, Trash2, Plus, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getDiscipline } from "@/lib/disciplines";
import { getSetupAdvice, type AdvisorResult } from "@/lib/advisor.functions";
import { useAuth } from "@/lib/auth-context";
import { parseLapTime, formatLapTime } from "@/lib/lap-time";

export const Route = createFileRoute("/_authenticated/setups/$setupId")({
  component: SetupDetail,
});

type SetupRow = {
  id: string; name: string; track: string | null; conditions: string | null;
  notes: string | null; discipline: string; car_id: string;
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
          <div className="font-mono text-xs uppercase tracking-widest text-primary">{disc.label} setup</div>
          <Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })}
            className="mt-1 font-display !text-3xl font-bold !h-auto !py-2 !px-3 bg-transparent border-transparent hover:border-border focus-visible:border-primary" />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="shadow-glow">
          {save.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save
        </Button>
      </div>

      <div className="mt-6 grid md:grid-cols-3 gap-4 rounded-lg border border-border bg-card p-5">
        <div><Label>Track</Label><Input value={meta.track} onChange={(e) => setMeta({ ...meta, track: e.target.value })} /></div>
        <div><Label>Conditions</Label><Input value={meta.conditions} onChange={(e) => setMeta({ ...meta, conditions: e.target.value })} /></div>
        <div className="md:col-span-1"><Label>Notes</Label><Input value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} placeholder="Lap times, feel…" /></div>
      </div>

      <div className="mt-6 space-y-6">
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
          <Textarea rows={4} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })}
            placeholder="What changed, what felt better, next steps…" />
        </div>

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
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="shadow-glow">
          {save.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save setup
        </Button>
      </div>

    </div>
  );
}