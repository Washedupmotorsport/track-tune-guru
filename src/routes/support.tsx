import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { LifeBuoy, Mail, BookOpen, MessageSquare, Send, CheckCircle2 } from "lucide-react";
import logoMre from "@/assets/logo-mre.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORT_CATEGORIES } from "@/lib/launch-rules";
import {
  submitSupportMessage,
  submitSupportMessageSignedIn,
} from "@/lib/support.functions";

type Category = (typeof SUPPORT_CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  bug: "Bug or something broken",
  account: "Account or sign-in",
  setup: "Setup and engineering",
  tyres: "Tyres",
  feature: "Feature idea",
  other: "Something else",
};

export const Route = createFileRoute("/support")({
  component: SupportPage,
  head: () => ({
    meta: [
      { property: "og:title", content: "Support — My Race Engineer" },
      { property: "og:description", content: "Get help with My Race Engineer — contact support, browse the manual, and report issues." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Support — My Race Engineer" },
      { name: "description", content: "Get help with My Race Engineer — contact support, browse the manual, and report issues." },
    ],
    links: [{ rel: "canonical", href: "https://track-tune-guru.lovable.app/support" }],
  }),
});

function SupportPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="h-[2px] w-full bg-primary" aria-hidden />
      <header className="border-b border-border">
        <div className="mx-auto max-w-[1400px] px-4 h-12 flex items-center">
          <Link to="/" aria-label="My Race Engineer — home" className="flex items-center">
            <img src={logoMre} alt="My Race Engineer" className="h-7 w-auto" />
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
            <LifeBuoy className="w-3 h-3" /> Support
          </div>
          <h1 className="font-display text-3xl font-bold mt-1 mb-2">We're here to help</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Whether you've found a bug, need a hand with a workflow, or want to suggest a feature —
            reach out and we'll get back to you.
          </p>

          <ContactForm />

          <div className="mt-8 space-y-4">
            <a
              href="mailto:support@myraceengineer.app"
              className="block rounded-md border border-border bg-card p-4 hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <div className="font-display font-bold">Email support</div>
                  <div className="text-xs text-muted-foreground font-mono">support@myraceengineer.app</div>
                </div>
              </div>
            </a>

            <Link
              to="/manual"
              className="block rounded-md border border-border bg-card p-4 hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <div className="font-display font-bold">Read the manual</div>
                  <div className="text-xs text-muted-foreground">In-app guide to every workflow, from baseline setup to debrief.</div>
                </div>
              </div>
            </Link>

            <a
              href="mailto:support@myraceengineer.app?subject=Feedback"
              className="block rounded-md border border-border bg-card p-4 hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <div className="font-display font-bold">Send feedback</div>
                  <div className="text-xs text-muted-foreground">Tell us what's working and what's missing.</div>
                </div>
              </div>
            </a>
          </div>

          <div className="mt-10 text-xs text-muted-foreground font-mono uppercase tracking-widest">
            <Link to="/" className="hover:text-primary">← Back to app</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function ContactForm() {
  const sendPublic = useServerFn(submitSupportMessage);
  const sendSignedIn = useServerFn(submitSupportMessageSignedIn);

  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      const address = data.session?.user?.email;
      if (alive && address) {
        setAccountEmail(address);
        setEmail(address);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const ready =
    message.trim().length >= 10 && (accountEmail !== null || email.includes("@"));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || sending) return;
    setError(null);
    setSending(true);
    try {
      if (accountEmail) {
        await sendSignedIn({
          data: {
            name: name.trim() || undefined,
            category,
            message: message.trim(),
            source: "in_app",
            honeypot,
          },
        });
      } else {
        await sendPublic({
          data: {
            email: email.trim(),
            name: name.trim() || undefined,
            category,
            message: message.trim(),
            source: "web",
            honeypot,
          },
        });
      }
      setSentTo(accountEmail ?? email.trim());
      setName("");
      setMessage("");
      setHoneypot("");
    } catch (submitError) {
      setError(
        (submitError as Error)?.message ||
          "We couldn't send that message. Please email support@myraceengineer.app instead.",
      );
    } finally {
      setSending(false);
    }
  }

  if (sentTo) {
    return (
      <div className="rounded-md border border-primary/40 bg-card p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
          <div>
            <div className="font-display font-bold">Message sent</div>
            <p className="text-sm text-muted-foreground mt-1">
              It's with the team now — we'll reply to{" "}
              <span className="font-mono">{sentTo}</span>. Replies come from a real inbox, so
              answer away and the thread stays together.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => setSentTo(null)}
            >
              Send another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-md border border-border bg-card p-5 space-y-4"
    >
      <div className="font-display font-bold">Message the team</div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="support-name">Your name</Label>
          <Input
            id="support-name"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional"
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="support-email">Email</Label>
          <Input
            id="support-email"
            type="email"
            value={email}
            maxLength={254}
            readOnly={accountEmail !== null}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          {accountEmail ? (
            <p className="text-[11px] text-muted-foreground">
              Filled in from your signed-in account.
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>What's it about?</Label>
        <Select value={category} onValueChange={(value) => setCategory(value as Category)}>
          <SelectTrigger aria-label="Message topic">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORT_CATEGORIES.map((key) => (
              <SelectItem key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="support-message">Your message</Label>
        <Textarea
          id="support-message"
          value={message}
          maxLength={4000}
          rows={5}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What happened, and what were you doing when it did?"
        />
        <p className="text-[11px] text-muted-foreground">
          {message.trim().length < 10
            ? "At least 10 characters."
            : `${4000 - message.length} characters left.`}
        </p>
      </div>

      {/* Spam trap: real people never see or fill this field. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="support-company">Company</label>
        <input
          id="support-company"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!ready || sending}>
          <Send className="w-3 h-3 mr-1" />
          {sending ? "Sending…" : "Send message"}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Or email <span className="font-mono">support@myraceengineer.app</span> directly.
        </span>
      </div>
    </form>
  );
}
