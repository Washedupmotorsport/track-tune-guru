import { describe, it, expect } from "bun:test";
import {
  normalizeTrackName,
  matchesCircuit,
  conditionScore,
  rankHistoricalSetups,
  pickHighlights,
  circuitHistory,
} from "./setup-retrieval";

const ctx = {
  carId: "car1",
  track: "Queensland Raceway",
  trackId: "trk1",
  weather: "Sunny",
  trackTempC: 30,
  compound: "Medium",
};

const base = {
  setupId: "s1",
  setupName: "Baseline",
  carId: "car1",
  track: "Queensland Raceway",
  trackId: "trk1",
  bestLapMs: 61200,
  lastUsedAt: "2026-10-01T00:00:00Z",
  weather: "Sunny",
  trackTempC: 31,
  compound: "Medium",
};

describe("normalizeTrackName / matchesCircuit", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeTrackName("  Queensland   Raceway ")).toBe("queensland raceway");
    expect(normalizeTrackName("")).toBeNull();
    expect(normalizeTrackName(null)).toBeNull();
  });
  it("matches on track id when both are known", () => {
    expect(matchesCircuit({ track: null, trackId: "trk1" }, ctx)).toBe(true);
    expect(matchesCircuit({ track: null, trackId: "other" }, ctx)).toBe(false);
  });
  it("matches on normalized name as a fallback", () => {
    expect(matchesCircuit({ track: "queensland raceway", trackId: null }, ctx)).toBe(true);
    expect(matchesCircuit({ track: "Lakeside Park", trackId: null }, ctx)).toBe(false);
  });
  it("never matches when the circuit is unknown", () => {
    expect(matchesCircuit({ track: null, trackId: null }, ctx)).toBe(false);
  });
});

describe("conditionScore", () => {
  it("rewards matching weather, close track temp and same compound", () => {
    expect(conditionScore(base, ctx)).toBe(6);
  });
  it("gives partial credit for a wider temp gap", () => {
    expect(conditionScore({ ...base, trackTempC: 38 }, ctx)).toBe(5); // weather+compound+temp(1)
    expect(conditionScore({ ...base, trackTempC: 45 }, ctx)).toBe(4); // no temp credit
  });
  it("scores zero when conditions are unknown", () => {
    expect(conditionScore({ ...base, weather: null, trackTempC: null, compound: null }, ctx)).toBe(
      0,
    );
  });
});

describe("rankHistoricalSetups", () => {
  const entries = [
    base,
    { ...base, setupId: "s2", setupName: "Other car", carId: "car2" },
    { ...base, setupId: "s3", setupName: "Other track", track: "Lakeside Park", trackId: "trk9" },
    {
      ...base,
      setupId: "s4",
      setupName: "Wet day",
      weather: "Rain",
      trackTempC: 18,
      compound: "Wet",
      bestLapMs: 60500,
      lastUsedAt: "2026-09-01T00:00:00Z",
    },
  ];

  it("keeps only the same vehicle and circuit", () => {
    const ranked = rankHistoricalSetups(entries, ctx);
    expect(ranked.map((r) => r.setupId).sort()).toEqual(["s1", "s4"]);
  });

  it("ranks better-matching conditions first even when slower", () => {
    const ranked = rankHistoricalSetups(entries, ctx);
    expect(ranked[0].setupId).toBe("s1"); // full condition match beats s4's faster lap
  });

  it("returns nothing when there is no history", () => {
    expect(rankHistoricalSetups([], ctx)).toEqual([]);
    expect(rankHistoricalSetups(entries, { ...ctx, carId: "nope" })).toEqual([]);
  });
});

describe("pickHighlights", () => {
  it("picks fastest, most recent and best match", () => {
    const ranked = rankHistoricalSetups(
      [
        base,
        {
          ...base,
          setupId: "s4",
          setupName: "Wet day",
          weather: "Rain",
          trackTempC: 18,
          compound: "Wet",
          bestLapMs: 60500,
          lastUsedAt: "2026-11-01T00:00:00Z",
        },
      ],
      ctx,
    );
    const h = pickHighlights(ranked);
    expect(h.bestMatch.setupId).toBe("s1");
    expect(h.fastest.setupId).toBe("s4"); // 60.5s beats 61.2s
    expect(h.mostRecent.setupId).toBe("s4"); // November beats October
  });

  it("handles missing laps and dates", () => {
    const h = pickHighlights([{ ...base, bestLapMs: null, lastUsedAt: null, score: 0 }]);
    expect(h.fastest).toBeNull();
    expect(h.mostRecent).toBeNull();
    expect(h.bestMatch).not.toBeNull();
  });

  it("returns all nulls for empty input", () => {
    expect(pickHighlights([])).toEqual({ fastest: null, mostRecent: null, bestMatch: null });
  });
});

it("keeps each circuit's laps and history when one setup is reused", () => {
  const setups = [{ id: "x", name: "Shared setup", track: "B", updated_at: "2026-11-02" }];
  const sessions = [
    {
      id: "a",
      setup_id: "x",
      track: "A",
      track_id: "a-track",
      weather: null,
      track_temp_c: null,
      started_at: "2026-11-01",
    },
    {
      id: "b",
      setup_id: "x",
      track: "B",
      track_id: "b-track",
      weather: null,
      track_temp_c: null,
      started_at: "2026-11-02",
    },
  ];
  const laps = [
    { session_id: "a", lap_time_ms: 50000 },
    { session_id: "b", lap_time_ms: 100000 },
  ];
  expect(
    circuitHistory(setups, sessions, laps, [], { carId: "car1", track: "B", trackId: "b-track" })[0]
      .bestLapMs,
  ).toBe(100000);
  expect(
    circuitHistory(setups, sessions, laps, [], { carId: "car1", track: "A", trackId: "a-track" })[0]
      .bestLapMs,
  ).toBe(50000);
  expect(
    matchesCircuit(
      { track: "A", trackId: "wrong-layout" },
      { carId: "car1", track: "A", trackId: "a-track" },
    ),
  ).toBe(false);
});
