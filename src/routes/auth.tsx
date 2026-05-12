import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/garage" });
  }, [loading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome to the paddock");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-10 bg-card border-r border-border">
        <Link to="/" className="font-display font-bold text-lg flex items-center gap-2">
          <span className="inline-block w-2 h-6 bg-primary shadow-glow" />SUMMIT<span className="text-primary">RACING</span>
        </Link>
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight">Your pit garage,<br /><span className="text-primary">always with you</span>.</h2>
          <p className="mt-4 text-muted-foreground max-w-sm">Save setups for every car you race. Recall the winning sheet on a wet Sunday at midnight.</p>
        </div>
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Sector 1 // Login</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-bold">{mode === "signin" ? "Sign in" : "Create account"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin" ? "Welcome back, driver." : "Start logging your setups in minutes."}
          </p>

          <Button type="button" variant="outline" className="w-full mt-6" onClick={handleGoogle} disabled={busy}>
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 11v3.4h5.4a4.7 4.7 0 0 1-2 3l3.3 2.5c1.9-1.8 3-4.4 3-7.5 0-.7-.1-1.4-.2-2H12z"/><path fill="#34A853" d="M5.5 14.3l-1 .8L1.7 17a11 11 0 0 0 9.8 6c2.7 0 5-1 6.6-2.4l-3.3-2.5c-.9.6-2 1-3.3 1a5.5 5.5 0 0 1-5.2-3.7z"/><path fill="#FBBC05" d="M1.7 7A11 11 0 0 0 1 12c0 1.8.4 3.5 1.2 5l3.7-2.8a5.5 5.5 0 0 1 0-3.4z"/><path fill="#4285F4" d="M12 5.5c1.5 0 2.8.5 3.8 1.4L18.7 4A10.7 10.7 0 0 0 11.5 1 11 11 0 0 0 1.7 7l3.7 2.8A5.5 5.5 0 0 1 12 5.5z"/></svg>
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Driver name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="A. Senna" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 text-sm text-muted-foreground hover:text-primary transition-colors">
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}