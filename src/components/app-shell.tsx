import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut, Calculator, Wand2 } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link to="/garage" className="flex items-center gap-2 font-display font-bold">
            <span className="inline-block w-2 h-6 bg-primary shadow-glow" />
            APEX<span className="text-primary">SETUP</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/baseline" className="hidden sm:inline-flex items-center text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">
              <Wand2 className="w-4 h-4 mr-1" /> Baseline
            </Link>
            <Link to="/calculators" className="hidden sm:inline-flex items-center text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">
              <Calculator className="w-4 h-4 mr-1" /> Calculators
            </Link>
            <span className="hidden sm:block text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {user?.email}
            </span>
            <Button size="sm" variant="ghost" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}