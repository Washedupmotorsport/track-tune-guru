import { describe, it, expect } from "bun:test";
import {
  analyzeHandlingIssue,
  pressureGainPsi,
  HANDLING_ISSUES,
  HIGH_PRESSURE_GAIN_PSI,
} from "./handling-assistant.ts";

const FULL_SETUP = {
  psi_lf: 24, psi_rf: 24, psi_lr: 22, psi_rr: 22,
  hot_psi_lf: 31, hot_psi_rf: 31,
  camber_lf: -3.0, camber_rf: -3.0, toe_front: "0.1 out", caster: 4.5,
  spring_front: 8, arb_front: 3, comp_front: 5, reb_front: 6, ride_front: 70,
  wing_front: 2,
};

const TYRE_HIGH_GAIN = {
  cold_fl: 24, cold_fr: 24, hot_fl: 31, hot_fr: 31, // +7 gain > HIGH_PRESSURE_GAIN_PSI
  compound: "soft",
};

const CONDITIONS = {
  cornerSpeed: "medium",
  brakingPhase: "trail",
  throttlePosition: "maintenance",
  trackConditions: "dry",
  tyreCondition: "scrubbed",
};

describe("analyzeHandlingIssue — mid-corner understeer validation scenario", () => {
  const result = analyzeHandlingIssue({
    issueId: "mid_understeer",
    conditions: CONDITIONS,
    setupData: FULL_SETUP,
    tyre: TYRE_HIGH_GAIN,
    sessionsCount: 4,
  });

  it("considers tyre pressures, alignment and suspension before suggesting a test", () => {
    expect(result.dataConsidered).toContain("Tyre pressures");
    expect(result.dataConsidered).toContain("Alignment (camber, caster, toe)");
    expect(result.dataConsidered).toContain("Springs, dampers & anti-roll bars");
  });

  it("considers available session history", () => {
    expect(result.dataConsidered.some((d) => d.includes("4 recorded sessions"))).toBe(true);
  });

  it("returns at most three possible causes", () => {
    expect(result.causes.length).toBeGreaterThan(0);
    expect(result.causes.length).toBeLessThanOrEqual(3);
  });

  it("grounds causes in recorded data with evidence notes", () => {
    const pressureCause = result.causes.find((c) => c.id === "front_pressure");
    expect(pressureCause).toBeDefined();
    expect(pressureCause.evidence).toContain("Cold pressure FL = 24");
  });

  it("recommends a pressure test when front hot pressure gain is high", () => {
    expect(result.recommendedTest).toContain("front cold pressures");
  });

  it("explains the expected result and side effects", () => {
    expect(result.expectedResult.length).toBeGreaterThan(10);
    expect(result.alsoAffects.length).toBeGreaterThan(10);
  });

  it("reports nothing missing when data and conditions are complete", () => {
    expect(result.missingData).toEqual([]);
  });
});

describe("missing data handling", () => {
  it("lists missing setup values instead of inventing them", () => {
    const result = analyzeHandlingIssue({
      issueId: "mid_understeer",
      conditions: {},
      setupData: {},
      tyre: null,
      sessionsCount: 0,
    });
    expect(result.missingData.some((m) => m.includes("Setup values not recorded"))).toBe(true);
    expect(result.missingData).toContain("No tyre pressure/temperature log recorded for this car");
    expect(result.missingData).toContain("Corner speed not specified");
    expect(result.missingData).toContain("No previous sessions recorded for this car to compare against");
    // causes still exist but carry no fabricated evidence
    for (const c of result.causes) expect(c.evidence).toBeNull();
  });

  it("falls back to a non-pressure test when no tyre data supports one", () => {
    const result = analyzeHandlingIssue({
      issueId: "mid_understeer",
      conditions: CONDITIONS,
      setupData: FULL_SETUP,
      tyre: null,
      sessionsCount: 1,
    });
    expect(result.recommendedTest).toContain("anti-roll bar");
  });
});

describe("safety-critical issues", () => {
  it.each(["braking_instability", "bottoming", "entry_oversteer", "mid_oversteer", "exit_oversteer"])(
    "flags %s as safety-critical with a caution note",
    (id) => {
      const result = analyzeHandlingIssue({
        issueId: id, conditions: CONDITIONS, setupData: {}, tyre: null, sessionsCount: 0,
      });
      expect(result.issue.safetyCritical).toBe(true);
      expect(result.safetyNote).toContain("one small step at a time");
    },
  );

  it("does not flag mid-corner understeer as safety-critical", () => {
    const result = analyzeHandlingIssue({
      issueId: "mid_understeer", conditions: CONDITIONS, setupData: {}, tyre: null, sessionsCount: 0,
    });
    expect(result.issue.safetyCritical).toBe(false);
    expect(result.safetyNote).toBeNull();
  });
});

describe("issue catalogue", () => {
  it("covers all eleven brief issues with causes and tests", () => {
    expect(HANDLING_ISSUES).toHaveLength(11);
    for (const issue of HANDLING_ISSUES) {
      expect(issue.causes.length).toBeGreaterThanOrEqual(3);
      expect(issue.tests.length).toBeGreaterThanOrEqual(1);
      expect(issue.label.length).toBeGreaterThan(3);
    }
  });

  it("throws on an unknown issue id", () => {
    expect(() =>
      analyzeHandlingIssue({ issueId: "nope", conditions: {}, setupData: {}, tyre: null, sessionsCount: 0 }),
    ).toThrow();
  });
});

describe("pressureGainPsi", () => {
  it("averages hot-minus-cold across an end", () => {
    expect(pressureGainPsi({ cold_fl: 20, hot_fl: 26, cold_fr: 22, hot_fr: 28 }, "front")).toBe(6);
    expect(HIGH_PRESSURE_GAIN_PSI).toBe(6);
  });

  it("returns null when no pairs are recorded", () => {
    expect(pressureGainPsi({}, "rear")).toBeNull();
  });
});
