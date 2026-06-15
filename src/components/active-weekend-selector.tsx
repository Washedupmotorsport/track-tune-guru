import { Link } from "@tanstack/react-router";
import { Check, Flag, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveWeekend } from "@/lib/active-weekend";

export function ActiveWeekendSelector() {
  const { activeWeekend, weekends, setActiveWeekendId } = useActiveWeekend();

  const label = activeWeekend?.title ?? "No active weekend";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Active weekend"
        title="Active weekend"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/40 h-8 px-2 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary max-w-[220px]"
      >
        <Flag className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="truncate font-display tracking-tight">{label}</span>
        <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs text-primary uppercase tracking-[0.15em]">
          Active weekend
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {weekends.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">No weekends yet.</div>
        )}
        {weekends.slice(0, 12).map((w) => {
          const isActive = w.id === activeWeekend?.id;
          return (
            <DropdownMenuItem
              key={w.id}
              onSelect={() => setActiveWeekendId(w.id)}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate">{w.title}</span>
              {isActive && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/weekends" className="text-xs">Manage weekends →</Link>
        </DropdownMenuItem>
        {activeWeekend && (
          <DropdownMenuItem asChild>
            <Link
              to="/weekends/$eventId"
              params={{ eventId: activeWeekend.id }}
              className="text-xs"
            >
              Open active weekend →
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}