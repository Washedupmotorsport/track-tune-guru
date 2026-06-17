import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useUnits, CURRENCIES, type CurrencyCode } from "@/lib/units";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Sun, Moon, LogOut, BookOpen, Mail, Shield, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — My Race Engineer" },
      { name: "description", content: "Units, theme, currency and account preferences." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { system, toggle, currency, setCurrency } = useUnits();
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <div>
      <div className="font-mono text-xs uppercase tracking-widest text-primary inline-flex items-center gap-1">
        <SettingsIcon className="w-3 h-3" /> Settings
      </div>
      <h1 className="font-display text-4xl font-bold mt-1">Settings</h1>
      <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
        App preferences, account and helpful links. All your data stays on your account — these are presentation choices.
      </p>

      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <Card title="Units">
          <Row label="Measurement system" value={system === "metric" ? "SI (metric)" : "US (imperial)"}>
            <Button size="sm" variant="outline" onClick={toggle}>Switch to {system === "metric" ? "US" : "SI"}</Button>
          </Row>
          <Row label="Currency" value={currency}>
            <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
              <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="font-mono text-xs">
                    {c.code} <span className="text-muted-foreground ml-2">{c.symbol}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
        </Card>

        <Card title="Appearance">
          <Row label="Theme" value={theme === "dark" ? "Dark" : "Light"}>
            <Button size="sm" variant="outline" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="w-4 h-4 mr-1.5" /> : <Moon className="w-4 h-4 mr-1.5" />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </Button>
          </Row>
        </Card>

        <Card title="Account">
          <Row label="Signed in as" value={user?.email ?? "—"}>
            <Button size="sm" variant="outline" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
              <LogOut className="w-4 h-4 mr-1.5" /> Sign out
            </Button>
          </Row>
        </Card>

        <Card title="Help & legal">
          <ul className="text-sm divide-y divide-border">
            <LinkRow to="/manual"  icon={<BookOpen className="w-4 h-4" />} label="User manual" />
            <LinkRow to="/support" icon={<Mail     className="w-4 h-4" />} label="Support" />
            <LinkRow to="/privacy" icon={<Shield   className="w-4 h-4" />} label="Privacy policy" />
            <LinkRow to="/terms"   icon={<FileText className="w-4 h-4" />} label="Terms of service" />
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-card">
      <h2 className="font-display text-sm font-bold uppercase tracking-wider text-primary mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function LinkRow({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center justify-between py-2 hover:text-primary">
        <span className="inline-flex items-center gap-2"><span className="text-muted-foreground">{icon}</span>{label}</span>
        <span className="text-muted-foreground text-xs">›</span>
      </Link>
    </li>
  );
}