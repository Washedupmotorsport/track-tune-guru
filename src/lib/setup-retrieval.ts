// Pure historical-setup retrieval for the Setup and Cockpit sections.
// Ranks previous setups for a car at a circuit so a returning driver can
// pick a starting point. Never invents data: no matches in, nothing out.

export type SetupHistoryEntry = {
  setupId: string;
  setupName: string;
  carId: string;
  /** Circuit identity, gathered from the setup itself or sessions that used it. */
  track: string | null;
  trackId: string | null;
  bestLapMs: number | null;
  lastUsedAt: string | null; // ISO date
  weather: string | null;
  trackTempC: number | null;
  compound: string | null;
};

export type RetrievalContext = {
  carId: string;
  track?: string | null;
  trackId?: string | null;
  weather?: string | null;
  trackTempC?: number | null;
  compound?: string | null;
};

export type RankedSetup = SetupHistoryEntry & { score: number };

export function normalizeTrackName(s: string | null | undefined): string | null {
  if (!s) return null;
  const n = s.trim().toLowerCase().replace(/\s+/g, " ");
  return n || null;
}

/** Same circuit when track ids match (both known) or normalized names match. */
export function matchesCircuit(entry: Pick<SetupHistoryEntry, "track" | "trackId">, ctx: RetrievalContext): boolean {
  if (entry.trackId && ctx.trackId && entry.trackId === ctx.trackId) return true;
  const a = normalizeTrackName(entry.track);
  const b = normalizeTrackName(ctx.track);
  return !!a && !!b && a === b;
}

/** Similarity points for conditions: weather, track temp, tyre compound. */
export function conditionScore(entry: SetupHistoryEntry, ctx: RetrievalContext): number {
  let score = 0;
  if (entry.weather && ctx.weather && entry.weather.trim().toLowerCase() === ctx.weather.trim().toLowerCase()) score += 2;
  if (entry.trackTempC != null && ctx.trackTempC != null) {
    const d = Math.abs(entry.trackTempC - ctx.trackTempC);
    if (d <= 5) score += 2;
    else if (d <= 10) score += 1;
  }
  if (entry.compound && ctx.compound && entry.compound.trim().toLowerCase() === ctx.compound.trim().toLowerCase()) score += 2;
  return score;
}

/**
 * Filter to the same vehicle and circuit, then rank:
 * condition similarity first, then fastest lap, then most recent use.
 */
export function rankHistoricalSetups(entries: SetupHistoryEntry[], ctx: RetrievalContext): RankedSetup[] {
  return entries
    .filter((e) => e.carId === ctx.carId && matchesCircuit(e, ctx))
    .map((e) => ({ ...e, score: conditionScore(e, ctx) }))
    .sort((a, b) =>
      b.score - a.score
      || (a.bestLapMs ?? Infinity) - (b.bestLapMs ?? Infinity)
      || (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""),
    );
}

export type SetupHighlights = {
  fastest: RankedSetup | null;
  mostRecent: RankedSetup | null;
  bestMatch: RankedSetup | null;
};

/** The three headline picks: fastest recorded, most recently used, best under similar conditions. */
export function pickHighlights(ranked: RankedSetup[]): SetupHighlights {
  if (!ranked.length) return { fastest: null, mostRecent: null, bestMatch: null };
  const withLap = ranked.filter((r) => r.bestLapMs != null);
  const fastest = withLap.length
    ? withLap.reduce((a, b) => (a.bestLapMs! <= b.bestLapMs! ? a : b))
    : null;
  const withDate = ranked.filter((r) => r.lastUsedAt != null);
  const mostRecent = withDate.length
    ? withDate.reduce((a, b) => (a.lastUsedAt! >= b.lastUsedAt! ? a : b))
    : null;
  return { fastest, mostRecent, bestMatch: ranked[0] };
}
