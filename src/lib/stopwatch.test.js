import { expect, test } from "bun:test";
import { resetStopwatch } from "./stopwatch";

test("reset stops the stopwatch at zero", () => {
  expect(resetStopwatch()).toEqual({ startedAt: null, elapsedMs: 0 });
});