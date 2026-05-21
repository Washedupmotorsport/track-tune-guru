import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { parseLapCsv, type ParsedLap } from "@/lib/lap-csv";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function LapImportDialog({
  setupId, carId, userId, defaultConditions,
}: { setupId: string; carId: string; userId: string; defaultConditions: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ laps: ParsedLap[]; errors: { row: number; reason: string }[]; headers: Partial<Record<string, string>> } | null>(null);

  const onFile = async (file: File) => {
    const text = await file.text();
    const res = parseLapCsv(text);
    setPreview({ laps: res.laps, errors: res.errors, headers: res.headersUsed });
  };

  const importMut = useMutation({
    mutationFn: async () => {
      if (!preview || preview.laps.length === 0) return;
      const rows = preview.laps.map((l) => ({
        user_id: userId, setup_id: setupId, car_id: carId,
        lap_number: l.lap_number,
        lap_time_ms: l.lap_time_ms,
        sector_1_ms: l.sector_1_ms,
        sector_2_ms: l.sector_2_ms,
        sector_3_ms: l.sector_3_ms,
        conditions: l.conditions ?? defaultConditions ?? null,
        notes: l.notes,
      }));
      const { error } = await supabase.from("laps").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Imported ${preview?.laps.length ?? 0} laps`);
      qc.invalidateQueries({ queryKey: ["laps", setupId] });
      setOpen(false);
      setPreview(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPreview(null); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Upload className="w-4 h-4 mr-1" /> Import CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import laps from CSV</DialogTitle>
          <DialogDescription>
            Works with exports from AiM Race Studio, RaceChrono, Harry's LapTimer, Garmin Catalyst, or any CSV with a lap-time column.
            Recognized headers: Lap, Lap Time, Time, S1/S2/S3, Sector 1-3, Conditions, Notes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-border file:bg-muted file:text-foreground file:font-mono file:text-xs file:uppercase file:tracking-widest hover:file:bg-muted/70"
          />

          {preview && (
            <div className="rounded-md border border-border bg-card p-3 text-sm">
              <div className="flex flex-wrap gap-4 mb-2">
                <div><span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Detected:</span> <span className="font-display font-bold">{preview.laps.length} laps</span></div>
                {preview.errors.length > 0 && (
                  <div className="text-destructive"><span className="font-mono text-xs uppercase tracking-widest">Skipped:</span> <span className="font-bold">{preview.errors.length} rows</span></div>
                )}
              </div>
              {Object.keys(preview.headers).length > 0 && (
                <div className="text-xs text-muted-foreground mb-2">
                  Mapped: {Object.entries(preview.headers).map(([k, v]) => `${k}=${v}`).join(", ")}
                </div>
              )}
              {preview.laps.length > 0 && (
                <div className="max-h-48 overflow-auto font-mono text-xs">
                  {preview.laps.slice(0, 8).map((l, i) => (
                    <div key={i} className="border-b border-border/40 py-1">
                      #{l.lap_number ?? i + 1} — {l.lap_time_ms}ms
                      {l.sector_1_ms != null && ` (${l.sector_1_ms}/${l.sector_2_ms ?? "—"}/${l.sector_3_ms ?? "—"})`}
                    </div>
                  ))}
                  {preview.laps.length > 8 && <div className="text-muted-foreground pt-1">+ {preview.laps.length - 8} more</div>}
                </div>
              )}
              {preview.errors.length > 0 && preview.laps.length === 0 && (
                <div className="text-xs text-destructive">{preview.errors[0].reason}</div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => importMut.mutate()} disabled={!preview || preview.laps.length === 0 || importMut.isPending}>
            {importMut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            Import {preview ? `${preview.laps.length} laps` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}