import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Square, Flag, RotateCcw, Save } from "lucide-react";
import { formatLapTime } from "@/lib/lap-time";

type Capture = { n: number; ms: number };

export function LapTimer({ onSaveLap }: { onSaveLap: (lapMs: number, lapNumber: number) => Promise<void> | void }) {
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastSplit, setLastSplit] = useState<number>(0);
  const [now, setNow] = useState<number>(0);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const tick = () => { setNow(performance.now()); rafRef.current = requestAnimationFrame(tick); };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running]);

  const start = () => { const t = performance.now(); setStartedAt(t); setLastSplit(t); setNow(t); setRunning(true); };
  const stop = () => setRunning(false);
  const reset = () => { setRunning(false); setStartedAt(null); setLastSplit(0); setCaptures([]); };

  const lap = async () => {
    if (!running || startedAt == null) return;
    const t = performance.now();
    const ms = Math.round(t - lastSplit);
    const n = captures.length + 1;
    setLastSplit(t);
    setCaptures((c) => [{ n, ms }, ...c]);
    try { await onSaveLap(ms, n); } catch { /* surface upstream */ }
  };

  const elapsed = running && startedAt != null ? Math.round(now - lastSplit) : 0;
  const total = startedAt != null ? Math.round((running ? now : lastSplit) - startedAt) : 0;

  return (
    <div className="rounded-lg border border-primary/40 bg-card p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-bold uppercase tracking-wider">Live timer</h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Total {formatLapTime(total)}</span>
      </div>
      <div className="text-center py-4 select-none">
        <div className="font-mono text-6xl font-bold tabular-nums text-primary">{formatLapTime(elapsed)}</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {!running ? (
          <Button onClick={start} className="col-span-2 shadow-glow"><Play className="w-4 h-4 mr-1" /> Start</Button>
        ) : (
          <Button onClick={lap} className="col-span-2 shadow-glow"><Flag className="w-4 h-4 mr-1" /> Lap</Button>
        )}
        {running ? (
          <Button variant="outline" onClick={stop}><Square className="w-4 h-4 mr-1" /> Stop</Button>
        ) : (
          <Button variant="outline" onClick={reset} disabled={!startedAt}><RotateCcw className="w-4 h-4 mr-1" /> Reset</Button>
        )}
      </div>
      {captures.length > 0 && (
        <div className="mt-4 max-h-40 overflow-y-auto">
          <table className="w-full text-sm font-mono">
            <tbody>
              {captures.map((c) => (
                <tr key={c.n} className="border-b border-border/40">
                  <td className="py-1 text-muted-foreground w-10">#{c.n}</td>
                  <td className="py-1">{formatLapTime(c.ms)}</td>
                  <td className="py-1 text-right text-xs text-muted-foreground"><Save className="w-3 h-3 inline" /> saved</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}