import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  LogOut, Calculator, Wand2, NotebookPen, Timer, Disc, Wrench,
  Package, CalendarDays, Receipt, BarChart3, Menu,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link to="/garage" className="flex items-center gap-2 font-display font-bold">
            <span className="inline-block w-2 h-6 bg-primary shadow-glow" />
            SUMMIT<span className="text-primary">RACING</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/sessions" className="hidden lg:inline-flex items-center text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">
              <Timer className="w-4 h-4 mr-1" /> Sessions
            </Link>
            <Link to="/analysis" className="hidden lg:inline-flex items-center text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">
              <BarChart3 className="w-4 h-4 mr-1" /> Analysis
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">
                  <Menu className="w-4 h-4 mr-1" /> More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-widest text-primary">Trackside</DropdownMenuLabel>
                <DropdownMenuItem asChild><Link to="/sessions"><Timer className="w-4 h-4 mr-2" /> Sessions</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/tires"><Disc className="w-4 h-4 mr-2" /> Tires</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/analysis"><BarChart3 className="w-4 h-4 mr-2" /> Analysis</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-widest text-primary">Workshop</DropdownMenuLabel>
                <DropdownMenuItem asChild><Link to="/maintenance"><Wrench className="w-4 h-4 mr-2" /> Maintenance</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/inventory"><Package className="w-4 h-4 mr-2" /> Inventory</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-widest text-primary">Plan</DropdownMenuLabel>
                <DropdownMenuItem asChild><Link to="/calendar"><CalendarDays className="w-4 h-4 mr-2" /> Calendar</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/expenses"><Receipt className="w-4 h-4 mr-2" /> Expenses</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-widest text-primary">Tools</DropdownMenuLabel>
                <DropdownMenuItem asChild><Link to="/baseline"><Wand2 className="w-4 h-4 mr-2" /> Baseline</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/calculators"><Calculator className="w-4 h-4 mr-2" /> Calculators</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/notes"><NotebookPen className="w-4 h-4 mr-2" /> Notes</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="hidden xl:block text-xs font-mono uppercase tracking-widest text-muted-foreground">
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