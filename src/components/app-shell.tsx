import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut, Calculator, Wand as Wand2, NotebookPen, Timer, Disc, Wrench, Package, CalendarDays, Receipt, ChartBar as BarChart3, Menu, Search, Sun, Moon, Flag, TriangleAlert as AlertTriangle, HardHat, Radio, ClipboardList, FileText, MapPin, CloudRain, GitBranch, Brain, Mic, BookMarked, Sparkles } from "lucide-react";
import React, { type ReactNode } from "react";

const GARAGE_ICON_URL = "https://uxwing.com/wp-content/themes/uxwing/download/buildings-architecture-real-estate/garage-door-icon.png";

function Home({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-hidden="true"
      className={`inline-block bg-current ${className ?? ""}`}
      style={{
        WebkitMaskImage: `url(${GARAGE_ICON_URL})`,
        maskImage: `url(${GARAGE_ICON_URL})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
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
import { QuickLogFab } from "@/components/quick-log-fab";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { system, toggle, currency, setCurrency } = useUnits();
  const { theme, toggle: toggleTheme } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen pb-[90px] text-foreground">
      <div className="h-[2px] w-full bg-primary" aria-hidden />
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="mx-auto max-w-[1400px] px-4 h-11 md:h-12 flex items-center justify-between">
          <Link to="/" aria-label="My Race Engineer — home" className="flex items-center">
            <img src={logoMre} alt="My Race Engineer" className="h-7 w-auto" />
          </Link>
          <nav aria-label="Role" className="hidden md:flex items-center gap-1 ml-2">
            <Link
              to="/driver"
              className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-md text-xs font-medium border transition-colors ${
                pathname.startsWith("/driver")
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "text-muted-foreground border-border hover:text-primary hover:border-primary/40"
              }`}
              title="Driver workspace"
            >
              <Mic className="w-3 h-3" /> Driver
            </Link>
            <Link
              to="/engineer"
              className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-md text-xs font-medium border transition-colors ${
                pathname.startsWith("/engineer")
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "text-muted-foreground border-border hover:text-primary hover:border-primary/40"
              }`}
              title="Engineer workspace"
            >
              <HardHat className="w-3 h-3" /> Engineer
            </Link>
          </nav>
          {/* Workspace tabs (desktop) — 5 race-team workspaces */}
          <nav aria-label="Workspaces" className="hidden lg:flex items-center gap-1 mx-3">
            {WORKSPACES.map((w) => {
              const Icon = w.icon;
              const active = w.matches.some((m) => pathname === m || pathname.startsWith(m + "/"));
              return (
                <Link
                  key={w.key}
                  to={w.to}
                  title={"tooltip" in w ? (w as { tooltip: string }).tooltip : undefined}
                  className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium transition-colors ${
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
              className="hidden md:inline-flex items-center gap-2 rounded-md border border-border bg-muted/30 min-h-11 px-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/40"
              aria-label="Search"
            >
              <Search className="w-3 h-3" /> <span className="opacity-70">⌘K</span>
            </button>
            <button
              onClick={toggle}
              title="Toggle metric / imperial"
              aria-label="Toggle units"
              className="hidden md:inline-flex items-center rounded-md border border-border bg-muted/30 min-h-11 px-2 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40"
            >
              <span className={system === "metric" ? "text-primary" : ""}>SI</span>
              <span className="mx-1 opacity-40">/</span>
              <span className={system === "imperial" ? "text-primary" : ""}>US</span>
            </button>
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              aria-label="Toggle theme"
              className="hidden md:inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-muted/30 min-h-11 px-2 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
            <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
              <SelectTrigger
                aria-label="Currency"
                className="hidden md:flex min-h-11 w-[78px] rounded-md border border-border bg-muted/30 px-2 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40"
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
                <Button size="sm" variant="ghost" title="All navigation pages" className="text-xs font-medium text-muted-foreground hover:text-primary">
                  <Menu className="w-4 h-4 mr-1" /> All
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {/* Mobile-only settings (hidden from desktop header) */}
                <div className="md:hidden">
                  <DropdownMenuLabel className="font-medium text-xs text-primary">Settings</DropdownMenuLabel>
                  <DropdownMenuItem onClick={toggle}>
                    <span className="text-xs">Units: <span className="font-semibold">{system === "metric" ? "SI (metric)" : "US (imperial)"}</span></span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={toggleTheme}>
                    {theme === "dark" ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                    {theme === "dark" ? "Light mode" : "Dark mode"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const codes = CURRENCIES.map(c => c.code);
                    const idx = codes.indexOf(currency);
                    setCurrency(codes[(idx + 1) % codes.length] as CurrencyCode);
                  }}>
                    <span className="text-xs">Currency: <span className="font-semibold">{currency}</span></span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </div>
                {ALL_NAV_GROUPS.map((g) => (
                  <div key={g.label}>
                    <DropdownMenuLabel className="font-medium text-xs text-primary">{g.label}</DropdownMenuLabel>
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
            <span className="hidden xl:block text-xs font-medium text-muted-foreground">
              {user?.email}
            </span>
            <Button size="sm" variant="ghost" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-4">{children}</main>
      <footer className="hidden md:fixed md:bottom-0 md:inset-x-0 md:flex z-20 border-t border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1400px] w-full px-4 h-[90px] flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-6">
            <Link to="/" aria-label="My Race Engineer — home" className="flex items-center">
              <img src={logoMre} alt="My Race Engineer" className="h-4 w-auto opacity-70 hover:opacity-100 transition-opacity" />
            </Link>
            <span>© {new Date().getFullYear()} My Race Engineer</span>
          </div>
          <div className="flex items-center gap-4">
            <FooterLink to="/engineer">Cockpit</FooterLink>
            <FooterLink to="/sessions">Sessions</FooterLink>
            <FooterLink to="/tyre-setup">Tyres</FooterLink>
            <FooterLink to="/setup-library">Setup</FooterLink>
            <FooterLink to="/garage">Garage</FooterLink>
            <FooterLink to="/calculators">Calculators</FooterLink>
          </div>
          <div className="flex items-center gap-4">
            <FooterLink to="/terms">Terms of Service</FooterLink>
            <a
              href="https://www.facebook.com/people/My-Motorsport-engineer/61590792381151/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
            <a
              href="https://www.instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
      <CommandPalette />
      <QuickLogFab />
      <MobileTabBar />
      <div className="md:hidden h-14" aria-hidden />
    </div>
  );
}

function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/engineer",      label: "Cockpit",  icon: HardHat,       matches: ["/engineer"] },
    { to: "/pitwall",       label: "Race",     icon: Radio,         matches: ["/pitwall", "/racemode", "/pitlane", "/track-evolution"] },
    { to: "/sessions",      label: "Sessions", icon: Timer,         matches: ["/sessions", "/timeline", "/analysis", "/post-debrief"] },
    { to: "/tyre-setup",    label: "Tyres",    icon: Disc,          matches: ["/tyre-setup", "/tyre-wear", "/tyre-compare", "/tires"] },
    { to: "/driver",        label: "Driver",   icon: Mic,           matches: ["/driver", "/confidence", "/sympathy", "/philosophies", "/flags", "/corners", "/known-behaviours", "/debrief"] },
    { to: "/setup-library", label: "Setup",    icon: Wand2,         matches: ["/setup-library", "/setups", "/baseline", "/iteration"] },
    { to: "/engineering-memory", label: "Log", icon: Brain,         matches: ["/engineering-memory", "/notes"], tooltip: "Engineering notebook log" },
    { to: "/garage",        label: "Garage",   icon: Home,          matches: ["/garage", "/cars", "/calendar", "/weekends", "/workshop", "/maintenance", "/damage", "/inventory", "/expenses", "/reports"] },
  ] as const;
  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="h-[2px] w-full bg-primary/70" aria-hidden />
      <ul className="grid grid-cols-8">
        {items.map((it) => {
          const Icon = it.icon;
          const active = it.matches.some((m) => pathname === m || pathname.startsWith(m + "/"));
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                title={"tooltip" in it ? (it as { tooltip: string }).tooltip : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 h-12 text-[11px] font-medium active:bg-primary/10 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-primary"
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
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
  // 8-stop primary nav. Debrief lives under Sessions (per-session workflow);
  // Operations lives under Garage. Nothing merged that isn't a real duplicate.
  { key: "cockpit",  label: "Cockpit",   icon: HardHat,       to: "/engineer",       matches: ["/engineer"] },
  { key: "race",     label: "Race Mode", icon: Radio,         to: "/pitwall",        matches: ["/pitwall", "/racemode", "/pitlane", "/track-evolution"] },
  { key: "setup",    label: "Setup",     icon: Wand2,         to: "/setup-library",  matches: ["/setup-library", "/setups", "/baseline", "/iteration"] },
  { key: "sessions", label: "Sessions",  icon: Timer,         to: "/sessions",       matches: ["/sessions", "/timeline", "/analysis", "/post-debrief"] },
  { key: "tyres",    label: "Tyres",     icon: Disc,          to: "/tyre-setup",     matches: ["/tyre-setup", "/tyre-wear", "/tyre-compare", "/tires"] },
  { key: "driver",   label: "Driver",    icon: Mic,           to: "/driver",         matches: ["/driver", "/confidence", "/sympathy", "/philosophies", "/flags", "/corners", "/known-behaviours", "/debrief"] },
  { key: "log",      label: "Log",       icon: Brain,         to: "/engineering-memory", matches: ["/engineering-memory", "/notes"], tooltip: "Engineering notebook log" },
  { key: "garage",   label: "Garage",    icon: Home,          to: "/garage",         matches: ["/garage", "/cars", "/calendar", "/weekends", "/workshop", "/maintenance", "/damage", "/inventory", "/expenses", "/reports"] },
] as const;

const ALL_NAV_GROUPS = [
  {
    label: "Pit wall",
    items: [
      { to: "/engineer", label: "Engineer cockpit", icon: HardHat },
      { to: "/pitwall",  label: "Race mode — live", icon: Radio },
      { to: "/driver",   label: "Driver hub",       icon: Mic },
    ],
  },
  {
    label: "Race Mode — trackside",
    items: [
      { to: "/pitwall",         label: "Live board",       icon: Radio },
      { to: "/track-evolution", label: "Track evolution",  icon: CloudRain },
      { to: "/racemode",        label: "Race mode (legacy)", icon: Radio },
      { to: "/pitlane",         label: "Pit lane (legacy)",  icon: Radio },
    ],
  },
  {
    label: "Sessions",
    items: [
      { to: "/sessions",        label: "Sessions",         icon: Timer },
      { to: "/timeline",        label: "Weekend timeline", icon: ClipboardList },
      { to: "/analysis",        label: "Stint analysis",   icon: BarChart3 },
      { to: "/post-debrief",    label: "Session debrief",  icon: ClipboardList },
    ],
  },
  {
    label: "Tyres",
    items: [
      { to: "/tyre-setup",   label: "Pressures",  icon: Disc },
      { to: "/tyre-wear",    label: "Wear",       icon: Disc },
      { to: "/tyre-compare", label: "Compare",    icon: Disc },
      { to: "/tires",        label: "Sets",       icon: Disc },
    ],
  },
  {
    label: "Driver Hub",
    items: [
      { to: "/driver",           label: "Driver workspace",  icon: Mic },
      { to: "/confidence",       label: "Driver Confidence",   icon: Brain },
      { to: "/debrief",          label: "Driver feedback",   icon: ClipboardList },
      { to: "/known-behaviours", label: "Known behaviours",  icon: Sparkles },
      { to: "/sympathy",         label: "Reliability", icon: Wrench },
      { to: "/philosophies",     label: "Setup Notes", icon: NotebookPen },
      { to: "/flags",            label: "Track flags",       icon: Flag },
      { to: "/corners",          label: "Corner notes",      icon: MapPin },
    ],
  },
  {
    label: "Setup",
    items: [
      { to: "/setup-library", label: "Setup library",       icon: BookMarked },
      { to: "/baseline",      label: "Baseline generator",  icon: Wand2 },
      { to: "/iteration",     label: "Setup iteration",     icon: GitBranch },
    ],
  },
  {
    label: "Engineering Log",
    items: [
      { to: "/engineering-memory", label: "Engineering memory", icon: Brain },
      { to: "/notes",              label: "Engineer notes",     icon: NotebookPen },
    ],
  },
  {
    label: "Garage",
    items: [
      { to: "/garage",   label: "Garage",        icon: Home },
      { to: "/calendar", label: "Calendar",      icon: CalendarDays },
      { to: "/weekends", label: "Race weekends", icon: Flag },
    ],
  },
  {
    label: "Operations (under Garage)",
    items: [
      { to: "/workshop",    label: "Workshop",     icon: HardHat },
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
      { to: "/calculators", label: "Calculators", icon: Calculator },
    ],
  },
] as const;

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-muted-foreground hover:text-primary transition-colors">
      {children}
    </Link>
  );
}