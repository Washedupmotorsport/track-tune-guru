import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { WavingFlags } from "@/components/waving-flags";
import { ActiveWeekendProvider } from "@/lib/active-weekend";
import { ReminderProvider } from "@/lib/reminders";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    if (!loading && user && !user.email_confirmed_at && !user.confirmed_at) {
      navigate({ to: "/auth", search: { pending: 1 } as never });
    }
  }, [loading, user, navigate]);

  const pendingConfirm = !!user && !user.email_confirmed_at && !user.confirmed_at;
  if (loading || !user || pendingConfirm) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <WavingFlags className="w-16 h-16" />
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground animate-pulse">
          Entering the paddock
        </span>
      </div>
    );
  }
  return (
    <ActiveWeekendProvider>
      <ReminderProvider>
        <AppShell><Outlet /></AppShell>
      </ReminderProvider>
    </ActiveWeekendProvider>
  );
}