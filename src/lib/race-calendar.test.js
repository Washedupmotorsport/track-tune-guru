import { describe, it, expect } from "bun:test";
import { isRun, circuitProgress, seasonSummary } from "./race-calendar";

const now = new Date("2026-06-01T00:00:00Z").getTime();
const ev = (o) => ({ id: Math.random().toString(), event_type: "race", status: "planned", title: "R", track: "Queensland Raceway", track_id: null, starts_at: "2026-07-01T00:00:00Z", ends_at: null, ...o });

describe("race calendar", () => {
  it("past planned rounds count as run, cancelled never do", () => {
    expect(isRun(ev({ starts_at: "2026-05-01T00:00:00Z" }), now)).toBe(true);
    expect(isRun(ev({ starts_at: "2026-05-01T00:00:00Z", status: "cancelled" }), now)).toBe(false);
    expect(isRun(ev({ status: "completed" }), now)).toBe(true);
    expect(isRun(ev({}), now)).toBe(false);
  });
  it("groups rounds by circuit and counts what is left", () => {
    const events = [
      ev({ starts_at: "2026-05-01T00:00:00Z" }),
      ev({ starts_at: "2026-08-01T00:00:00Z" }),
      ev({ track: "Lakeside Park", status: "completed" }),
      ev({ track: "Morgan Park", status: "cancelled" }),
      ev({ track: "Sandown", event_type: "workshop" }),
    ];
    const c = circuitProgress(events, now);
    expect(c.map((x) => x.name)).toEqual(["Queensland Raceway", "Lakeside Park"]);
    expect(c[0]).toMatchObject({ rounds: 2, run: 1, nextDate: "2026-08-01T00:00:00Z" });
    expect(seasonSummary(events, now)).toEqual({ rounds: 3, run: 2, left: 1, circuits: 2, circuitsLeft: 1 });
  });
});
