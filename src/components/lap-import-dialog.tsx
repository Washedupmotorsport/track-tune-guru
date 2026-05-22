import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Download, AlertTriangle } from "lucide-react";
import { parseLapCsv, type ParsedLap } from "@/lib/lap-csv";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";

const TEMPLATE_BODY = `Lap,Lap Time,S1,S2,S3,Conditions,Notes
1,1:23.456,28.123,27.890,27.443,Dry,Out lap
2,1:21.234,27.456,26.987,26.791,Dry,Clean lap
3,1:20.987,27.301,26.842,26.844,Dry,New PB
4,1:22.105,27.612,27.103,27.390,Dry,Slight lockup T3
5,1:21.998,27.501,27.012,27.485,Damp,Light rain starting
`;

function buildTemplateCsv(meta: Record<string, string | null | undefined>): string {
  const lines: string[] = [
    "# My Race Engineer — lap import template",
    "# Lines starting with '#' are metadata and ignored by the parser.",
    "# Keep these tags to ensure laps re-attach to the correct setup / session.",
  ];
  for (const [k, v] of Object.entries(meta)) {
    if (v) lines.push(`# ${k}: ${v}`);
  }
  lines.push("#");
  return lines.join("\n") + "\n" + TEMPLATE_BODY;
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Template is now built per-call with car/setup/session metadata.

function fmtMs(ms: number | null): string {
  if (ms == null) return "";
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  return m > 0 ? `${m}:${s.toFixed(3).padStart(6, "0")}` : s.toFixed(3);
}

function previewToCsv(laps: ParsedLap[], defaultConditions: string): string {
  const header = "Lap,Lap Time,S1,S2,S3,Conditions,Notes";
  const esc = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const rows = laps.map((l, i) => [
    String(l.lap_number ?? i + 1),
    fmtMs(l.lap_time_ms),
    fmtMs(l.sector_1_ms),
    fmtMs(l.sector_2_ms),
    fmtMs(l.sector_3_ms),
    esc(l.conditions ?? defaultConditions ?? ""),
    esc(l.notes ?? ""),
  ].join(","));
  return [header, ...rows].join("\n") + "\n";
}
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function LapImportDialog({
  setupId, carId, userId, defaultConditions,
}: { setupId: string; carId: string; userId: string; defaultConditions: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>("none");
  const [preview, setPreview] = useState<{
    laps: ParsedLap[];
    errors: { row: number; reason: string }[];
    headers: Partial<Record<string, string>>;
    unrecognizedHeaders: string[];
    rawHeaders: string[];
    missingRequired: boolean;
    confirmed: boolean;
    meta: Record<string, string>;
  } | null>(null);

  const metaQ = useQuery({
    queryKey: ["import-meta", setupId, carId],
    enabled: open,
    queryFn: async () => {
      const [setupRes, carRes, sessionsRes] = await Promise.all([
        supabase.from("setups").select("id, name, track").eq("id", setupId).maybeSingle(),
        supabase.from("cars").select("id, name").eq("id", carId).maybeSingle(),
        supabase.from("sessions").select("id, name, track, started_at").eq("setup_id", setupId).order("started_at", { ascending: false }),
      ]);
      return {
        setup: setupRes.data,
        car: carRes.data,
        sessions: sessionsRes.data ?? [],
      };
    },
  });

  const sessions = metaQ.data?.sessions ?? [];
  const selectedSession = sessions.find((s) => s.id === sessionId);

  const handleDownloadTemplate = () => {
    const m = metaQ.data;
    downloadCsv(
      `lap-template-${m?.car?.name?.replace(/\s+/g, "-").toLowerCase() ?? "car"}.csv`,
      buildTemplateCsv({
        car_id: carId,
        car_name: m?.car?.name ?? null,
        setup_id: setupId,
        setup_name: m?.setup?.name ?? null,
        track: m?.setup?.track ?? selectedSession?.track ?? null,
        session_id: sessionId !== "none" ? sessionId : null,
        session_name: selectedSession?.name ?? null,
        default_conditions: defaultConditions || null,
      }),
    );
  };

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
      meta: res.meta,
    });
    // Auto-select the session from the file metadata if it matches one we know.
    if (res.meta.session_id && sessions.some((s) => s.id === res.meta.session_id)) {
      setSessionId(res.meta.session_id);
    }
  };

  const importMut = useMutation({
    mutationFn: async () => {
      if (!preview || preview.laps.length === 0) return;
      const rows = preview.laps.map((l) => ({
        user_id: userId, setup_id: setupId, car_id: carId,
        session_id: sessionId !== "none" ? sessionId : null,
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
      qc.invalidateQueries({ queryKey: ["session-laps"] });
      setOpen(false);
      setPreview(null);
      setSessionId("none");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import failed"),
  });

  const hasUnrecognized = (preview?.unrecognizedHeaders.length ?? 0) > 0;
  const metaSetupMismatch = !!preview?.meta.setup_id && preview.meta.setup_id !== setupId;
  const metaCarMismatch = !!preview?.meta.car_id && preview.meta.car_id !== carId;
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
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Attach to session (optional)
              </Label>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="No session — laps attach to setup only" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No session — setup only</SelectItem>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.track ? ` · ${s.track}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate} className="shrink-0" disabled={metaQ.isLoading}>
              <Download className="w-4 h-4 mr-1" /> Download template
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            The template embeds <span className="font-mono">car_id</span>, <span className="font-mono">setup_id</span>
            {sessionId !== "none" ? <> and <span className="font-mono">session_id</span></> : null} as comment lines, so re-importing
            the file always attaches to the right place.
          </p>

          <div>
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">CSV file</Label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
              className="mt-1 block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-border file:bg-muted file:text-foreground file:font-mono file:text-xs file:uppercase file:tracking-widest hover:file:bg-muted/70"
            />
          </div>

          <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
            <div className="font-mono uppercase tracking-widest text-[10px] text-primary mb-2">Expected format</div>
            <table className="w-full">
              <thead className="text-muted-foreground">
                <tr className="text-left font-mono text-[10px] uppercase tracking-widest">
                  <th className="pb-1 pr-3 font-normal">Column</th>
                  <th className="pb-1 pr-3 font-normal">Required</th>
                  <th className="pb-1 pr-3 font-normal">Format</th>
                  <th className="pb-1 font-normal">Example</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr className="border-t border-border/40">
                  <td className="py-1 pr-3">Lap</td>
                  <td className="py-1 pr-3 text-muted-foreground">optional</td>
                  <td className="py-1 pr-3 text-muted-foreground">integer</td>
                  <td className="py-1">1, 2, 3…</td>
                </tr>
                <tr className="border-t border-border/40">
                  <td className="py-1 pr-3 text-primary">Lap Time</td>
                  <td className="py-1 pr-3 text-primary">required</td>
                  <td className="py-1 pr-3 text-muted-foreground">M:SS.mmm or seconds</td>
                  <td className="py-1">1:23.456 · 83.456</td>
                </tr>
                <tr className="border-t border-border/40">
                  <td className="py-1 pr-3">S1 / S2 / S3</td>
                  <td className="py-1 pr-3 text-muted-foreground">optional</td>
                  <td className="py-1 pr-3 text-muted-foreground">SS.mmm or M:SS.mmm</td>
                  <td className="py-1">27.890</td>
                </tr>
                <tr className="border-t border-border/40">
                  <td className="py-1 pr-3">Conditions</td>
                  <td className="py-1 pr-3 text-muted-foreground">optional</td>
                  <td className="py-1 pr-3 text-muted-foreground">free text</td>
                  <td className="py-1">Dry, Damp, Wet</td>
                </tr>
                <tr className="border-t border-border/40">
                  <td className="py-1 pr-3">Notes</td>
                  <td className="py-1 pr-3 text-muted-foreground">optional</td>
                  <td className="py-1 pr-3 text-muted-foreground">free text</td>
                  <td className="py-1">Lockup T3</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Time also accepts <span className="font-mono">MM:SS:mmm</span>, raw milliseconds, or seconds. Header aliases like <span className="font-mono">Time</span>, <span className="font-mono">Sector 1</span>, <span className="font-mono">Split 1</span>, <span className="font-mono">T1</span> are auto-detected.
            </div>
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
          {preview && preview.laps.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadCsv("lap-import-preview.csv", previewToCsv(preview.laps, defaultConditions))}
            >
              <Download className="w-4 h-4 mr-1" /> Export preview
            </Button>
          )}
          <Button onClick={() => importMut.mutate()} disabled={blockImport}>
            {importMut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            Import {preview ? `${preview.laps.length} laps` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}