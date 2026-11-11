// Pure helpers for the race calendar: which circuits are run vs still to run.
export type CalendarEventLike = {
  id: string; event_type: string; status: string; title: string;
  track: string | null; track_id: string | null; starts_at: string; ends_at: string | null;
};

export const RUN_TYPES = ["race", "test"];

/** A round counts as run if marked completed, or it has finished and wasn't cancelled. */
export function isRun(e: CalendarEventLike, now: number): boolean {
  if (e.status === "cancelled") return false;
  if (e.status === "completed") return true;
  const end = new Date(e.ends_at ?? e.starts_at).getTime();
  return Number.isFinite(end) && end < now;
}

export type CircuitProgress = {
  key: string; name: string; rounds: number; run: number;
  nextDate: string | null; lastRunDate: string | null;
};

export function circuitProgress(events: CalendarEventLike[], now: number): CircuitProgress[] {
  const map = new Map<string, CircuitProgress>();
  for (const e of events) {
    if (!RUN_TYPES.includes(e.event_type) || e.status === "cancelled") continue;
    const name = (e.track ?? "").trim() || "Circuit not set";
    const key = e.track_id ?? name.toLowerCase();
    const c = map.get(key) ?? { key, name, rounds: 0, run: 0, nextDate: null, lastRunDate: null };
    c.rounds += 1;
    if (isRun(e, now)) {
      c.run += 1;
      if (!c.lastRunDate || e.starts_at > c.lastRunDate) c.lastRunDate = e.starts_at;
    } else if (!c.nextDate || e.starts_at < c.nextDate) {
      c.nextDate = e.starts_at;
    }
    map.set(key, c);
  }
  return [...map.values()].sort((a, b) => {
    const aLeft = a.run < a.rounds, bLeft = b.run < b.rounds;
    if (aLeft !== bLeft) return aLeft ? -1 : 1;
    return (a.nextDate ?? a.lastRunDate ?? "").localeCompare(b.nextDate ?? b.lastRunDate ?? "");
  });
}

export function seasonSummary(events: CalendarEventLike[], now: number) {
  const circuits = circuitProgress(events, now);
  const rounds = circuits.reduce((s, c) => s + c.rounds, 0);
  const run = circuits.reduce((s, c) => s + c.run, 0);
  return { rounds, run, left: rounds - run, circuits: circuits.length, circuitsLeft: circuits.filter((c) => c.run < c.rounds).length };
}
