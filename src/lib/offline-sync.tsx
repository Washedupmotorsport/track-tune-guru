import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  buildWrite, dequeue, enqueue, loadQueue, partitionFlush,
  type QueuedWrite, type StorageLike,
} from "./offline-queue";

const storage = (): StorageLike => window.localStorage;

/**
 * Insert a row, queueing it locally when offline (or when the write fails
 * because the network dropped mid-request). Returns the row id either way.
 * Queued rows carry their final UUID, so syncing later upserts the same row
 * and can never create a duplicate.
 */
export function useOfflineInsert() {
  const qc = useQueryClient();
  return useCallback(
    async (
      table: QueuedWrite["table"],
      payload: Record<string, unknown>,
    ): Promise<{ id: string; queued: boolean }> => {
      const write = buildWrite(table, payload);
      if (navigator.onLine) {
        const { error } = await supabase.from(table).insert(write.payload as never);
        if (!error) return { id: write.id, queued: false };
        // Fall through to queueing — a failed write is treated as offline work.
      }
      enqueue(storage(), write);
      toast.message("Saved offline", { description: "Will sync automatically when reception returns." });
      qc.invalidateQueries({ queryKey: ["offline-queue-count"] });
      return { id: write.id, queued: true };
    },
    [qc],
  );
}

/** Number of writes waiting to sync (reactive via the offline-queue-count key). */
export function useOfflineQueueCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(loadQueue(storage()).length);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const t = setInterval(update, 3000);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); clearInterval(t); };
  }, []);
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
  useEffect(() => {
    let running = false;
    const flush = async () => {
      if (running || !navigator.onLine) return;
      const queue = loadQueue(storage());
      if (!queue.length) return;
      running = true;
      const outcomes: Record<string, boolean> = {};
      for (const w of queue) {
        const { error } = await supabase
          .from(w.table)
          .upsert(w.payload as never, { onConflict: "id", ignoreDuplicates: true });
        outcomes[w.id] = !error;
      }
      const { synced, failed } = partitionFlush(queue, outcomes);
      if (synced.length) {
        dequeue(storage(), synced);
        toast.success(`${synced.length} offline change${synced.length === 1 ? "" : "s"} synced`);
        qc.invalidateQueries(); // refresh every list so synced records appear
      }
      if (failed.length) {
        toast.error(`${failed.length} offline change${failed.length === 1 ? "" : "s"} could not sync yet — still queued`);
      }
      running = false;
    };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [qc]);
}
