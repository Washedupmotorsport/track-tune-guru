import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut, Calculator, Wand as Wand2, NotebookPen, Timer, Disc, Wrench, Package, CalendarDays, Receipt, ChartBar as BarChart3, Menu, Search, Sun, Moon, Flag, TriangleAlert as AlertTriangle, HardHat, Radio, ClipboardList, FileText, MapPin, CloudRain, GitBranch, Brain, BookMarked, Sparkles, BookOpen } from "lucide-react";
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
import { HelpButton } from "@/components/help-button";
import { TracksideContext } from "@/components/trackside-context";

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
        <div className="mx-auto max-w-[1400px] px-3 md:px-4 h-12 md:h-14 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <Link to="/" aria-label="My Race Engineer — home" className="flex items-center shrink-0">
            <img src={logoMre} alt="My Race Engineer" className="h-7 md:h-8 w-auto" />
          </Link>

          {/* Trackside context strip — desktop */}
          <div className="min-w-0 flex justify-center">
            <TracksideContext />
          </div>

          <div className="flex items-center gap-1.5 justify-end shrink-0">
            <ConnectionStatus />
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="hidden md:inline-flex items-center gap-2 rounded-md border border-border bg-muted/30 h-8 px-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/40"
              aria-label="Search"
            >
              <Search className="w-3 h-3" /> <span className="opacity-70">⌘K</span>
            </button>
            <button
              onClick={toggle}
              title="Toggle metric / imperial"
              aria-label="Toggle units"
              className="hidden lg:inline-flex items-center rounded-md border border-border bg-muted/30 h-8 px-2 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40"
            >
              <span className={system === "metric" ? "text-primary" : ""}>SI</span>
              <span className="mx-1 opacity-40">/</span>
              <span className={system === "imperial" ? "text-primary" : ""}>US</span>
            </button>
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              aria-label="Toggle theme"
              className="hidden lg:inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-muted/30 h-8 px-2 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="hidden xl:inline">{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
            <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
              <SelectTrigger
                aria-label="Currency"
                className="hidden lg:flex h-8 w-[72px] rounded-md border border-border bg-muted/30 px-2 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40"
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
            <HelpButton />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" title="All navigation pages" className="text-xs font-medium text-muted-foreground hover:text-primary h-8 px-2">
                  <Menu className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline">All</span>
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
              {user?.email?.slice(0, 4)}
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
            <FooterLink to="/weekends">Weekend</FooterLink>
            <FooterLink to="/sessions">Sessions</FooterLink>
            <FooterLink to="/tyre-setup">Tyres</FooterLink>
            <FooterLink to="/setup-library">Setup</FooterLink>
            <FooterLink to="/pitwall">Pitwall</FooterLink>
            <FooterLink to="/debrief">Debrief</FooterLink>
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
    { to: "/weekends",      label: "Weekend",  icon: Flag,  matches: ["/weekends", "/calendar", "/garage", "/cars", "/tracks"] },
    { to: "/sessions",      label: "Sessions", icon: Timer, matches: ["/sessions", "/timeline", "/analysis", "/debrief", "/post-debrief"] },
    { to: "/tyre-setup",    label: "Tyres",    icon: Disc,  matches: ["/tyre-setup", "/tyre-wear", "/tyre-compare", "/tires"] },
    { to: "/setup-library", label: "Setup",    icon: Wand2, matches: ["/setup-library", "/setups", "/baseline", "/iteration"] },
    { to: "/pitwall",       label: "Pitwall",  icon: Radio, matches: ["/pitwall", "/racemode", "/pitlane", "/track-evolution", "/engineer"] },
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
                title={"tooltip" in it ? (it as { tooltip: string }).tooltip : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] font-medium active:bg-primary/10 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-primary"
                }`}
              >
                {active && <span aria-hidden className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 bg-primary rounded-b" />}
                <Icon className="w-[20px] h-[20px]" />
                <span className="font-mono uppercase tracking-[0.1em] text-[10px]">{it.label}</span>
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
  // 6-stop primary nav — race weekend workflow.
  { key: "weekend",  label: "Weekend",  icon: Flag,          to: "/weekends",       matches: ["/weekends", "/calendar", "/garage", "/cars"], tooltip: "Plan the race weekend" },
  { key: "sessions", label: "Sessions", icon: Timer,         to: "/sessions",       matches: ["/sessions", "/timeline", "/analysis"] },
  { key: "tyres",    label: "Tyres",    icon: Disc,          to: "/tyre-setup",     matches: ["/tyre-setup", "/tyre-wear", "/tyre-compare", "/tires"] },
  { key: "setup",    label: "Setup",    icon: Wand2,         to: "/setup-library",  matches: ["/setup-library", "/setups", "/baseline", "/iteration"] },
  { key: "pitwall",  label: "Pitwall",  icon: Radio,         to: "/pitwall",        matches: ["/pitwall", "/racemode", "/pitlane", "/track-evolution", "/engineer"], tooltip: "Trackside live ops" },
  { key: "debrief",  label: "Debrief",  icon: ClipboardList, to: "/debrief",        matches: ["/debrief", "/post-debrief", "/engineering-memory", "/notes", "/driver", "/confidence", "/sympathy", "/philosophies", "/flags", "/corners", "/known-behaviours"], tooltip: "Driver feedback & notes" },
] as const;

const ALL_NAV_GROUPS = [
  {
    label: "Weekend",
    items: [
      { to: "/weekends", label: "Race weekends", icon: Flag },
      { to: "/calendar", label: "Calendar",      icon: CalendarDays },
      { to: "/garage",   label: "Garage & cars", icon: Home },
      { to: "/tracks",   label: "Track database", icon: MapPin },
    ],
  },
  {
    label: "Sessions",
    items: [
      { to: "/sessions",        label: "Sessions",         icon: Timer },
      { to: "/timeline",        label: "Weekend timeline", icon: ClipboardList },
      { to: "/analysis",        label: "Stint analysis",   icon: BarChart3 },
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
    label: "Setup",
    items: [
      { to: "/setup-library", label: "Setup library",       icon: BookMarked },
      { to: "/baseline",      label: "Baseline generator",  icon: Wand2 },
      { to: "/iteration",     label: "Setup iteration",     icon: GitBranch },
    ],
  },
  {
    label: "Pitwall",
    items: [
      { to: "/pitwall",         label: "Live board",       icon: Radio },
      { to: "/track-evolution", label: "Track evolution",  icon: CloudRain },
      { to: "/engineer",        label: "Engineer cockpit", icon: HardHat },
    ],
  },
  {
    label: "Debrief",
    items: [
      { to: "/debrief",            label: "Driver feedback",    icon: ClipboardList },
      { to: "/post-debrief",       label: "Session debrief",    icon: ClipboardList },
      { to: "/engineering-memory", label: "Engineering memory", icon: Brain },
      { to: "/notes",              label: "Engineer notes",     icon: NotebookPen },
      { to: "/confidence",         label: "Driver confidence",  icon: Brain },
      { to: "/known-behaviours",   label: "Known behaviours",   icon: Sparkles },
      { to: "/philosophies",       label: "Setup notes",        icon: NotebookPen },
      { to: "/flags",              label: "Track flags",        icon: Flag },
      { to: "/corners",            label: "Corner notes",       icon: MapPin },
    ],
  },
  {
    label: "More",
    items: [
      { to: "/calculators", label: "Calculators", icon: Calculator },
      { to: "/damage",      label: "Damage log",  icon: AlertTriangle },
      { to: "/sympathy",    label: "Reliability", icon: Wrench },
      { to: "/workshop",    label: "Workshop",    icon: HardHat },
      { to: "/maintenance", label: "Maintenance", icon: Wrench },
      { to: "/inventory",   label: "Inventory",   icon: Package },
      { to: "/expenses",    label: "Expenses",    icon: Receipt },
      { to: "/reports",     label: "Reports",     icon: FileText },
    ],
  },
  {
    label: "Help",
    items: [
      { to: "/manual", label: "User manual", icon: BookOpen },
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