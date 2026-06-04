import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, X } from "lucide-react";

const KEY = "mre.first-time-callout.dismissed";

export function FirstTimeCallout() {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setDismissed(localStorage.getItem(KEY) === "1");
  }, []);
  if (dismissed) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        <BookOpen className="w-4 h-4 text-primary" />
        <span>
          <span className="font-medium">First time here?</span>{" "}
          Read the manual to get the most out of My Race Engineer.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to="/manual"
          className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 h-8 text-xs font-mono uppercase tracking-widest hover:bg-primary/90"
        >
          Open manual
        </Link>
        <button
          onClick={() => { localStorage.setItem(KEY, "1"); setDismissed(true); }}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-primary"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}