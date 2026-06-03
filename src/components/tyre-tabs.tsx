import { Link, useRouterState } from "@tanstack/react-router";
import { Gauge, TrendingDown, GitCompare, Disc } from "lucide-react";

const TABS = [
  { to: "/tyre-setup",   label: "Pressures", icon: Gauge },
  { to: "/tyre-wear",    label: "Wear",      icon: TrendingDown },
  { to: "/tyre-compare", label: "Compare",   icon: GitCompare },
  { to: "/tires",        label: "Sets",      icon: Disc },
] as const;

export function TyreTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Tyres"
      className="mb-4 -mx-1 flex items-center gap-1 overflow-x-auto rounded-md border border-border bg-card/50 p-1"
    >
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = pathname === t.to;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={
              "inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[11px] font-mono uppercase tracking-[0.18em] whitespace-nowrap transition-colors " +
              (active
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-primary border border-transparent hover:bg-muted/40")
            }
          >
            <Icon className="w-3.5 h-3.5" /> {t.label}
          </Link>
        );
      })}
    </nav>
  );
}