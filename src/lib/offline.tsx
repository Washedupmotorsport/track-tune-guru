import { useEffect, useState } from "react";
import { useIsRestoring, useIsMutating, IsRestoringProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { QueryClient } from "@tanstack/react-query";
import { WifiOff, CloudUpload, HardDrive } from "lucide-react";

/**
 * Client-only persister. Mounts the localStorage persister AFTER hydration so
 * SSR never touches `window`. Children render through a manual
 * IsRestoringProvider so components can show a "loading cache" state during
 * the brief restore step.
 */
export function OfflinePersistGate({ client, children }: { client: QueryClient; children: React.ReactNode }) {
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "mre-rq-cache-v1",
      throttleTime: 1000,
    });
    const [unsubscribe, restorePromise] = persistQueryClient({
      queryClient: client,
      persister,
      maxAge: 1000 * 60 * 60 * 24 * 7,
      buster: "v1",
    });
    restorePromise.finally(() => setIsRestoring(false));
    return () => unsubscribe();
  }, [client]);

  return <IsRestoringProvider value={isRestoring}>{children}</IsRestoringProvider>;
}

/** Track navigator.onLine after hydration. SSR-safe. */
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/**
 * Compact pit-lane status chip:
 * - green dot when online and all writes synced
 * - amber pulsing when online with pending writes (sync in progress)
 * - red when offline (writes queued locally)
 * - gray "cache" while the persisted cache is hydrating on cold load
 */
export function ConnectionStatus() {
  const online = useOnline();
  const pending = useIsMutating();
  const restoring = useIsRestoring();

  if (restoring) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground" title="Loading cached data">
        <HardDrive className="w-3 h-3" /> Cache
      </span>
    );
  }
  if (!online) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-destructive/60 bg-destructive/10 px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-destructive" title="Offline — changes queued locally">
        <WifiOff className="w-3 h-3" /> Offline{pending > 0 ? ` · ${pending}` : ""}
      </span>
    );
  }
  if (pending > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-primary/60 bg-primary/10 px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-primary animate-pulse" title="Syncing changes">
        <CloudUpload className="w-3 h-3" /> Sync · {pending}
      </span>
    );
  }
  return null;
}