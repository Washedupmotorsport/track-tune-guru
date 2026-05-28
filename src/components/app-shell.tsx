import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  LogOut, Calculator, Wand2, NotebookPen, Timer, Disc, Wrench,
  Package, CalendarDays, Receipt, BarChart3, Menu, Search, Sun, Moon, Gauge, TrendingDown, GitCompare,
  Home, Flag, AlertTriangle, HardHat, Radio,
  ClipboardList, FileText,
  MapPin, CloudRain, ShieldAlert, BookOpen,
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
import logoMre from "@/assets/logo-mre.png";
import { ConnectionStatus } from "@/lib/offline";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { system, toggle, currency, setCurrency } = useUnits();
  const { theme, toggle: toggleTheme } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen text-foreground">
      <div className="h-[2px] w-full bg-primary" aria-hidden />
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-[1400px] px-4 h-12 flex items-center justify-between">
          <Link to="/garage" aria-label="My Race Engineer — garage" className="flex items-center">
            <img src={logoMre} alt="My Race Engineer" className="h-7 w-auto" />
          </Link>
          {/* Workspace tabs (desktop) — 5 race-team workspaces */}
          <nav aria-label="Workspaces" className="hidden lg:flex items-center gap-1 mx-3">
            {WORKSPACES.map((w) => {
              const Icon = w.icon;
              const active = w.matches.some((m) => pathname === m || pathname.startsWith(m + "/"));
              return (
                <Link
                  key={w.key}
                  to={w.to}
                  className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[11px] font-mono uppercase tracking-[0.18em] transition-colors ${
                    active
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-primary border border-transparent hover:bg-muted/30"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {w.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <ConnectionStatus />
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="hidden md:inline-flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary/40"
              aria-label="Search"
            >
              <Search className="w-3 h-3" /> <span className="opacity-70">⌘K</span>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">
                  <Menu className="w-4 h-4 mr-1" /> All
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {ALL_NAV_GROUPS.map((g) => (
                  <div key={g.label}>
                    <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-widest text-primary">{g.label}</DropdownMenuLabel>
                    {g.items.map((it) => {
                      const Icon = it.icon;
                      return (
                        <DropdownMenuItem key={it.to} asChild>
                          <Link to={it.to}><Icon className="w-4 h-4 mr-2" /> {it.label}</Link>
                        </DropdownMenuItem>
                      );
                    })}
                    <DropdownMenuSeparator />
                  </div>
                ))}
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
      <main className="mx-auto max-w-[1400px] px-4 py-4">{children}</main>
      <CommandPalette />
      <MobileTabBar />
      <div className="md:hidden h-[68px]" aria-hidden />
    </div>
  );
}

function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/garage",     label: "Garage",    icon: Home,    matches: ["/garage", "/cars", "/calendar", "/weekends"] },
    { to: "/pitwall",    label: "Trackside", icon: Radio,   matches: ["/pitwall", "/racemode", "/sessions", "/track-evolution", "/debrief", "/flags", "/timeline"] },
    { to: "/setups",     label: "Setup",     icon: Wand2,   matches: ["/setups", "/baseline", "/philosophies", "/corners", "/confidence", "/sympathy", "/notes"] },
    { to: "/tyre-setup", label: "Tyres",     icon: Disc,    matches: ["/tyre-setup", "/tyre-wear", "/tyre-compare", "/tires"] },
    { to: "/workshop",   label: "Workshop",  icon: HardHat, matches: ["/workshop", "/maintenance", "/damage", "/inventory", "/expenses", "/reports"] },
  ] as const;
  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="h-[2px] w-full bg-primary/70" aria-hidden />
      <ul className="grid grid-cols-5">
        {items.map((it) => {
          const Icon = it.icon;
          const active = it.matches.some((m) => pathname === m || pathname.startsWith(m + "/"));
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className={`flex flex-col items-center justify-center gap-1 h-16 text-[10px] font-mono uppercase tracking-widest active:bg-primary/10 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-primary"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---------------- Workspace taxonomy ----------------
// 5 race-team workspaces. Each has a "front door" route the tab links to;
// every existing page remains accessible from the All-routes menu and
// (where it makes sense) from the workspace front-door page.

const WORKSPACES = [
  { key: "garage",    label: "Garage",    icon: Home,    to: "/garage",     matches: ["/garage", "/cars", "/calendar", "/weekends"] },
  { key: "trackside", label: "Trackside", icon: Radio,   to: "/pitwall",    matches: ["/pitwall", "/racemode", "/sessions", "/track-evolution", "/debrief", "/flags", "/timeline"] },
  { key: "setup",     label: "Setup",     icon: Wand2,   to: "/setups",     matches: ["/setups", "/baseline", "/philosophies", "/corners", "/confidence", "/sympathy", "/notes"] },
  { key: "tyres",     label: "Tyres",     icon: Disc,    to: "/tyre-setup", matches: ["/tyre-setup", "/tyre-wear", "/tyre-compare", "/tires"] },
  { key: "workshop",  label: "Workshop",  icon: HardHat, to: "/workshop",   matches: ["/workshop", "/maintenance", "/damage", "/inventory", "/expenses", "/reports"] },
] as const;

const ALL_NAV_GROUPS = [
  {
    label: "Garage",
    items: [
      { to: "/garage",   label: "Garage",         icon: Home },
      { to: "/calendar", label: "Calendar",       icon: CalendarDays },
      { to: "/weekends", label: "Race weekends",  icon: Flag },
    ],
  },
  {
    label: "Trackside",
    items: [
      { to: "/pitwall",         label: "Pit wall",         icon: Radio },
      { to: "/racemode",        label: "Race mode",        icon: Flag },
      { to: "/sessions",        label: "Sessions",         icon: Timer },
      { to: "/timeline",        label: "Weekend timeline", icon: ClipboardList },
      { to: "/track-evolution", label: "Track evolution",  icon: CloudRain },
      { to: "/debrief",         label: "Driver debrief",   icon: ClipboardList },
      { to: "/flags",           label: "Flags & incidents", icon: AlertTriangle },
    ],
  },
  {
    label: "Setup",
    items: [
      { to: "/baseline",     label: "Baseline",            icon: Wand2 },
      { to: "/philosophies", label: "Setup philosophies",  icon: BookOpen },
      { to: "/corners",      label: "Corner analysis",     icon: MapPin },
      { to: "/confidence",   label: "Driver confidence",   icon: Gauge },
      { to: "/sympathy",     label: "Mechanical sympathy", icon: ShieldAlert },
      { to: "/notes",        label: "Engineering notes",   icon: NotebookPen },
    ],
  },
  {
    label: "Tyres",
    items: [
      { to: "/tyre-setup",   label: "Tyre pressures",  icon: Gauge },
      { to: "/tyre-wear",    label: "Tyre wear",       icon: TrendingDown },
      { to: "/tyre-compare", label: "Tyre compare",    icon: GitCompare },
      { to: "/tires",        label: "Tyre sets",       icon: Disc },
    ],
  },
  {
    label: "Workshop",
    items: [
      { to: "/workshop",    label: "Workshop hub", icon: HardHat },
      { to: "/maintenance", label: "Maintenance",  icon: Wrench },
      { to: "/damage",      label: "Damage log",   icon: AlertTriangle },
      { to: "/inventory",   label: "Inventory",    icon: Package },
      { to: "/expenses",    label: "Expenses",     icon: Receipt },
      { to: "/reports",     label: "Reports",      icon: FileText },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/analysis",    label: "Analysis",    icon: BarChart3 },
      { to: "/calculators", label: "Calculators", icon: Calculator },
    ],
  },
] as const;