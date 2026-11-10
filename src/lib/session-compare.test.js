import { describe, it, expect } from "bun:test";
import {
  diffSetupData,
  lapStats,
  comparePerformance,
  buildWhatImproved,
  formatDeltaMs,
} from "./session-compare.ts";

// Validation scenario from the brief: two sessions with different tyre
// pressures, damper settings and lap times.
const setupA = {
  psi_lf: "22", psi_rf: "22", psi_lr: "20", psi_rr: "20",
  camber_lf: "-2.5", camber_rf: "-2.5",
  comp_front: "4", comp_rear: "5",
  reb_front: "6", reb_rear: "6",
  arb_front: "3", arb_rear: "2",
  ride_front: "70", ride_rear: "80",
  brake_bias: "58",
};

const setupB = {
  psi_lf: "24", psi_rf: "24", psi_lr: "20", psi_rr: "20", // front pressures up 2
  camber_lf: "-2.5", camber_rf: "-2.5",
  comp_front: "3", comp_rear: "5", // front compression softened
  reb_front: "6", reb_rear: "6",
  arb_front: "3", arb_rear: "2",
  ride_front: "70", ride_rear: "80",
  brake_bias: "58",
};

describe("diffSetupData", () => {
  it("flags exactly the changed tyre pressures and damper settings", () => {
    const rows = diffSetupData(setupA, setupB);
    const changed = rows.filter((r) => r.changed).map((r) => r.key);
    expect(changed).toEqual(["psi_lf", "psi_rf", "comp_front"]);
    const psi = rows.find((r) => r.key === "psi_lf");
    expect(psi.a).toBe("22");
    expect(psi.b).toBe("24");
    expect(psi.group).toBe("Tyre pressures");
    const comp = rows.find((r) => r.key === "comp_front");
    expect(comp.group).toBe("Dampers");
  });

  it("marks missing data clearly instead of hiding it", () => {
    const rows = diffSetupData({ psi_lf: "22" }, { psi_lf: "22", wing_rear: "5" });
    const wing = rows.find((r) => r.key === "wing_rear");
    expect(wing.changed).toBe(true);
    expect(wing.missingIn).toBe("a");
    expect(wing.a).toBeNull();
  });

  it("treats null and empty string as equal (no false change)", () => {
    const rows = diffSetupData({ caster: null }, { caster: "" });
    expect(rows.find((r) => r.key === "caster").changed).toBe(false);
  });
});

describe("lapStats + comparePerformance", () => {
  const lapsA = [
    { lap_time_ms: 83456, sector_1_ms: 28000, sector_2_ms: 30000, sector_3_ms: 25456 },
    { lap_time_ms: 83106, sector_1_ms: 27900, sector_2_ms: 29900, sector_3_ms: 25306 },
    { lap_time_ms: 83800, sector_1_ms: 28100, sector_2_ms: 30100, sector_3_ms: 25600 },
  ];
  const lapsB = [
    { lap_time_ms: 82900, sector_1_ms: 27800, sector_2_ms: 29850, sector_3_ms: 25250 },
    { lap_time_ms: 82750, sector_1_ms: 27750, sector_2_ms: 29800, sector_3_ms: 25200 },
  ];

  it("computes best and average lap times correctly", () => {
    const a = lapStats(lapsA);
    expect(a.bestMs).toBe(83106);
    expect(a.avgMs).toBe(Math.round((83456 + 83106 + 83800) / 3));
    expect(a.count).toBe(3);
    expect(a.bestS2).toBe(29900);
  });

  it("calculates lap-time differences correctly (B faster = negative delta)", () => {
    const deltas = comparePerformance(lapStats(lapsA), lapStats(lapsB));
    const best = deltas.find((d) => d.label === "Best lap");
    expect(best.deltaMs).toBe(82750 - 83106); // -356
    const s3 = deltas.find((d) => d.label === "Sector 3 (best)");
    expect(s3.deltaMs).toBe(25200 - 25306); // -106
  });

  it("reports null deltas when one side has no data", () => {
    const deltas = comparePerformance(lapStats(lapsA), lapStats([]));
    expect(deltas.find((d) => d.label === "Best lap").deltaMs).toBeNull();
  });

  it("buildWhatImproved names the faster session without claiming cause", () => {
    const deltas = comparePerformance(lapStats(lapsA), lapStats(lapsB));
    const lines = buildWhatImproved(deltas, "FP1", "FP2");
    expect(lines.some((l) => l.includes("Best lap") && l.includes("FP2") && l.includes("0.356s"))).toBe(true);
    expect(lines.join(" ").toLowerCase()).not.toContain("because");
  });
});

describe("formatDeltaMs", () => {
  it("formats signed deltas", () => {
    expect(formatDeltaMs(356)).toBe("+0.356s");
    expect(formatDeltaMs(-106)).toBe("-0.106s");
    expect(formatDeltaMs(0)).toBe("0.000s");
  });
});
