import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useUnits } from "@/lib/units";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Sun, Moon, LogOut, BookOpen, Mail, Shield, FileText } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { deleteAccount } from "@/lib/account.functions";
import { DeleteAccountInput } from "@/lib/launch-rules";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [
    { title: "Settings | My Race Engineer" },
    { name: "description", content: "Settings: race-weekend tools and records for My Race Engineer." },
    { property: "og:title", content: "Settings | My Race Engineer" },
    { property: "og:description", content: "Settings: race-weekend tools and records for My Race Engineer." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { system, toggle, currency } = useUnits();
  const { theme, toggle: toggleTheme } = useTheme();
  const removeAccount = useServerFn(deleteAccount);
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

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
          <Row label="Currency" value={`${currency} — set automatically from your location`} />
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
      <section className="mt-8 border-t border-destructive/40 pt-6 space-y-3">
        <h2 className="font-display font-bold text-destructive">Delete account</h2>
        <p className="text-sm text-muted-foreground">Permanently remove your account, owned cars, sessions, setups, feedback and photos. Shared access to your cars will also end.</p>
        <Button variant="destructive" onClick={() => { setConfirmation(""); setDeleteOpen(true); }}>Delete account</Button>
      </section>
      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!deleting) setDeleteOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account permanently?</DialogTitle>
            <DialogDescription>This cannot be undone. All owned cars and their shared records will be deleted, including records contributed by team members. Tracks remain available to other racers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2"><Label htmlFor="delete-confirmation">Type DELETE to confirm</Label>
            <Input id="delete-confirmation" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" disabled={deleting} /></div>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleting || !DeleteAccountInput.safeParse({ confirmation }).success} onClick={async () => {
              setDeleting(true);
              try {
                await removeAccount({ data: { confirmation: "DELETE" } });
                await signOut();
                queryClient.clear();
                setDeleteOpen(false);
                toast.success("Your account has been deleted");
                await navigate({ to: "/auth", replace: true });
              } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to delete account"); }
              finally { setDeleting(false); }
            }}>{deleting ? "Deleting…" : "Permanently delete account"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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