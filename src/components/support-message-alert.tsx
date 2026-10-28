import { useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getInbox } from "@/lib/inbox.functions";
import { newSupportMessageIds } from "@/lib/support-notifications";

export function SupportMessageAlert({ userId }: { userId: string }) {
  const fetchAlerts = useServerFn(getInbox);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const previous = useRef<string[] | null>(null);
  const alerts = useQuery({
    queryKey: ["member-inbox", userId],
    queryFn: () => fetchAlerts(),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  useEffect(() => {
    if (!alerts.data) return;
    const ids = [
      ...alerts.data.direct.filter((m) => m.recipient_id === userId && !m.read_at).map((m) => m.id),
      ...alerts.data.support
        .filter(
          (m) =>
            m.unread &&
            (m.user_id === userId ||
              m.assigned_to === userId ||
              (alerts.data.isAdmin && !m.assigned_to)),
        )
        .map((m) => `${m.id}:${m.replies.at(-1)?.id ?? "new"}:${m.assigned_to ?? "queue"}`),
    ];
    const added = newSupportMessageIds(previous.current, ids);
    previous.current = ids;
    if (added.length === 0) return;
    queryClient.invalidateQueries({ queryKey: ["support-inbox"] });
    toast.info(added.length === 1 ? "New inbox message" : `${added.length} new inbox messages`, {
      id: "new-support-message",
      duration: 8000,
      action: { label: "Open inbox", onClick: () => navigate({ to: "/inbox" }) },
    });
  }, [alerts.data, navigate, queryClient, userId]);

  if (!alerts.data) return null;
  const count =
    alerts.data.direct.filter((m) => m.recipient_id === userId && !m.read_at).length +
    alerts.data.support.filter(
      (m) =>
        m.unread &&
        (m.user_id === userId ||
          m.assigned_to === userId ||
          (alerts.data.isAdmin && !m.assigned_to)),
    ).length;
  const label =
    count > 0 ? `Team inbox: ${count} unread messages` : "Team inbox: no unread messages";
  return (
    <Button asChild variant="ghost" size="icon" className="relative h-9 w-9 shrink-0" title={label}>
      <Link to="/inbox" aria-label={label}>
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    </Button>
  );
}
