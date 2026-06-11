import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Zap, Gauge, Timer, Disc, Radio, ClipboardList, TriangleAlert as AlertTriangle, NotebookPen, Brain, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function QuickLogFab() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/" || pathname.startsWith("/auth") || pathname.startsWith("/share") || pathname.startsWith("/terms")) return null;

  const flagCritical = async () => {
    const title = prompt("Describe the critical issue:");
    if (!title?.trim()) return;
    if (!user?.id) { toast.error("Not signed in"); return; }
    const { error } = await supabase.from("engineering_memory" as never).insert({
      user_id: user.id,
      title: title.trim(),
      priority: "critical",
      status: "active",
      category: "handling",
      confidence: 5,
      pinned: true,
      occurrences: 1,
    } as never);
    if (error) { toast.error(error.message); return; }
    toast.success("Critical issue flagged");
    setOpen(false);
  };

  const actions = [
    { to: "/engineering-memory", label: "Flag CRITICAL", icon: AlertTriangle, tone: "warn" },
    { to: "/tyre-setup",  label: "Tyre pressures", icon: Gauge,         tone: "primary" },
    { to: "/sessions",    label: "New lap",        icon: Timer,         tone: "primary" },
    { to: "/tires",       label: "Tyre log",       icon: Disc,          tone: "default" },
    { to: "/debrief",     label: "Driver debrief", icon: ClipboardList, tone: "default" },
    { to: "/flags",       label: "Track incident", icon: AlertTriangle, tone: "default" },
    { to: "/notes",       label: "Quick note",     icon: NotebookPen,   tone: "default" },
    { to: "/engineering-memory", label: "Notebook entry", icon: Brain, tone: "default" },
    { to: "/pitwall",     label: "Pit wall",       icon: Radio,         tone: "default" },
  ] as const;

  return (
    <>
      <button
        type="button"
        aria-label="Pit-lane quick actions"
        onClick={() => setOpen(true)}
        className="md:hidden fixed right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-glow flex items-center justify-center active:scale-95 transition touch-manipulation"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}
      >
        <Zap className="w-6 h-6" />
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="font-display uppercase tracking-widest text-base">
              Pit-lane quick actions
            </DrawerTitle>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Tap to jump · single-handed
            </p>
          </DrawerHeader>
          <div className="grid grid-cols-2 gap-2 p-4 pt-0 pb-6">
            <button
              type="button"
              onClick={flagCritical}
              className="flex flex-col items-center justify-center gap-2 h-24 rounded-md border-[1.5px] active:scale-[0.98] transition border-destructive/50 bg-destructive/10 text-destructive"
            >
              <ShieldAlert className="w-7 h-7" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-center leading-tight px-1">
                Flag issue → Critical
              </span>
            </button>
            {actions.map((a) => {
              const Icon = a.icon;
              const tone =
                a.tone === "primary"
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : a.tone === "warn"
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "border-border bg-card text-foreground";
              return (
                <Link
                  key={a.label}
                  to={a.to}
                  onClick={() => setOpen(false)}
                  className={`flex flex-col items-center justify-center gap-2 h-24 rounded-md border-[1.5px] active:scale-[0.98] transition ${tone}`}
                >
                  <Icon className="w-7 h-7" />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-center leading-tight px-1">
                    {a.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}