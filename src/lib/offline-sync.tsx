import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./auth-context";
import {
  accountQueue,
  buildWrite,
  dequeue,
  enqueue,
  isRetryableWriteError,
  type QueuedWrite,
  type StorageLike,
} from "./offline-queue";

const storage = (): StorageLike => window.localStorage;
export const QUEUE_CHANGED = "mre:queue-changed";
const notifyQueue = () => window.dispatchEvent(new Event(QUEUE_CHANGED));
const uploading = new Map<string, Promise<unknown>>();

/** Cancel local work first, then wait for any in-flight upload before deleting. */
export async function cancelOfflineLap(id: string, userId: string) {
  const queued = accountQueue(storage(), userId).find((w) => w.id === id && w.table === "laps");
  if (queued) {
    dequeue(storage(), [id]);
    notifyQueue();
  }
  const pending = uploading.get(id);
  if (pending) await pending;
  if (!queued || pending) {
    const { error } = await supabase.from("laps").delete().eq("id", id).eq("user_id", userId);
    if (error) throw error;
  }
}

/**
 * Insert a row, queueing it locally when offline (or when the write fails
 * because the network dropped mid-request). Returns the row id either way.
 * Queued rows carry their final UUID, so syncing later upserts the same row
 * and can never create a duplicate.
 */
export function useOfflineInsert() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useCallback(
    async (
      table: QueuedWrite["table"],
      payload: Record<string, unknown>,
    ): Promise<{ id: string; queued: boolean }> => {
      if (!user || payload.user_id !== user.id) throw new Error("Sign in to save this record");
      const write = buildWrite(table, payload);
      if (navigator.onLine) {
        const { error, status } = await supabase.from(table).insert(write.payload as never);
        if (!error) return { id: write.id, queued: false };
        if (!isRetryableWriteError(error, status)) throw new Error(error.message);
      }
      enqueue(storage(), write);
      notifyQueue();
      toast.message("Saved offline", {
        description: "Will sync automatically when reception returns.",
      });
      qc.invalidateQueries({ queryKey: ["offline-queue-count"] });
      return { id: write.id, queued: true };
    },
    [qc, user?.id],
  );
}

/** Number of writes waiting to sync (reactive via the offline-queue-count key). */
export function useOfflineQueueCount(): number {
  const [count, setCount] = useState(0);
  const { user } = useAuth();
  useEffect(() => {
    const update = () => setCount(accountQueue(storage(), user?.id).length);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener(QUEUE_CHANGED, update);
    const t = setInterval(update, 3000);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener(QUEUE_CHANGED, update);
      clearInterval(t);
    };
  }, [user?.id]);
  return count;
}

/**
 * Flush the offline queue when connectivity returns (and once on mount).
 * Each write is upserted by its client UUID with ignoreDuplicates, so:
 * - flushing twice never duplicates a record
 * - a record that already exists on the server is never overwritten
 * Failed writes stay queued for the next reconnect.
 */
export function useOfflineSync() {
  const qc = useQueryClient();
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    let running = false;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(flush, 1000);
    };
    const flush = async () => {
      if (disposed || running || !navigator.onLine) return;
      const queue = accountQueue(storage(), user.id);
      if (!queue.length) return;
      running = true;
      let synced = 0;
      try {
        for (const w of queue) {
          if (disposed) break;
          if (!accountQueue(storage(), user.id).some((row) => row.id === w.id)) continue;
          // Auth may have changed while waiting for an earlier upload.
          const { data } = await supabase.auth.getSession();
          if (data.session?.user.id !== user.id || disposed) break;
          if (!accountQueue(storage(), user.id).some((row) => row.id === w.id)) continue;
          const request = Promise.resolve(
            supabase
              .from(w.table)
              .upsert(w.payload as never, { onConflict: "id", ignoreDuplicates: true }),
          );
          uploading.set(w.id, request);
          try {
            const { error } = await request;
            if (!error) {
              dequeue(storage(), [w.id]);
              synced++;
            }
          } finally {
            uploading.delete(w.id);
          }
        }
        if (synced && !disposed) {
          notifyQueue();
          toast.success(`${synced} offline change${synced === 1 ? "" : "s"} synced`);
          qc.invalidateQueries();
        }
      } catch {
        // Transport exceptions leave records queued for the scheduled retry.
      } finally {
        running = false;
        if (!disposed && accountQueue(storage(), user.id).length) timer = setTimeout(flush, 10000);
      }
    };
    flush();
    window.addEventListener("online", flush);
    window.addEventListener(QUEUE_CHANGED, schedule);
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener("online", flush);
      window.removeEventListener(QUEUE_CHANGED, schedule);
    };
  }, [qc, user?.id]);
}
