import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  LogOut, Calculator, Wand2, NotebookPen, Timer, Disc, Wrench,
  Package, CalendarDays, Receipt, BarChart3, Menu, Search, Sun, Moon,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { CommandPalette } from "@/components/command-palette";
import { useUnits, CURRENCIES, type CurrencyCode } from "@/lib/units";
import { useTheme } from "@/lib/theme";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { system, toggle, currency, setCurrency } = useUnits();
  const { theme, toggle: toggleTheme } = useTheme();
  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link to="/garage" className="flex items-center gap-2 font-display font-bold">
            <span className="inline-block w-2 h-6 bg-primary shadow-glow" />
            MY RACE<span className="text-primary">ENGINEER</span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="hidden md:inline-flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary/40"
              aria-label="Search"
            >
              <Search className="w-3.5 h-3.5" /> Search
              <span className="ml-2 text-[10px] opacity-70">⌘K</span>
            </button>
            <button
              onClick={toggle}
              title="Toggle metric / imperial"
              aria-label="Toggle units"
              className="inline-flex items-center rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary/40"
            >
              <span className={system === "metric" ? "text-primary" : ""}>SI</span>
              <span className="mx-1 opacity-40">/</span>
              <span className={system === "imperial" ? "text-primary" : ""}>US</span>
            </button>
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              aria-label="Toggle theme"
              className="inline-flex items-center justify-center rounded-md border border-border bg-muted/30 h-[34px] w-[34px] text-muted-foreground hover:text-primary hover:border-primary/40"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
              <SelectTrigger
                aria-label="Currency"
                className="h-[34px] w-[78px] rounded-md border border-border bg-muted/30 px-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary/40"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="font-mono text-xs">
                    {c.code} <span className="text-muted-foreground ml-2">{c.symbol}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <DropdownMenuItem asChild><Link to="/tyre-setup"><Gauge className="w-4 h-4 mr-2" /> Tyre setup</Link></DropdownMenuItem>
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
      <CommandPalette />
    </div>
  );
}