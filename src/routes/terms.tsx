import { createFileRoute, Link } from "@tanstack/react-router";
import logoMre from "@/assets/logo-mre.png";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — My Race Engineer" },
      { name: "description", content: "Terms of Service for My Race Engineer." },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
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

      <main className="flex-1 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-3xl font-bold mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</p>

          <div className="space-y-8 text-sm leading-relaxed text-foreground">
            <section>
              <h2 className="font-display text-lg font-semibold mb-2">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using My Race Engineer, you agree to be bound by these Terms of Service.
                If you do not agree to all the terms and conditions, you must not access or use the service.
                These terms apply to all visitors, users, and others who access or use the application.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-2">2. User Data Ownership</h2>
              <p className="text-muted-foreground">
                All data you enter into My Race Engineer — including car setups, session logs, lap times, tyre data,
                track notes, and any other content — belongs entirely to you. We do not claim ownership over your data.
                You retain full rights to export, modify, or delete your data at any time.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-2">3. Account Responsibilities</h2>
              <p className="text-muted-foreground">
                You are responsible for maintaining the confidentiality of your account credentials and for all activities
                that occur under your account. You agree to notify us immediately of any unauthorised use of your account.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-2">4. No Warranty</h2>
              <p className="text-muted-foreground">
                My Race Engineer is provided on an "as is" and "as available" basis without any warranties of any kind,
                either express or implied. We do not warrant that the service will be uninterrupted, secure, or error-free.
                Setup recommendations and AI-generated suggestions are for informational purposes only and should always be
                validated by a qualified race engineer before use on track.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-2">5. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                In no event shall My Race Engineer, its creators, or affiliates be liable for any indirect, incidental,
                special, consequential, or punitive damages arising out of or relating to your use of the service.
                This includes, without limitation, any loss of data, profits, or racing performance.
                Our total liability shall not exceed the amount you have paid us in the twelve months preceding the claim,
                or £100, whichever is greater.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-2">6. Termination</h2>
              <p className="text-muted-foreground">
                We may terminate or suspend your account immediately, without prior notice or liability, for any reason,
                including if you breach these Terms. Upon termination, your right to use the service will cease immediately.
                You may also delete your account at any time from within the application.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-2">7. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify or replace these Terms at any time. We will provide notice of significant
                changes via the application or by email. Your continued use of the service after any changes constitutes
                acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-2">8. Contact</h2>
              <p className="text-muted-foreground">
                If you have any questions about these Terms, please contact us at{" "}
                <a href="mailto:support@myraceengineer.app" className="text-primary hover:underline">support@myraceengineer.app</a>.
              </p>
            </section>
          </div>

          <div className="mt-10 pt-6 border-t border-border">
            <Link to="/" className="text-sm text-primary hover:underline">← Back to home</Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-2xl px-4 py-4 text-xs text-muted-foreground flex items-center justify-between">
          <span>© {new Date().getFullYear()} My Race Engineer</span>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
