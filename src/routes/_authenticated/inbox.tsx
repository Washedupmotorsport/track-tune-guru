import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, CheckCheck, Inbox, MessageSquare, Plus, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import {
  assignSupportMessage,
  getInbox,
  markInboxRead,
  replyToSupport,
  sendTeamMessage,
} from "@/lib/inbox.functions";
import { submitSupportMessageSignedIn, setSupportMessageStatus } from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Team Inbox | My Race Engineer" },
      {
        name: "description",
        content: "Your private crew messages, support conversations and assigned requests.",
      },
      { property: "og:title", content: "Team Inbox | My Race Engineer" },
      {
        property: "og:description",
        content: "Your private crew messages, support conversations and assigned requests.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamInboxPage,
});

type Tab = "team" | "support" | "assigned" | "queue";
const when = (at: string) =>
  new Date(at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });

function TeamInboxPage() {
  const { user } = useAuth();
  const fetchInbox = useServerFn(getInbox);
  const send = useServerFn(sendTeamMessage);
  const reply = useServerFn(replyToSupport);
  const assign = useServerFn(assignSupportMessage);
  const markRead = useServerFn(markInboxRead);
  const submitSupport = useServerFn(submitSupportMessageSignedIn);
  const status = useServerFn(setSupportMessageStatus);
  const cache = useQueryClient();
  const [tab, setTab] = useState<Tab>("team");
  const [selected, setSelected] = useState<string | null>(null);
  const [compose, setCompose] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [body, setBody] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const inbox = useQuery({
    queryKey: ["member-inbox", user?.id],
    queryFn: () => fetchInbox(),
    refetchInterval: 10_000,
  });
  const refresh = () => {
    cache.invalidateQueries({ queryKey: ["member-inbox"] });
    cache.invalidateQueries({ queryKey: ["support-inbox"] });
    cache.invalidateQueries({ queryKey: ["support-alerts"] });
  };
  const action = useMutation({
    mutationFn: async (task: () => Promise<unknown>) => task(),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (tab === "team")
        return send({ data: { recipientId: compose ? recipient : (selected ?? ""), body } });
      if (compose)
        return submitSupport({ data: { message: body, category: "other", source: "in_app" } });
      return reply({ data: { supportId: selected ?? "", body } });
    },
    onSuccess: (result) => {
      setBody("");
      setCompose(false);
      refresh();
      if ("emailDelivery" in result && result.emailDelivery === "failed") {
        toast.warning("Reply saved, but the email could not be sent. Contact the sender at their email address.");
      } else if ("emailDelivery" in result && result.emailDelivery === "suppressed") {
        toast.warning("Reply saved, but email delivery is blocked for this sender. They were not emailed.");
      } else {
        toast.success("emailDelivery" in result && result.emailDelivery === "sent" ? "Reply saved and emailed to sender" : "Message sent");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const data = inbox.data;
  const name = (id: string) =>
    id === data?.userId
      ? "You"
      : (data?.crew.find((p) => p.id === id)?.display_name ??
        data?.staff.find((p) => p.id === id)?.display_name ??
        "Crew member");
  const peers = [
    ...new Set(
      (data?.direct ?? []).map((m) =>
        m.sender_id === data?.userId ? m.recipient_id : m.sender_id,
      ),
    ),
  ];
  const teamRows = peers.map((id) => {
    const messages = (data?.direct ?? []).filter(
      (m) => m.sender_id === id || m.recipient_id === id,
    );
    return {
      id,
      label: name(id),
      preview: messages[0]?.body ?? "",
      at: messages[0]?.created_at ?? "",
      unread: messages.some((m) => m.recipient_id === data?.userId && !m.read_at),
    };
  });
  const supportRows = (data?.support ?? []).filter((m) =>
    tab === "support"
      ? m.user_id === data?.userId
      : tab === "assigned"
        ? m.assigned_to === data?.userId
        : true,
  );
  const rows = (
    tab === "team"
      ? teamRows
      : supportRows.map((m) => ({
          id: m.id,
          label: tab === "support" ? `${m.category} support` : m.name || m.email,
          preview: m.replies.at(-1)?.body ?? m.message,
          at: m.replies.at(-1)?.created_at ?? m.created_at,
          unread: m.unread,
        }))
  ).filter((m) => !unreadOnly || m.unread);
  const thread = data?.support.find((m) => m.id === selected);
  const directThread = (data?.direct ?? [])
    .filter(
      (m) =>
        (m.sender_id === selected && m.recipient_id === data?.userId) ||
        (m.recipient_id === selected && m.sender_id === data?.userId),
    )
    .slice()
    .reverse();
  const changeTab = (value: string) => {
    setTab(value as Tab);
    setSelected(null);
    setCompose(false);
    setBody("");
  };
  const open = (id: string) => {
    setSelected(id);
    setCompose(false);
    setBody("");
    action.mutate(() => markRead({ data: { kind: tab === "team" ? "team" : "support", id } }));
  };
  const active = compose || !!selected;
  const currentCrew = data?.crew.some((p) => p.id === selected);

  return (
    <div className="min-w-0 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Inbox className="h-6 w-6 text-primary" /> Team inbox
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            title="Refresh inbox"
            aria-label="Refresh inbox"
            onClick={refresh}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {(tab === "team" || tab === "support") && (
            <Button
              onClick={() => {
                setCompose(true);
                setSelected(null);
                setBody("");
                setRecipient("");
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              {tab === "team" ? "New message" : "Contact support"}
            </Button>
          )}
        </div>
      </div>
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="h-auto flex flex-wrap justify-start mb-4">
          <TabsTrigger value="team">Crew</TabsTrigger>
          <TabsTrigger value="support">My support</TabsTrigger>
          {data?.isAdmin && (
            <>
              <TabsTrigger value="assigned">Assigned to me</TabsTrigger>
              <TabsTrigger value="queue">Support queue</TabsTrigger>
            </>
          )}
        </TabsList>
      </Tabs>
      {inbox.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-64" />
        </div>
      ) : inbox.isError ? (
        <div role="alert" className="py-10 space-y-4">
          <p>{inbox.error.message}</p>
          <Button variant="outline" onClick={refresh}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)] border-y border-border min-h-[480px]">
          <section
            aria-label="Conversations"
            className={`${active ? "hidden md:block" : "block"} min-w-0 md:border-r border-border md:pr-4 py-3`}
          >
            <label className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
              />
              Unread only
            </label>
            {rows.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <MessageSquare className="h-7 w-7 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">
                  {unreadOnly ? "No unread messages" : "No conversations yet"}
                </p>
                {tab === "team" && !data?.crew.length && (
                  <>
                    <p className="text-sm text-muted-foreground">No shared-car crew yet.</p>
                    <Button asChild variant="outline">
                      <Link to="/garage">Open Garage</Link>
                    </Button>
                  </>
                )}
              </div>
            ) : (
              rows.map((m) => (
                <Button
                  key={m.id}
                  variant="ghost"
                  onClick={() => open(m.id)}
                  className={`w-full h-auto min-h-20 px-3 py-3 mb-1 justify-start text-left whitespace-normal ${selected === m.id ? "bg-muted" : ""}`}
                >
                  <span className="block min-w-0 w-full">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{m.label}</span>
                      {m.unread && <Badge className="ml-auto shrink-0">New</Badge>}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground mt-1">
                      {m.preview}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-1">{when(m.at)}</span>
                  </span>
                </Button>
              ))
            )}
          </section>
          <section
            aria-label="Message thread"
            className={`${active ? "block" : "hidden md:block"} min-w-0 py-4 md:pl-5`}
          >
            {!active ? (
              <div className="flex flex-col items-center justify-center h-80 gap-3 text-muted-foreground">
                <Inbox className="h-8 w-8" />
                <p>Select a conversation</p>
              </div>
            ) : (
              <>
                <Button
                  className="md:hidden mb-3"
                  variant="ghost"
                  onClick={() => {
                    setSelected(null);
                    setCompose(false);
                    setBody("");
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Conversations
                </Button>
                <h2 className="font-display font-bold text-lg break-words mb-3">
                  {compose
                    ? tab === "team"
                      ? "New crew message"
                      : "Contact support"
                    : tab === "team"
                      ? name(selected ?? "")
                      : thread?.name || "Support conversation"}
                </h2>
                {compose && tab === "team" && (
                  <div className="mb-4">
                    <label className="text-sm block mb-2">To</label>
                    <Select value={recipient} onValueChange={setRecipient}>
                      <SelectTrigger aria-label="Message recipient">
                        <SelectValue placeholder="Select crew member" />
                      </SelectTrigger>
                      <SelectContent>
                        {data?.crew.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!data?.crew.length && (
                      <p className="text-sm text-muted-foreground mt-3">
                        Share a car from Garage to add crew.
                      </p>
                    )}
                  </div>
                )}
                {!compose && tab !== "team" && thread && (
                  <>
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <Badge variant="outline">{thread.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {when(thread.created_at)}
                      </span>
                      {data?.isAdmin && (
                        <>
                          <span className="text-sm text-muted-foreground break-all">{thread.email}</span>
                          <Select
                            value={thread.assigned_to ?? "unassigned"}
                            onValueChange={(id) =>
                              action.mutate(() =>
                                assign({
                                  data: {
                                    supportId: thread.id,
                                    assigneeId: id === "unassigned" ? null : id,
                                  },
                                }),
                              )
                            }
                            disabled={action.isPending}
                          >
                            <SelectTrigger
                              aria-label="Assign support request"
                              className="w-full sm:w-52"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {data.staff.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.id === data.userId ? "Me" : p.display_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={action.isPending}
                            onClick={() =>
                              action.mutate(() =>
                                status({
                                  data: {
                                    id: thread.id,
                                    status: thread.status === "open" ? "resolved" : "open",
                                  },
                                }),
                              )
                            }
                          >
                            {thread.status === "open" ? "Resolve" : "Reopen"}
                          </Button>
                        </>
                      )}
                    </div>
                    <Message
                      body={thread.message}
                      sender={thread.user_id === data?.userId ? "You" : thread.name || thread.email}
                      at={thread.created_at}
                    />
                    {thread.replies.map((m) => (
                      <Message
                        key={m.id}
                        body={m.body}
                        sender={
                          m.sender_id === data?.userId
                            ? "You"
                            : m.sender_id === thread.user_id
                              ? thread.name || "Sender"
                              : "Support team"
                        }
                        at={m.created_at}
                      />
                    ))}
                  </>
                )}
                {!compose &&
                  tab === "team" &&
                  directThread.map((m) => (
                    <Message
                      key={m.id}
                      body={m.body}
                      sender={name(m.sender_id)}
                      at={m.created_at}
                      read={m.sender_id === data?.userId && !!m.read_at}
                    />
                  ))}
                {!compose && tab === "team" && !currentCrew ? (
                  <p className="text-sm text-muted-foreground mt-5">
                    This member no longer shares a car with you.
                  </p>
                ) : (
                  <form
                    className="mt-5 space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage.mutate();
                    }}
                  >
                    <label htmlFor="inbox-body" className="block text-sm font-medium">
                      {compose ? "Message" : "Reply"}
                    </label>
                    <Textarea
                      id="inbox-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      maxLength={4000}
                      rows={4}
                      required
                      placeholder={compose ? "Write your message…" : "Write a reply…"}
                    />
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-xs text-muted-foreground">{body.length}/4000</span>
                      <Button
                        type="submit"
                        disabled={
                          sendMessage.isPending ||
                          !body.trim() ||
                          (compose && tab === "team" && !recipient)
                        }
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {sendMessage.isPending ? "Sending…" : "Send"}
                      </Button>
                    </div>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Message({
  body,
  sender,
  at,
  read,
}: {
  body: string;
  sender: string;
  at: string;
  read?: boolean;
}) {
  return (
    <article className="border-b border-border py-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground break-words">{sender}</span>
        <time>{when(at)}</time>
        {read && (
          <span className="inline-flex items-center gap-1">
            <CheckCheck className="h-3 w-3" />
            Read
          </span>
        )}
      </div>
      <p className="mt-2 text-sm whitespace-pre-wrap break-words">{body}</p>
    </article>
  );
}
