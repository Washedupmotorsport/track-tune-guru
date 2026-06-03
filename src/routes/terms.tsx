import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import logoMre from "@/assets/logo-mre.png";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
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

      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-6">
            <Clock className="w-6 h-6 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-3">Terms of Service</h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            Our Terms of Service are currently being drafted. Check back soon — we're working on it.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
