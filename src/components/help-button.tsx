import { useRouterState, useNavigate } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import { findSectionForRoute } from "@/lib/manual-content";

export function HelpButton() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  return (
    <button
      onClick={() => {
        const section = findSectionForRoute(pathname);
        navigate({
          to: "/manual",
          search: section ? { section: section.id } : {},
        });
      }}
      title="Help for this screen"
      aria-label="Help"
      className="hidden md:inline-flex items-center justify-center rounded-md border border-border bg-muted/30 h-[34px] w-[34px] text-muted-foreground hover:text-primary hover:border-primary/40"
    >
      <HelpCircle className="w-4 h-4" />
    </button>
  );
}