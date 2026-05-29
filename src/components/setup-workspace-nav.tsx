import { Link, useRouterState } from "@tanstack/react-router";
import { BookMarked, Wand2, GitBranch, BookOpen, NotebookPen } from "lucide-react";

const TABS = [
  { to: "/setup-library", label: "Library",      icon: BookMarked, blurb: "Saved philosophies, best laps, tyre + confidence" },
  { to: "/baseline",      label: "Baseline",     icon: Wand2,      blurb: "Generate a starting point" },
  { to: "/iteration",     label: "Iteration",    icon: GitBranch,  blurb: "Track every change and its effect" },
  { to: "/philosophies",  label: "Philosophies", icon: BookOpen,   blurb: "Long-form setup principles" },
  { to: "/notes",         label: "Notes",        icon: NotebookPen, blurb: "Engineering notebook" },
] as const;

/**
 * Sub-nav rendered at the top of every Setup workspace page so Library /
 * Baseline / Iteration / Philosophies / Notes feel like one consolidated
 * workflow rather than five separate menu items.
 */
export function SetupWorkspaceNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Setup workspace" className="-mt-1 mb-4 flex flex-wrap items-center gap-1 border-b border-border pb-2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mr-2">Setup</span>
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = pathname === t.to || pathname.startsWith(t.to + "/");
        return (
          <Link
            key={t.to}
            to={t.to}
            title={t.blurb}
            className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[10px] font-mono uppercase tracking-widest border transition-colors ${
              active
                ? "bg-primary/15 text-primary border-primary/40"
                : "text-muted-foreground border-border hover:text-primary hover:border-primary/40"
            }`}
          >
            <Icon className="w-3 h-3" /> {t.label}
          </Link>
        );
      })}
    </nav>
  );
}