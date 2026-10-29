import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CalendarDays,
  Gauge,
  Wrench,
  ChartLine as LineChart,
  Flag,
  MessageSquare,
  Layers,
  Thermometer,
} from "lucide-react";
import { DISCIPLINES } from "@/lib/disciplines";
import { useAuth } from "@/lib/auth-context";
import logoMre from "@/assets/logo-mre.png";
import { LandingProductPreview } from "@/components/landing-product-preview";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { property: "og:image", content: "https://myraceengineer.app/mre-share.jpg" },
      { name: "twitter:image", content: "https://myraceengineer.app/mre-share.jpg" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "My Race Engineer — Race Car Setup Manager" },
      {
        name: "description",
        content:
          "Keep car setups, tyre pressures and driver feedback together. Track changes, compare session results and build a baseline you can trust with My Race Engineer.",
      },
      { property: "og:title", content: "My Race Engineer — Race Car Setup Manager" },
      {
        property: "og:description",
        content:
          "Keep car setups, tyre pressures and driver feedback together. Track changes, compare session results and build a baseline you can trust with My Race Engineer.",
      },
      { name: "twitter:title", content: "My Race Engineer — Race Car Setup Manager" },
      {
        name: "twitter:description",
        content:
          "Keep car setups, tyre pressures and driver feedback together. Track changes, compare session results and build a baseline you can trust with My Race Engineer.",
      },
      { property: "og:url", content: "https://myraceengineer.app/" },
    ],
    links: [{ rel: "canonical", href: "https://myraceengineer.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "My Race Engineer",
          url: "https://myraceengineer.app/",
          description:
            "Car setups, tyre pressures, driver feedback and session comparisons in one race-weekend workspace.",
        }),
      },
    ],
  }),
});

function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) navigate({ to: "/weekends", replace: true });
  }, [user, navigate]);
  return (
    <div className="landing-page min-h-screen text-foreground">
      <header className="fixed top-0 inset-x-0 z-30 backdrop-blur-md bg-background/70 border-b border-border">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link to="/" aria-label="My Race Engineer — home" className="flex items-center">
            <img
              src={logoMre}
              alt="My Race Engineer"
              className="h-9 sm:h-10 w-auto max-w-36 sm:max-w-none object-contain"
            />
          </Link>
          <nav className="flex items-center gap-2">
            {user ? (
              <Button asChild size="sm">
                <Link to="/weekends">Open app</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth">Start free</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <div className="h-16" aria-hidden />

      <section className="relative isolate overflow-hidden">
        <img
          src="/mre-share.jpg"
          alt="Blue and yellow Formula race car on circuit"
          width={1366}
          height={768}
          fetchPriority="high"
          className="landing-hero-image absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-landing-scrim" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-12 md:py-16">
          <p className="mb-5 font-display text-lg font-bold text-hero-white">My Race Engineer</p>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-tight max-w-2xl text-hero-white">
            Build Smarter <span className="text-hero-yellow">Setups.</span>
            <br />
            Gain Confidence. Go Faster.
          </h1>
          <p className="mt-5 max-w-lg text-base sm:text-lg leading-relaxed text-hero-white">
            Keep your car setups, tyre pressures and driver feedback together. Track every change
            and build a baseline you can trust.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/weekends" : "/auth"}>
                {user ? "Open app" : "Start free"}
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#walkthrough">See how it works</a>
            </Button>
          </div>
        </div>
      </section>

      <section id="walkthrough" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Inside the race weekend</p>
            <h2 className="mt-2 font-display text-2xl md:text-3xl">
              Every session. One clear record.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            A baseline, the change you tested, and what the driver felt — kept together.
          </p>
        </div>
        <LandingProductPreview />
      </section>

      <section className="border-y border-border bg-muted/50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="font-display text-2xl">From first practice to the next test</h2>
          <ol className="mt-7 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: CalendarDays,
                title: "Weekend",
                body: "Organise your car, circuit and event.",
              },
              { icon: Gauge, title: "Session", body: "Record conditions and session results." },
              { icon: Wrench, title: "Setup", body: "Save your baseline and log what changed." },
              {
                icon: MessageSquare,
                title: "Debrief",
                body: "Capture driver feedback and decide what to try next.",
              },
            ].map((step, index) => (
              <li key={step.title}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-primary">0{index + 1}</span>
                  <step.icon className="size-5 text-primary" />
                  <h3 className="font-display text-lg">{step.title}</h3>
                  {index < 3 && (
                    <ArrowRight className="ml-auto size-4 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <h2 className="font-display text-2xl">Less guesswork between sessions</h2>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: Wrench,
              title: "Keep a reliable baseline.",
              body: "Save your starting setup in the Setup Library.",
            },
            {
              icon: Layers,
              title: "Know what changed between sessions.",
              body: "Keep iterations and setup history alongside your baseline.",
            },
            {
              icon: Thermometer,
              title: "Keep tyre pressures and conditions with the setup.",
              body: "Record wheel pressures and session conditions for context.",
            },
            {
              icon: LineChart,
              title: "Compare driver feedback and session results.",
              body: "Review lap times and debrief notes before choosing the next test.",
            },
          ].map((f) => (
            <div key={f.title} className="border-t-2 border-primary pt-5">
              <f.icon className="w-6 h-6 text-primary" />
              <h3 className="mt-4 text-lg font-display font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="disciplines" className="border-y border-border">
        <div className="mx-auto max-w-6xl px-4 py-7 flex flex-wrap items-center gap-x-8 gap-y-4">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Flag className="size-5 text-primary" />
            Discipline-specific setup templates
          </h2>
          <ul className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground">
            {DISCIPLINES.map((d) => (
              <li key={d.id}>{d.label}</li>
            ))}
          </ul>
        </div>
      </section>

      <footer>
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground flex flex-wrap gap-4 items-center justify-between">
          <div>© {new Date().getFullYear()} My Race Engineer</div>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-primary transition-colors">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-primary transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
