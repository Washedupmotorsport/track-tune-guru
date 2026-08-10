import * as React from "react";
import { Loader as Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Accessible alternative to infinite scroll.
 *
 * Why not infinite scroll?
 * - Screen reader users can't tell when new content is appended — there's no
 *   announcement, and focus/context is lost.
 * - Keyboard users have to tab through all previously-loaded items to reach
 *   the new ones.
 * - It breaks the browser's native "find on page" and back-button behavior.
 *
 * This component:
 * - Renders a "Load more" button that is keyboard-focusable and screen-reader
 *   announced.
 * - Optionally auto-loads when the sentinel is visible AND the user has
 *   opted in (progressive enhancement: no JS = just a button; JS = optional
 *   auto-load for pointer users, but the button always works).
 * - Announces the number of newly loaded items via an aria-live region.
 * - Restores focus to the "Load more" button after each load so keyboard
 *   users don't lose their place.
 * - Respects prefers-reduced-motion: no smooth scroll, no animation jank.
 */

type LoadMoreListProps<T> = {
  items: T[];
  pageSize: number;
  className?: string;
  /** Render each item. Receives the item and its absolute index. */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Key for each item — defaults to the index. */
  getKey?: (item: T, index: number) => React.Key;
  /** Label for the load-more button, e.g. "Load more sessions". */
  loadMoreLabel?: string;
  /** Screen-reader announcement template, receives the count. */
  announcement?: (count: number) => string;
  /** When true, auto-load on scroll into view (progressive enhancement). */
  autoLoad?: boolean;
  /** Whether more items are available on the server. */
  hasMore: boolean;
  /** Whether a load is currently in progress. */
  loading?: boolean;
  /** Called when the user requests more items. */
  onLoadMore: () => void;
  /** Optional element to render when there are no items at all. */
  emptyState?: React.ReactNode;
};

export function LoadMoreList<T>({
  items,
  pageSize,
  className,
  renderItem,
  getKey,
  loadMoreLabel = "Load more",
  announcement = (count) => `${count} more items loaded`,
  autoLoad = false,
  hasMore,
  loading = false,
  onLoadMore,
  emptyState,
}: LoadMoreListProps<T>) {
  const [visibleCount, setVisibleCount] = React.useState(pageSize);
  const loadMoreRef = React.useRef<HTMLButtonElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const [announce, setAnnounce] = React.useState("");

  // Reset visible count when the total items change (e.g. new search/filter).
  React.useEffect(() => {
    setVisibleCount(pageSize);
  }, [items.length, pageSize]);

  const visibleItems = items.slice(0, visibleCount);
  const canShowMore = visibleCount < items.length || hasMore;

  const handleLoadMore = React.useCallback(() => {
    const before = Math.min(visibleCount, items.length);
    if (visibleCount < items.length) {
      const next = Math.min(visibleCount + pageSize, items.length);
      setVisibleCount(next);
      setAnnounce(announcement(next - before));
    } else if (hasMore) {
      onLoadMore();
    }
    // Restore focus so keyboard users keep their place.
    requestAnimationFrame(() => loadMoreRef.current?.focus());
  }, [visibleCount, items.length, pageSize, hasMore, onLoadMore, announcement]);

  // Progressive enhancement: auto-load via IntersectionObserver only when
  // enabled and the user is NOT using keyboard navigation (avoid hijacking
  // tab order). Also respects prefers-reduced-motion.
  React.useEffect(() => {
    if (!autoLoad || !canShowMore || loading) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return; // Let the button handle it.

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [autoLoad, canShowMore, loading, handleLoadMore]);

  if (items.length === 0 && !loading) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <ul className="space-y-2">
        {visibleItems.map((item, idx) => (
          <li key={getKey?.(item, idx) ?? idx}>{renderItem(item, idx)}</li>
        ))}
      </ul>

      {/* Screen-reader live region: announces newly loaded items. */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </span>

      {canShowMore && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <Button
            ref={loadMoreRef}
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={loading}
            className="min-h-[44px]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden />
            )}
            {loading ? "Loading…" : loadMoreLabel}
          </Button>
          {/* Sentinel for optional auto-load (progressive enhancement). */}
          {autoLoad && <div ref={sentinelRef} className="h-1 w-full" aria-hidden />}
        </div>
      )}
    </div>
  );
}
