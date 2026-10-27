import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResetPasswordInput } from "@/lib/launch-rules";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Reset password | My Race Engineer" },
    { name: "description", content: "Securely reset your My Race Engineer account password." },
    { property: "og:title", content: "Reset password | My Race Engineer" },
    { property: "og:description", content: "Securely reset your My Race Engineer account password." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { passwordRecovery } = useAuth();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const recoveryLink = hash.get("type") === "recovery";
    let alive = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setReady(true);
        setChecking(false);
      }
    });
    // The root auth listener may process the link before this page mounts.
    void supabase.auth.getUser().then(({ data: auth, error }) => {
      if (!alive) return;
      if (recoveryLink && auth.user && !error) setReady(true);
      setChecking(false);
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5">
        <Link to="/" className="font-display text-primary font-bold">My Race Engineer</Link>
        <h1 className="text-3xl font-display font-bold">Reset password</h1>
        {checking && !passwordRecovery ? <p role="status">Checking reset link…</p> : !ready && !passwordRecovery ? (
          <div className="space-y-4">
            <p className="text-muted-foreground">This reset link is invalid or expired. Request a new link to continue.</p>
            <Button asChild><Link to="/auth">Request a new reset link</Link></Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={async (event) => {
            event.preventDefault();
            const input = ResetPasswordInput.safeParse({ password, confirm });
            if (!input.success) { toast.error(input.error.issues[0]?.message ?? "Check your password"); return; }
            setBusy(true);
            try {
              const { error } = await supabase.auth.updateUser({ password: input.data.password });
              if (error) throw error;
              toast.success("Password updated successfully");
              await navigate({ to: "/weekends", replace: true });
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Unable to update password");
            } finally { setBusy(false); }
          }}>
            <div className="space-y-2"><Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="confirm-password">Confirm password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" required maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
            <Button className="w-full" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</Button>
          </form>
        )}
      </div>
    </main>
  );
}