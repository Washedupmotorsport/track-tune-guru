import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, ExternalLink, BookOpen, Play } from "lucide-react";
import { MANUAL_GROUPS, MANUAL_SECTIONS } from "@/lib/manual-content";
import { z } from "zod";

const searchSchema = z.object({
  section: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/manual")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Manual — My Race Engineer" },
      { name: "description", content: "User manual and tutorials for My Race Engineer." },
    ],
  }),
  component: ManualPage,
});

function ManualPage() {
  const { section: sectionParam, q: qParam } = useSearch({ from: "/_authenticated/manual" });
  const [query, setQuery] = useState(qParam ?? "");
  const [activeId, setActiveId] = useState<string>(sectionParam ?? MANUAL_SECTIONS[0].id);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MANUAL_SECTIONS;
    return MANUAL_SECTIONS.filter((s) => {
      const hay = [s.title, s.summary, s.whenToUse, ...s.keyActions, ...(s.pitfalls ?? [])]
        .join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  const active = MANUAL_SECTIONS.find((s) => s.id === activeId) ?? MANUAL_SECTIONS[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* Sidebar */}
      <aside className="lg:sticky lg:top-16 lg:self-start">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-primary" />
          <h1 className="font-mono text-xs uppercase tracking-widest text-primary">Manual</h1>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full pl-7 pr-2 h-9 rounded-md border border-border bg-muted/30 text-xs"
          />
        </div>
        <nav className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {MANUAL_GROUPS.map((g) => {
            const items = filtered.filter((s) => s.group === g);
            if (items.length === 0) return null;
            return (
              <div key={g}>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1 px-2">
                  {g}
                </div>
                <ul>
                  {items.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => setActiveId(s.id)}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                          active.id === s.id
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:text-primary hover:bg-muted/30"
                        }`}
                      >
                        {s.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <article className="max-w-3xl">
        <header className="mb-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {active.group}
          </div>
          <h2 className="text-2xl font-semibold mt-1">{active.title}</h2>
          {active.route && (
            <Link
              to={active.route}
              className="inline-flex items-center gap-1 mt-2 text-xs font-mono uppercase tracking-widest text-primary hover:underline"
            >
              Open this screen <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </header>

        <p className="text-sm leading-relaxed mb-5">{active.summary}</p>

        <Section title="When to use">{active.whenToUse}</Section>

        <div className="mb-5">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
            Key actions
          </h3>
          <ul className="space-y-1.5 text-sm">
            {active.keyActions.map((a, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">›</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>

        {active.pitfalls && active.pitfalls.length > 0 && (
          <div className="mb-5 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-destructive mb-2">
              Pitfalls
            </h3>
            <ul className="space-y-1 text-sm">
              {active.pitfalls.map((p, i) => <li key={i}>• {p}</li>)}
            </ul>
          </div>
        )}

        <VideoEmbed url={active.videoUrl} />
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">{title}</h3>
      <p className="text-sm">{children}</p>
    </div>
  );
}

function VideoEmbed({ url }: { url?: string }) {
  if (!url) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center">
        <Play className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Video walkthrough — coming soon
        </p>
      </div>
    );
  }
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (yt) {
    return (
      <iframe
        className="w-full aspect-video rounded-md"
        src={`https://www.youtube.com/embed/${yt[1]}`}
        allowFullScreen
        title="Walkthrough"
      />
    );
  }
  if (vimeo) {
    return (
      <iframe
        className="w-full aspect-video rounded-md"
        src={`https://player.vimeo.com/video/${vimeo[1]}`}
        allowFullScreen
        title="Walkthrough"
      />
    );
  }
  return <video className="w-full rounded-md" src={url} controls />;
}