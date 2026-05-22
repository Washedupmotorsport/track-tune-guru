import { createFileRoute, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPublicSession } from "@/lib/share.functions";
import { formatLapTime } from "@/lib/lap-time";
import { Trophy, Cloud, Loader2 } from "lucide-react";

export const Route = createFileRoute("/share/session/$token")({
  component: PublicSessionView,
  head: ({ params }) => ({
    meta: [
      { title: "Shared session — My Race Engineer" },
      { name: "description", content: "View shared race session data: laps, sectors, weather and conditions." },
      { property: "og:title", content: "Shared session — My Race Engineer" },
      { property: "og:description", content: "View shared race session data: laps, sectors, weather and conditions." },
      { property: "og:url", content: `/share/session/${params.token}` },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `/share/session/${params.token}` }],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      This share link is invalid or has been revoked.
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      {error.message}
    </div>
  ),
});

function PublicSessionView() {
  const { token } = Route.useParams();
  const fetchFn = useServerFn(getPublicSession);
  const q = useQuery({
    queryKey: ["public-session", token],
    queryFn: () => fetchFn({ data: { token } }),
    retry: false,
  });

  if (q.isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (q.error) throw notFound();
  if (!q.data) return null;

  const { session, car, laps } = q.data;
  const best = laps.length ? Math.min(...laps.map((l) => l.lap_time_ms)) : null;
  const avg = laps.length ? Math.round(laps.reduce((s, l) => s + l.lap_time_ms, 0) / laps.length) : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="font-mono text-xs uppercase tracking-widest text-primary">
          Shared session · {session.session_type}
        </div>
        <h1 className="font-display text-4xl font-bold mt-2">{session.name}</h1>
        <div className="mt-1 text-sm text-muted-foreground">
          {car?.name} {car?.make ? `· ${car.make}` : ""} {car?.model ?? ""} · {new Date(session.started_at).toLocaleString()}
        </div>

        <div className="mt-6 grid md:grid-cols-4 gap-3">
          <Stat label="Laps" value={String(laps.length)} />
          <Stat label="Best" value={formatLapTime(best)} icon={<Trophy className="w-4 h-4 text-primary" />} />
          <Stat label="Avg" value={formatLapTime(avg)} />
          <Stat label="Weather" value={session.weather ?? "—"} icon={<Cloud className="w-4 h-4 text-primary" />} />
        </div>

        {laps.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card p-5">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">#</th><th className="py-2 pr-3">Lap</th><th className="py-2 pr-3">S1</th><th className="py-2 pr-3">S2</th><th className="py-2 pr-3">S3</th><th className="py-2 pr-3">Notes</th>
              </tr></thead>
              <tbody>
                {laps.map((l) => (
                  <tr key={l.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-3 font-mono">{l.lap_number ?? "—"}</td>
                    <td className={`py-2 pr-3 font-mono ${l.lap_time_ms === best ? "text-primary font-bold" : ""}`}>{formatLapTime(l.lap_time_ms)}</td>
                    <td className="py-2 pr-3 font-mono">{formatLapTime(l.sector_1_ms)}</td>
                    <td className="py-2 pr-3 font-mono">{formatLapTime(l.sector_2_ms)}</td>
                    <td className="py-2 pr-3 font-mono">{formatLapTime(l.sector_3_ms)}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{l.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {session.notes && (
          <div className="mt-6 rounded-lg border border-border bg-card p-5 whitespace-pre-wrap text-sm">{session.notes}</div>
        )}

        <div className="mt-10 text-center text-xs font-mono uppercase tracking-widest text-muted-foreground">
          MY RACE<span className="text-primary">ENGINEER</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">{icon} {label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}