import { Car, CalendarDays, Gauge, Wrench, MessageSquare, Timer } from "lucide-react";
import demoCarAsset from "@/assets/demo-car-88.png.asset.json";

const tyres = [
  { corner: "Front left", cold: 22.0, hot: 26.5 },
  { corner: "Front right", cold: 22.0, hot: 26.8 },
  { corner: "Rear left", cold: 21.5, hot: 25.9 },
  { corner: "Rear right", cold: 21.5, hot: 26.1 },
] as const;

const sessions = [
  {
    name: "FP1 · Sat 09:40",
    laps: ["1:12.84", "1:12.31", "1:11.97"],
    best: "1:11.97",
  },
  {
    name: "FP2 · Sat 11:20",
    laps: ["1:11.65", "1:11.42", "1:11.58"],
    best: "1:11.42",
  },
] as const;

/** Static illustrative preview of recorded app data. No predictions, no account reads. */
export function LandingProductPreview() {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card text-card-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 font-display font-bold">
            <CalendarDays className="size-5 text-primary" /> Round 3 Sprint Weekend
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Illustrative demo data · not customer results
          </p>
        </div>
        <p className="font-mono text-xs text-muted-foreground">Lakeside Park · Sat–Sun</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.1fr_1fr]">
        <div className="min-w-0 border-b border-border p-5 lg:border-b-0 lg:border-r">
          <p className="font-mono text-xs text-muted-foreground">CAR #88 · TIME ATTACK</p>
          <img
            src={demoCarAsset.url}
            alt="Blue My Race Engineer number 88 time attack car, shown from front and rear"
            className="mt-4 aspect-[3/2] w-full rounded-sm object-contain"
            loading="lazy"
          />
          <dl className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Baseline</dt>
              <dd className="font-medium">Baseline v2 · saved before FP1</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Next session</dt>
              <dd className="font-medium">FP2 · Sat 11:20</dd>
            </div>
          </dl>
        </div>

        <div className="min-w-0 border-b border-border p-5 lg:border-b-0 lg:border-r">
          <h4 className="flex items-center gap-2 font-display text-base">
            <Gauge className="size-4 text-primary" /> Tyre pressures (PSI)
          </h4>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Corner</th>
                <th className="pb-2 font-medium text-right">Cold</th>
                <th className="pb-2 font-medium text-right">Hot</th>
              </tr>
            </thead>
            <tbody>
              {tyres.map((tyre) => (
                <tr key={tyre.corner} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5">{tyre.corner}</td>
                  <td className="py-2.5 text-right font-mono">{tyre.cold.toFixed(1)}</td>
                  <td className="py-2.5 text-right font-mono font-semibold text-primary">
                    {tyre.hot.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-5 border-t border-border pt-4">
            <h4 className="flex items-center gap-2 font-display text-base">
              <Wrench className="size-4 text-primary" /> Logged setup change
            </h4>
            <p className="mt-3 text-sm leading-relaxed">
              Front anti-roll bar <span className="font-mono">3 → 2</span> (softer) — between FP1
              and FP2
            </p>
          </div>
        </div>

        <div className="min-w-0 p-5">
          <h4 className="flex items-center gap-2 font-display text-base">
            <MessageSquare className="size-4 text-primary" /> Driver feedback
          </h4>
          <p className="mt-3 border-l-2 border-accent pl-3 text-sm leading-relaxed">
            “Better rotation on turn-in. Rear still nervous under braking into Turn 3.”
          </p>
          <div className="mt-5 border-t border-border pt-4">
            <h4 className="flex items-center gap-2 font-display text-base">
              <Timer className="size-4 text-primary" /> Recorded lap times
            </h4>
            <div className="mt-3 space-y-4">
              {sessions.map((session) => (
                <div key={session.name}>
                  <p className="text-xs text-muted-foreground">{session.name}</p>
                  <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm">
                    {session.laps.map((lap) => (
                      <li
                        key={lap}
                        className={lap === session.best ? "font-semibold text-primary" : undefined}
                      >
                        {lap}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="border-t border-border bg-muted px-5 py-4 text-xs leading-relaxed text-muted-foreground">
        Sample content shown for illustration only. My Race Engineer records what you log — it does
        not predict tyre pressures, handling or lap times.
      </p>
    </div>
  );
}
