import { useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSupportMessageAlerts } from "@/lib/support.functions";
import { newSupportMessageIds } from "@/lib/support-notifications";

export function SupportMessageAlert({ userId }: { userId: string }) {
  const fetchAlerts = useServerFn(getSupportMessageAlerts);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const previous = useRef<string[] | null>(null);
  const alerts = useQuery({
    queryKey: ["support-alerts", userId],
    queryFn: () => fetchAlerts(),
    refetchInterval: (query) => query.state.data === null ? false : 10_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  useEffect(() => {
    if (!alerts.data) return;
    const added = newSupportMessageIds(previous.current, alerts.data.ids);
    previous.current = alerts.data.ids;
    if (added.length === 0) return;
    queryClient.invalidateQueries({ queryKey: ["support-inbox"] });
    toast.info(added.length === 1 ? "New support message" : `${added.length} new support messages`, {
      id: "new-support-message",
      duration: 8000,
      action: { label: "Open inbox", onClick: () => navigate({ to: "/support-inbox" }) },
    });
  }, [alerts.data, navigate, queryClient]);

  if (!alerts.data) return null;
  const count = alerts.data.openCount;
  const label = count > 0 ? `Support Inbox: ${count} open messages` : "Support Inbox: no open messages";
  return (
    <Button asChild variant="ghost" size="icon" className="relative h-9 w-9 shrink-0" title={label}>
      <Link to="/support-inbox" aria-label={label}>
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    </Button>
  );
}