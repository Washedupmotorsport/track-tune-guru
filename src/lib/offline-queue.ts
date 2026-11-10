// Offline write queue for race-weekend data entry at circuits with poor reception.
//
// Design rules (per product brief):
// - every queued write carries a client-generated UUID, so flushing twice can
//   never create duplicate records (server upsert ignores existing ids)
// - queued writes are INSERTS of new records (tyre logs, feedback, laps);
//   flushing uses upsert with ignoreDuplicates, so a record that already
//   exists on the server is never silently overwritten
// - the queue is per-browser and only ever holds the signed-in user's own
//   writes; it is cleared on sign-out by the caller
// - pure helpers are exported for tests; storage access is injectable

export type QueuedWrite = {
  /** Client-generated UUID, also used as the row's primary key. */
  id: string;
  table: "tire_logs" | "driver_feedback" | "laps";
  payload: Record<string, unknown>;
  queuedAt: string;
};

export const OFFLINE_QUEUE_KEY = "mre-offline-queue-v1";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Parse the stored queue defensively — anything unexpected becomes an empty queue. */
export function parseQueue(raw: string | null): QueuedWrite[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (w): w is QueuedWrite =>
        !!w && typeof w === "object" &&
        typeof w.id === "string" && w.id.length > 0 &&
        typeof w.table === "string" &&
        !!w.payload && typeof w.payload === "object" &&
        typeof w.queuedAt === "string",
    );
  } catch {
    return [];
  }
}

export function loadQueue(storage: StorageLike): QueuedWrite[] {
  return parseQueue(storage.getItem(OFFLINE_QUEUE_KEY));
}

export function saveQueue(storage: StorageLike, queue: QueuedWrite[]): void {
  if (queue.length === 0) storage.removeItem(OFFLINE_QUEUE_KEY);
  else storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

/** Add a write; an entry with the same id is replaced, never duplicated. */
export function enqueue(storage: StorageLike, write: QueuedWrite): QueuedWrite[] {
  const queue = loadQueue(storage).filter((w) => w.id !== write.id);
  queue.push(write);
  saveQueue(storage, queue);
  return queue;
}

/** Remove successfully synced writes by id. */
export function dequeue(storage: StorageLike, ids: string[]): QueuedWrite[] {
  const drop = new Set(ids);
  const queue = loadQueue(storage).filter((w) => !drop.has(w.id));
  saveQueue(storage, queue);
  return queue;
}

export function queueCount(storage: StorageLike): number {
  return loadQueue(storage).length;
}

/**
 * Build a queued write. The generated id becomes the row's primary key, so a
 * later flush upserts the same row instead of inserting a duplicate.
 * `makeId` is injectable for tests (and must never be called at module scope).
 */
export function buildWrite(
  table: QueuedWrite["table"],
  payload: Record<string, unknown>,
  makeId: () => string = () => crypto.randomUUID(),
  now: () => string = () => new Date().toISOString(),
): QueuedWrite {
  const id = makeId();
  return { id, table, payload: { ...payload, id }, queuedAt: now() };
}

export type FlushResult = { synced: string[]; failed: string[] };

/**
 * Partition queue entries by flush outcome. Kept pure so the sync hook's
 * bookkeeping is testable: synced ids are dequeued, failed ids stay queued
 * for the next reconnect.
 */
export function partitionFlush(queue: QueuedWrite[], outcomes: Record<string, boolean>): FlushResult {
  const synced: string[] = [];
  const failed: string[] = [];
  for (const w of queue) (outcomes[w.id] ? synced : failed).push(w.id);
  return { synced, failed };
}
