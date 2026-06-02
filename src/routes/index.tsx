import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Gauge, Wrench, ChartLine as LineChart, Flag } from "lucide-react";
import { DISCIPLINES } from "@/lib/disciplines";
import { useAuth } from "@/lib/auth-context";
import logoMre from "@/assets/logo-mre.png";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "My Race Engineer — Race Car Setup Manager" },
      { name: "description", content: "Your digital pit garage for circuit, drift, drag, autocross, rally and oval. Save baselines, log changes, win every session." },
      { property: "og:title", content: "My Race Engineer — Race Car Setup Manager" },
      { property: "og:description", content: "Your digital pit garage for circuit, drift, drag, autocross, rally and oval. Save baselines, log changes, win every session." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "My Race Engineer",
          description: "Race car setup, session, and lap analysis manager for every motorsport discipline.",
        }),
      },
    ],
  }),
});

function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen text-foreground">
      <header className="fixed top-0 inset-x-0 z-30 backdrop-blur-md bg-background/70 border-b border-border">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link to="/" aria-label="My Race Engineer — home" className="flex items-center">
            <img src={logoMre} alt="My Race Engineer" className="h-10 w-auto" />
          </Link>
          <nav className="flex items-center gap-2">
            {user ? (
              <Link to="/engineer"><Button variant="default" size="sm">Open Cockpit</Button></Link>
            ) : (
              <>
                <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
                <Link to="/auth"><Button size="sm">Get started</Button></Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <div className="h-16" aria-hidden />

      <section className="relative overflow-hidden">
        {/* Checkered flag backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(45deg, var(--foreground) 25%, transparent 25%), linear-gradient(-45deg, var(--foreground) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--foreground) 75%), linear-gradient(-45deg, transparent 75%, var(--foreground) 75%)",
            backgroundSize: "48px 48px",
            backgroundPosition: "0 0, 0 24px, 24px -24px, -24px 0px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/30 to-background" />
        <img src="https://cdn.discordapp.com/attachments/1128623717677813821/1511262075366932510/IMG_3323.jpg?ex=6a1fcffc&is=6a1e7e7c&hm=2033391684d0a86e4ef4841ac65379fc7889619b5b3967921a2f426ad1790f48" alt="Race car banner" width={1920} height={1080}
          className="absolute inset-0 w-full h-full object-cover z-10" style={{ objectPosition: "center 30%" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background z-20" />
        <div className="relative z-30 mx-auto max-w-6xl px-4 pt-24 pb-32">
          <h1 className="mt-6 font-display text-5xl md:text-7xl font-bold leading-tight max-w-3xl">
            Dial in every <span className="text-primary text-glow">setup</span>.
            <br />Win every <span className="text-accent">session</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Your digital pit garage for circuit, drift, drag, autocross, rally and oval.
            Save baselines, log changes, never lose a winning setup again.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={user ? "/engineer" : "/auth"}>
              <Button size="lg" className="shadow-glow">
                {user ? "Enter Cockpit" : "Start free"}
              </Button>
            </Link>
            <a href="#disciplines">
              <Button size="lg" variant="outline">Explore disciplines</Button>
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 grid md:grid-cols-3 gap-3">
        <h2 className="sr-only">Features</h2>
        {[
          { icon: Wrench, title: "Setups", body: "Tires, alignment, suspension, aero, drivetrain — built per discipline." },
          { icon: LineChart, title: "Track conditions", body: "Tag every setup with track, weather and notes for total recall." },
          { icon: Gauge, title: "Compare baselines", body: "Clone a setup, tweak one knob, save the new baseline. Iterate fast." },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-6 shadow-card hover:border-primary/50 transition-colors">
            <f.icon className="w-6 h-6 text-primary" />
            <h3 className="mt-4 text-lg font-display font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <section id="disciplines" className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-end justify-between mb-8">
          <h2 className="font-display text-3xl font-bold flex items-center gap-3">
            <Flag className="w-6 h-6 text-primary" />Every discipline, covered
          </h2>        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {DISCIPLINES.map((d) => (
            <div key={d.id} className="group rounded-xl border border-border bg-card/60 p-5 hover:border-primary transition-colors">
              <div className="font-medium text-xs text-primary uppercase tracking-wide">{d.id}</div>
              <div className="mt-2 font-display text-xl font-bold">{d.label}</div>
              <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{d.tagline}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border mt-16">
        <div className="mx-auto max-w-6xl px-4 py-5 text-sm text-muted-foreground flex items-center justify-between">
          <div>© {new Date().getFullYear()} My Race Engineer</div>
          <div className="font-medium text-sm text-muted-foreground">Built for the paddock</div>
        </div>
      </footer>
    </div>
  );
}
