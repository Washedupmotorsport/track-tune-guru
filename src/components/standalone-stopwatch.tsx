import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Square, Flag, RotateCcw, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatLapTime } from "@/lib/lap-time";

type Capture = { n: number; ms: number };

/**
 * Lightweight paddock stopwatch — no session required.
 * Tap Start, then Lap to capture splits. Best lap is highlighted.
 */
export function StandaloneStopwatch() {
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
  const lap = () => {
    if (!running || startedAt == null) return;
    const t = performance.now();
    const ms = Math.round(t - lastSplit);
    const n = captures.length + 1;
    setLastSplit(t);
    setCaptures((c) => [{ n, ms }, ...c]);
  };

  const elapsed = running && startedAt != null ? Math.round(now - lastSplit) : 0;
  const total = startedAt != null ? Math.round((running ? now : lastSplit) - startedAt) : 0;
  const best = captures.length ? Math.min(...captures.map((c) => c.ms)) : null;

  return (
    <div className="rounded-lg border border-primary/40 bg-card p-4 sm:p-5 shadow-card">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider leading-none">Stopwatch</h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            Quick stopwatch · not saved
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
          Total {formatLapTime(total)}
        </span>
      </div>
      <div className="text-center py-3 sm:py-4 select-none">
        <div className="font-mono text-5xl sm:text-6xl font-bold tabular-nums text-primary">{formatLapTime(elapsed)}</div>
        {best != null && (
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mt-1">
            Best {formatLapTime(best)}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {!running ? (
          <Button size="lg" onClick={start} className="col-span-2 shadow-glow h-14 text-base"><Play className="w-5 h-5 mr-1" /> Start</Button>
        ) : (
          <Button size="lg" onClick={lap} className="col-span-2 shadow-glow h-14 text-base"><Flag className="w-5 h-5 mr-1" /> Lap</Button>
        )}
        {running ? (
          <Button size="lg" variant="outline" onClick={stop} className="h-14"><Square className="w-5 h-5 mr-1" /> Stop</Button>
        ) : (
          <Button size="lg" variant="outline" onClick={reset} disabled={!startedAt} className="h-14"><RotateCcw className="w-5 h-5 mr-1" /> Reset</Button>
        )}
      </div>
      <Link
        to="/pitlane"
        className="mt-2 flex items-center justify-center gap-2 h-11 w-full rounded-md border border-primary/30 bg-primary/5 text-primary font-mono text-[11px] uppercase tracking-widest hover:bg-primary/10 active:scale-[0.98] transition"
      >
        Open Pit Lane timing <ArrowRight className="w-3.5 h-3.5" />
      </Link>
      {captures.length > 0 && (
        <div className="mt-4 max-h-40 overflow-y-auto">
          <table className="w-full text-sm font-mono">
            <tbody>
              {captures.map((c) => (
                <tr key={c.n} className="border-b border-border/40">
                  <td className="py-1 text-muted-foreground w-10">#{c.n}</td>
                  <td className={"py-1 " + (c.ms === best ? "text-primary font-bold" : "")}>{formatLapTime(c.ms)}</td>
                  <td className="py-1 text-right text-[10px] uppercase tracking-widest text-muted-foreground">
                    {c.ms === best ? "best" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            Open a session to log laps to history.
          </p>
        </div>
      )}
    </div>
  );
}