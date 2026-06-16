import { Link } from "@tanstack/react-router";
import { Flag, Plus } from "lucide-react";

export function NoActiveWeekendEmpty({
  hint = "This view follows your active race weekend. Pick or create one to get going.",
}: { hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center">
      <Flag className="w-8 h-8 mx-auto text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">{hint}</p>
      <div className="mt-4 flex items-center justify-center gap-2">
        <Link
          to="/weekends"
          className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-mono uppercase tracking-widest hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" /> Create weekend
        </Link>
        <Link
          to="/calendar"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary"
        >
          Open calendar
        </Link>
      </div>
    </div>
  );
}