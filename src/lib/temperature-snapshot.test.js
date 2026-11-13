import { it, expect } from "bun:test";
import { temperatureSnapshotPayload, readTemperatureSnapshot } from "./temperature-snapshot";
import { buildWrite } from "./offline-queue";

it("queues temperatures for the captured session and car without losing decimals or capture time", () => {
  const snap = {
    id: "draft",
    t: Date.parse("2026-11-13T05:00:00Z"),
    air: 26.5,
    track: 34.5,
    minute: 2,
    hotAvg: null,
    grip: 6,
    surface: "dry",
    laps: 0,
    note: "test",
  };
  const write = buildWrite(
    "timeline_events",
    temperatureSnapshotPayload("crew", "practice-2", "vl", snap),
    () => "uuid",
    () => "2026-11-13T06:00:00Z",
  );
  expect(write.payload.session_id).toBe("practice-2");
  expect(write.payload.metadata.car_id).toBe("vl");
  expect(write.payload.occurred_at).toBe("2026-11-13T05:00:00.000Z");
  expect(write.payload).not.toHaveProperty("recorded_at");
  expect(readTemperatureSnapshot({ id: write.id, metadata: write.payload.metadata })).toMatchObject(
    { id: "uuid", air: 26.5, track: 34.5 },
  );
});

it("rejects missing session context and invalid temperatures", () => {
  expect(() => temperatureSnapshotPayload("u", "", "c", { air: 26, track: 34 })).toThrow();
  expect(() => temperatureSnapshotPayload("u", "s", "c", { air: NaN, track: 34 })).toThrow();
});
