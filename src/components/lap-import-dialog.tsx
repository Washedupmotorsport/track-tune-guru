import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Download, AlertTriangle } from "lucide-react";
import { parseLapCsv, type ParsedLap } from "@/lib/lap-csv";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

const TEMPLATE_CSV = `Lap,Lap Time,S1,S2,S3,Conditions,Notes
1,1:23.456,28.123,27.890,27.443,Dry,Out lap
2,1:21.234,27.456,26.987,26.791,Dry,Clean lap
3,1:20.987,27.301,26.842,26.844,Dry,New PB
4,1:22.105,27.612,27.103,27.390,Dry,Slight lockup T3
5,1:21.998,27.501,27.012,27.485,Damp,Light rain starting
`;

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lap-log-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function LapImportDialog({
  setupId, carId, userId, defaultConditions,
}: { setupId: string; carId: string; userId: string; defaultConditions: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{
    laps: ParsedLap[];
    errors: { row: number; reason: string }[];
    headers: Partial<Record<string, string>>;
    unrecognizedHeaders: string[];
    rawHeaders: string[];
    missingRequired: boolean;
    confirmed: boolean;
  } | null>(null);

  const onFile = async (file: File) => {
    const text = await file.text();
    const res = parseLapCsv(text);
    setPreview({
      laps: res.laps,
      errors: res.errors,
      headers: res.headersUsed,
      unrecognizedHeaders: res.unrecognizedHeaders,
      rawHeaders: res.rawHeaders,
      missingRequired: !res.headersUsed.lap_time_ms,
      confirmed: false,
    });
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

  const hasUnrecognized = (preview?.unrecognizedHeaders.length ?? 0) > 0;
  const blockImport =
    !preview ||
    preview.laps.length === 0 ||
    preview.missingRequired ||
    (hasUnrecognized && !preview.confirmed) ||
    importMut.isPending;

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
          <div className="flex items-center justify-between gap-2">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-border file:bg-muted file:text-foreground file:font-mono file:text-xs file:uppercase file:tracking-widest hover:file:bg-muted/70"
            />
            <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate} className="shrink-0">
              <Download className="w-4 h-4 mr-1" /> Template
            </Button>
          </div>

          {preview && (
            <div className="rounded-md border border-border bg-card p-3 text-sm">
              {preview.missingRequired && (
                <Alert variant="destructive" className="mb-3">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertTitle>Headers don't match the template</AlertTitle>
                  <AlertDescription>
                    No lap time column was found. Expected a header like <span className="font-mono">Lap Time</span>, <span className="font-mono">Time</span>, or <span className="font-mono">Duration</span>.
                    {preview.rawHeaders.length > 0 && (
                      <div className="mt-1 text-xs">Found: <span className="font-mono">{preview.rawHeaders.join(", ")}</span></div>
                    )}
                    <div className="mt-1 text-xs">Download the template to see the accepted format.</div>
                  </AlertDescription>
                </Alert>
              )}
              {!preview.missingRequired && hasUnrecognized && (
                <Alert className="mb-3 border-warning/40">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertTitle>Some headers weren't recognized</AlertTitle>
                  <AlertDescription>
                    <div className="text-xs">
                      Ignored: <span className="font-mono">{preview.unrecognizedHeaders.join(", ")}</span>
                    </div>
                    <label className="flex items-center gap-2 mt-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preview.confirmed}
                        onChange={(e) => setPreview((p) => p ? { ...p, confirmed: e.target.checked } : p)}
                      />
                      Import anyway — I've reviewed the mapped columns below.
                    </label>
                  </AlertDescription>
                </Alert>
              )}
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
          <Button onClick={() => importMut.mutate()} disabled={blockImport}>
            {importMut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            Import {preview ? `${preview.laps.length} laps` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}