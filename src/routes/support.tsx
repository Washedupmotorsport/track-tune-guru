import { createFileRoute, Link } from "@tanstack/react-router";
import logoMre from "@/assets/logo-mre.png";
import { LifeBuoy, Mail, BookOpen, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/support")({
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "Support — My Race Engineer" },
      { name: "description", content: "Get help with My Race Engineer — contact support, browse the manual, and report issues." },
    ],
    links: [{ rel: "canonical", href: "/support" }],
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

          <div className="space-y-4">
            <a
              href="mailto:support@my-race-engineer.app"
              className="block rounded-md border border-border bg-card p-4 hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <div className="font-display font-bold">Email support</div>
                  <div className="text-xs text-muted-foreground font-mono">support@my-race-engineer.app</div>
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
              href="mailto:support@my-race-engineer.app?subject=Feedback"
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