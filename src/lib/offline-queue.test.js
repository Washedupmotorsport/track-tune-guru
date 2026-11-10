import { describe, it, expect, beforeEach } from "bun:test";
import {
  parseQueue,
  loadQueue,
  saveQueue,
  enqueue,
  dequeue,
  queueCount,
  accountQueue,
  isRetryableWriteError,
  buildWrite,
  partitionFlush,
  OFFLINE_QUEUE_KEY,
} from "./offline-queue.ts";

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

let storage;
beforeEach(() => {
  storage = fakeStorage();
});

describe("parseQueue", () => {
  it("returns empty for null, garbage and non-arrays", () => {
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue("not json")).toEqual([]);
    expect(parseQueue("{}")).toEqual([]);
  });

  it("drops malformed entries", () => {
    const good = { id: "a", table: "laps", payload: {}, queuedAt: "t" };
    const raw = JSON.stringify([good, { id: 5 }, { table: "laps" }, null]);
    expect(parseQueue(raw)).toEqual([good]);
  });
});

describe("enqueue / dequeue", () => {
  const w = (id) => ({ id, table: "laps", payload: { id, lap_time_ms: 90000 }, queuedAt: "t" });

  it("queues writes in order", () => {
    enqueue(storage, w("a"));
    enqueue(storage, w("b"));
    expect(loadQueue(storage).map((x) => x.id)).toEqual(["a", "b"]);
    expect(queueCount(storage)).toBe(2);
  });

  it("never duplicates an id", () => {
    enqueue(storage, w("a"));
    enqueue(storage, w("a"));
    expect(queueCount(storage)).toBe(1);
  });

  it("dequeue removes only the given ids", () => {
    enqueue(storage, w("a"));
    enqueue(storage, w("b"));
    enqueue(storage, w("c"));
    dequeue(storage, ["a", "c"]);
    expect(loadQueue(storage).map((x) => x.id)).toEqual(["b"]);
  });

  it("saveQueue removes the storage key when empty", () => {
    enqueue(storage, w("a"));
    dequeue(storage, ["a"]);
    expect(storage.getItem(OFFLINE_QUEUE_KEY)).toBeNull();
  });
});

describe("buildWrite", () => {
  it("puts the generated id into the payload so flush upserts the same row", () => {
    let n = 0;
    const write = buildWrite(
      "tire_logs",
      { car_id: "c1", hot_fl: 31 },
      () => `uuid-${++n}`,
      () => "now",
    );
    expect(write.id).toBe("uuid-1");
    expect(write.payload.id).toBe("uuid-1");
    expect(write.payload.car_id).toBe("c1");
    expect(write.queuedAt).toBe("now");
  });

  it("two writes always get distinct ids (duplicate prevention)", () => {
    const a = buildWrite("laps", { lap: 1 });
    const b = buildWrite("laps", { lap: 1 });
    expect(a.id).not.toBe(b.id);
  });
});

describe("partitionFlush", () => {
  it("synced ids leave the queue, failed ids stay for next reconnect", () => {
    const queue = [
      { id: "a", table: "laps", payload: {}, queuedAt: "t" },
      { id: "b", table: "laps", payload: {}, queuedAt: "t" },
    ];
    const r = partitionFlush(queue, { a: true, b: false });
    expect(r.synced).toEqual(["a"]);
    expect(r.failed).toEqual(["b"]);
  });
});

it("only exposes queued writes belonging to the current account", () => {
  enqueue(
    storage,
    buildWrite("laps", { user_id: "account-a" }, () => "a"),
  );
  enqueue(
    storage,
    buildWrite("laps", { user_id: "account-b" }, () => "b"),
  );
  expect(accountQueue(storage, "account-b").map((w) => w.id)).toEqual(["b"]);
  expect(accountQueue(storage, null)).toEqual([]);
});

it("cancel removes the queued lap before a later sync can see it", () => {
  enqueue(
    storage,
    buildWrite("laps", { user_id: "a" }, () => "lap-a"),
  );
  dequeue(storage, ["lap-a"]);
  expect(accountQueue(storage, "a")).toEqual([]);
});

it("retains the time feedback was captured rather than reconnect time", () => {
  const write = buildWrite(
    "driver_feedback",
    { user_id: "a" },
    () => "feedback",
    () => "2026-11-10T10:00:00Z",
  );
  expect(write.payload.recorded_at).toBe("2026-11-10T10:00:00Z");
});

it("queues transport failures but not permission or validation failures", () => {
  expect(isRetryableWriteError({ message: "Failed to fetch" }, 0)).toBe(true);
  expect(isRetryableWriteError({ code: "42501", message: "permission denied" }, 403)).toBe(false);
  expect(isRetryableWriteError({ code: "23514", message: "invalid value" }, 400)).toBe(false);
  expect(isRetryableWriteError({ message: "unavailable" }, 503)).toBe(true);
});
