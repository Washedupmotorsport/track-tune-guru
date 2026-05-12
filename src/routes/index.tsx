import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Gauge, Wrench, LineChart, Flag } from "lucide-react";
import heroCar from "@/assets/hero-car.jpg";
import { DISCIPLINES } from "@/lib/disciplines";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg">
            <span className="inline-block w-2 h-6 bg-primary shadow-glow" />
            SUMMIT<span className="text-primary">RACING</span>
          </Link>
          <nav className="flex items-center gap-2">
            {user ? (
              <Link to="/garage"><Button variant="default" size="sm">Open Garage</Button></Link>
            ) : (
              <>
                <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
                <Link to="/auth"><Button size="sm">Get started</Button></Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <img src={heroCar} alt="Race car at night" width={1920} height={1080}
          className="absolute inset-0 w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background" />
        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-32">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Pit-lane ready
          </div>
          <h1 className="mt-6 font-display text-5xl md:text-7xl font-bold leading-[0.95] max-w-3xl">
            Dial in every <span className="text-primary text-glow">setup</span>.
            <br />Win every <span className="text-accent">session</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Your digital pit garage for circuit, drift, drag, autocross, rally and oval.
            Save baselines, log changes, never lose a winning sheet again.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={user ? "/garage" : "/auth"}>
              <Button size="lg" className="shadow-glow">
                {user ? "Enter Garage" : "Start free"}
              </Button>
            </Link>
            <a href="#disciplines">
              <Button size="lg" variant="outline">Explore disciplines</Button>
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 grid md:grid-cols-3 gap-6">
        {[
          { icon: Wrench, title: "Setup sheets", body: "Tires, alignment, suspension, aero, drivetrain — built per discipline." },
          { icon: LineChart, title: "Track conditions", body: "Tag every setup with track, weather and notes for total recall." },
          { icon: Gauge, title: "Compare baselines", body: "Clone a setup, tweak one knob, save the new baseline. Iterate fast." },
        ].map((f) => (
          <div key={f.title} className="rounded-lg border border-border bg-card p-6 shadow-card hover:border-primary/50 transition-colors">
            <f.icon className="w-6 h-6 text-primary" />
            <h3 className="mt-4 text-xl font-display font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <section id="disciplines" className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-end justify-between mb-8">
          <h2 className="font-display text-3xl font-bold flex items-center gap-3">
            <Flag className="w-6 h-6 text-primary" />Every discipline, covered
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {DISCIPLINES.map((d) => (
            <div key={d.id} className="group rounded-lg border border-border bg-card/60 p-5 hover:border-primary transition-colors">
              <div className="font-mono text-xs uppercase tracking-widest text-primary">{d.id}</div>
              <div className="mt-2 font-display text-2xl font-bold">{d.label}</div>
              <div className="text-sm text-muted-foreground">{d.tagline}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border mt-16">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground flex items-center justify-between">
          <div>© {new Date().getFullYear()} Summit Racing</div>
          <div className="font-mono text-xs uppercase tracking-widest">Built for the paddock</div>
        </div>
      </footer>
    </div>
  );
}
