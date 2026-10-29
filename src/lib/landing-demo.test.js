import { test, expect } from "bun:test";
import { DEMO_BASELINE, exploreSetup } from "./landing-demo";

test("baseline stays neutral with a 27 PSI illustrative hot reading", () => {
  expect(exploreSetup(DEMO_BASELINE)).toMatchObject({
    hotPressure: 27,
    balance: 0,
    handling: "Neutral baseline",
  });
});
test("track temperature and surface change the illustrative pressure independently", () => {
  expect(exploreSetup({ ...DEMO_BASELINE, temperature: 42 }).hotPressure).toBe(28);
  expect(exploreSetup({ ...DEMO_BASELINE, surface: "damp" }).hotPressure).toBe(25);
  expect(exploreSetup({ ...DEMO_BASELINE, surface: "wet" }).hotPressure).toBe(23);
});
test("pressure and bar adjustments have distinct effects without mutating baseline", () => {
  expect(exploreSetup({ ...DEMO_BASELINE, pressure: 24 }).hotPressure).toBe(29);
  expect(exploreSetup({ ...DEMO_BASELINE, frontBar: 1 }).handling).toBe("More rotation");
  expect(exploreSetup({ ...DEMO_BASELINE, frontBar: 5 }).handling).toBe("More understeer");
  expect(DEMO_BASELINE).toEqual({ surface: "dry", temperature: 32, pressure: 22, frontBar: 3 });
});
test("scenario values are bounded to demo control ranges", () => {
  expect(
    exploreSetup({ surface: "dry", pressure: 100, temperature: 100, frontBar: 100 }),
  ).toMatchObject({ hotPressure: 35.3, balance: 2 });
  expect(
    exploreSetup({ surface: "dry", pressure: -100, temperature: -100, frontBar: -100 }),
  ).toMatchObject({ hotPressure: 21.3, balance: -2 });
});
