import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getDiscipline } from "@/lib/disciplines";

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
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="shadow-glow">
          {save.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save setup
        </Button>
      </div>

    </div>
  );
}