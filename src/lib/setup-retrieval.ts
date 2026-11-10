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
export function matchesCircuit(
  entry: Pick<SetupHistoryEntry, "track" | "trackId">,
  ctx: RetrievalContext,
): boolean {
  if (entry.trackId && ctx.trackId) return entry.trackId === ctx.trackId;
  const a = normalizeTrackName(entry.track);
  const b = normalizeTrackName(ctx.track);
  return !!a && !!b && a === b;
}

/** Similarity points for conditions: weather, track temp, tyre compound. */
export function conditionScore(entry: SetupHistoryEntry, ctx: RetrievalContext): number {
  let score = 0;
  if (
    entry.weather &&
    ctx.weather &&
    entry.weather.trim().toLowerCase() === ctx.weather.trim().toLowerCase()
  )
    score += 2;
  if (entry.trackTempC != null && ctx.trackTempC != null) {
    const d = Math.abs(entry.trackTempC - ctx.trackTempC);
    if (d <= 5) score += 2;
    else if (d <= 10) score += 1;
  }
  if (
    entry.compound &&
    ctx.compound &&
    entry.compound.trim().toLowerCase() === ctx.compound.trim().toLowerCase()
  )
    score += 2;
  return score;
}

/**
 * Filter to the same vehicle and circuit, then rank:
 * condition similarity first, then fastest lap, then most recent use.
 */
export function rankHistoricalSetups(
  entries: SetupHistoryEntry[],
  ctx: RetrievalContext,
): RankedSetup[] {
  return entries
    .filter((e) => e.carId === ctx.carId && matchesCircuit(e, ctx))
    .map((e) => ({ ...e, score: conditionScore(e, ctx) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.bestLapMs ?? Infinity) - (b.bestLapMs ?? Infinity) ||
        (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? ""),
    );
}

/** Aggregate only sessions at the requested circuit, never laps from another venue. */
export function circuitHistory(
  setups: { id: string; name: string; track: string | null; updated_at: string }[],
  sessions: {
    id: string;
    setup_id: string | null;
    track: string | null;
    track_id: string | null;
    weather: string | null;
    track_temp_c: number | null;
    started_at: string;
  }[],
  laps: { session_id: string; lap_time_ms: number }[],
  tyres: { session_id: string; compound: string | null; recorded_at: string }[],
  ctx: RetrievalContext,
): SetupHistoryEntry[] {
  return setups.flatMap((setup) => {
    const used = sessions
      .filter(
        (s) =>
          s.setup_id === setup.id && matchesCircuit({ track: s.track, trackId: s.track_id }, ctx),
      )
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
    const latest = used[0];
    if (!latest && !matchesCircuit({ track: setup.track, trackId: null }, ctx)) return [];
    const ids = new Set(used.map((s) => s.id));
    const times = laps
      .filter((l) => ids.has(l.session_id) && l.lap_time_ms > 0)
      .map((l) => l.lap_time_ms);
    const tyre = latest
      ? tyres
          .filter((t) => t.session_id === latest.id)
          .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0]
      : null;
    return [
      {
        setupId: setup.id,
        setupName: setup.name,
        carId: ctx.carId,
        track: latest?.track ?? setup.track,
        trackId: latest?.track_id ?? null,
        bestLapMs: times.length ? Math.min(...times) : null,
        lastUsedAt: latest?.started_at ?? setup.updated_at,
        weather: latest?.weather ?? null,
        trackTempC: latest?.track_temp_c ?? null,
        compound: tyre?.compound ?? null,
      },
    ];
  });
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
    ? withLap.reduce((a, b) => ((a.bestLapMs ?? Infinity) <= (b.bestLapMs ?? Infinity) ? a : b))
    : null;
  const withDate = ranked.filter((r) => r.lastUsedAt != null);
  const mostRecent = withDate.length
    ? withDate.reduce((a, b) => ((a.lastUsedAt ?? "") >= (b.lastUsedAt ?? "") ? a : b))
    : null;
  return { fastest, mostRecent, bestMatch: ranked[0] };
}
