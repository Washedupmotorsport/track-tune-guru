import { createFileRoute, Link } from "@tanstack/react-router";
import logoMre from "@/assets/logo-mre.png";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — My Race Engineer" },
      { name: "description", content: "Privacy Policy for My Race Engineer." },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
});

function PrivacyPage() {
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
          <h1 className="font-display text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</p>

          <div className="space-y-8 text-sm leading-relaxed text-foreground">
            <section>
              <h2 className="font-display text-lg font-semibold mb-2">1. What Data We Collect</h2>
              <p className="text-muted-foreground">
                We collect only the data necessary to provide the service:
              </p>
              <ul className="list-disc list-inside mt-2 text-muted-foreground space-y-1">
                <li><strong>Account information:</strong> Your email address and display name, used for authentication and account management.</li>
                <li><strong>Racing data you enter:</strong> Car setups, session logs, lap times, tyre pressures and wear data, track notes, driver feedback, debriefs, and any other content you voluntarily save in the app.</li>
                <li><strong>Usage data:</strong> Basic interaction data to help us improve the application (e.g., feature usage, error logs). No third-party trackers are used.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-2">2. How We Store Your Data</h2>
              <p className="text-muted-foreground">
                All data is stored securely in Supabase, a PostgreSQL-backed cloud database service.
                Your data is encrypted in transit (TLS) and at rest. We use industry-standard security
                practices including Row Level Security (RLS) to ensure your data is accessible only to you
                and any team members you explicitly invite.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-2">3. We Do Not Sell Your Data</h2>
              <p className="text-muted-foreground">
                My Race Engineer will never sell, rent, or trade your personal data or racing data to third parties.
                We do not use your data for advertising profiling. Your data is used solely to operate and improve
                the service for you.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-2">4. AI and Data Processing</h2>
              <p className="text-muted-foreground">
                Some features use AI to generate setup recommendations or session summaries.
                When you use these features, relevant setup and session context may be sent to our AI provider
                for processing. No personally identifiable information is included in these requests.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-2">5. Cookies and Local Storage</h2>
              <p className="text-muted-foreground">
                We use browser local storage and essential cookies to keep you signed in and remember your preferences.
                We do not use tracking cookies or analytics scripts from third-party advertisers.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-2">6. Data Retention and Deletion</h2>
              <p className="text-muted-foreground">
                We retain your data for as long as your account is active. You can delete individual records
                (setups, sessions, cars) at any time from within the app. If you wish to delete your entire account
                and all associated data, please contact us at{" "}
                <a href="mailto:support@myraceengineer.app" className="text-primary hover:underline">support@myraceengineer.app</a>.
                We will process deletion requests within 30 days.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-2">7. Your Rights</h2>
              <p className="text-muted-foreground">
                Depending on your jurisdiction, you may have the right to access, correct, or delete your personal data.
                You may also have the right to restrict or object to certain processing. To exercise these rights,
                please contact us using the email below.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold mb-2">8. Contact</h2>
              <p className="text-muted-foreground">
                If you have any questions about this Privacy Policy or how we handle your data, please contact us at{" "}
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
