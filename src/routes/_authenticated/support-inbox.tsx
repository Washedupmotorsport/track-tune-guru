import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Inbox, Mail, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listSupportMessages, setSupportMessageStatus } from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/support-inbox")({
  head: () => ({
    meta: [
      { title: "Support Inbox | My Race Engineer" },
      { name: "description", content: "Read and answer support messages sent from inside My Race Engineer." },
      { property: "og:title", content: "Support Inbox | My Race Engineer" },
      { property: "og:description", content: "Read and answer support messages sent from inside My Race Engineer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportInboxPage,
});

type SupportMessage = {
  id: string;
  created_at: string;
  email: string;
  name: string | null;
  category: string;
  message: string;
  status: string;
  resolved_at: string | null;
  source: string;
  user_id: string | null;
};

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function SupportInboxPage() {
  const [filter, setFilter] = useState<FilterKey>("open");
  const fetchMessages = useServerFn(listSupportMessages);
  const setStatus = useServerFn(setSupportMessageStatus);
  const queryClient = useQueryClient();

  const messagesQ = useQuery({
    queryKey: ["support-inbox"],
    queryFn: () => fetchMessages(),
  });

  const statusM = useMutation({
    mutationFn: (input: { id: string; status: "open" | "resolved" }) => setStatus({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-inbox"] });
      toast.success("Message updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = (messagesQ.data ?? []).filter((m) => {
    if (filter === "all") return true;
    return m.status === filter;
  });

  const openCount = (messagesQ.data ?? []).filter((m) => m.status === "open").length;

  return (
    <div className="px-4 py-6 max-w-[1400px] mx-auto">
      <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
        <Inbox className="w-3 h-3" /> Support inbox
      </div>
      <h1 className="font-display text-2xl md:text-3xl font-bold mt-1">
        Messages from the app
      </h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Every message sent through the support form lands here and is copied to{" "}
        <span className="font-mono">support@myraceengineer.app</span>.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button asChild variant="outline"><Link to="/inbox">Team inbox · replies & assignments</Link></Button>
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.key === "open" && openCount > 0 ? (
              <span className="ml-1 font-mono text-xs">({openCount})</span>
            ) : null}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["support-inbox"] })}
        >
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      {messagesQ.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-md" />
          ))}
        </div>
      ) : messagesQ.isError ? (
        <Card>
          <CardContent className="p-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-display font-bold">This inbox is for the app team</div>
              <p className="text-sm text-muted-foreground mt-1">
                {(messagesQ.error as Error)?.message ??
                  "We could not load the support inbox. Please try again."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Inbox className="w-8 h-8 mx-auto text-muted-foreground" />
            <div className="font-display font-bold mt-3">
              {filter === "open" ? "Nothing waiting" : "Nothing here yet"}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === "open"
                ? "Every message has an answer. New ones show up here as they arrive."
                : "Messages appear here as soon as someone uses the support form."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((m: SupportMessage) => (
            <Card key={m.id} className={m.status === "open" ? "border-primary/40" : ""}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-bold truncate">{m.name || m.email}</span>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">
                    {m.category}
                  </Badge>
                  {m.status === "resolved" ? (
                    <Badge variant="outline" className="font-mono text-[10px] uppercase text-accent">
                      resolved
                    </Badge>
                  ) : null}
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground shrink-0">
                    {when(m.created_at)}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground mt-0.5 break-words">
                  {m.email} · via {m.source === "in_app" ? "app" : "website"}
                </div>
                <p className="text-sm mt-3 whitespace-pre-wrap break-words">{m.message}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button size="sm" variant="outline" asChild>
                    <a href={`mailto:${m.email}?subject=Re: My Race Engineer support`}>
                      <Mail className="w-3 h-3 mr-1" /> Reply by email
                    </a>
                  </Button>
                  {m.status === "open" ? (
                    <Button
                      size="sm"
                      onClick={() => statusM.mutate({ id: m.id, status: "resolved" })}
                      disabled={statusM.isPending}
                    >
                      <Check className="w-3 h-3 mr-1" /> Mark resolved
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => statusM.mutate({ id: m.id, status: "open" })}
                      disabled={statusM.isPending}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
