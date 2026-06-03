import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Printer, FileText, Disc, ClipboardList, GitCompare, Timer, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

type Car = { id: string; name: string; make: string | null; model: string | null; year: number | null };
type Session = {
  id: string; car_id: string; name: string; session_type: string;
  track: string | null; driver: string | null; weather: string | null;
  air_temp_c: number | null; track_temp_c: number | null;
  fuel_start_l: number | null; fuel_end_l: number | null;
  started_at: string; notes: string | null; setup_id: string | null;
};
type Setup = {
  id: string; car_id: string; name: string; discipline: string;
  track: string | null; conditions: string | null;
  setup_data: Record<string, unknown>; notes: string | null; updated_at: string;
};
type Lap = {
  id: string; session_id: string | null; car_id: string; setup_id: string;
  lap_number: number | null; lap_time_ms: number;
  sector_1_ms: number | null; sector_2_ms: number | null; sector_3_ms: number | null;
  conditions: string | null; tire_set: string | null; fuel_load: number | null;
  notes: string | null; recorded_at: string;
};
type Tire = {
  id: string; car_id: string; session_id: string | null; tire_set: string; compound: string | null;
  heat_cycles: number | null;
  cold_fl: number | null; cold_fr: number | null; cold_rl: number | null; cold_rr: number | null;
  hot_fl: number | null; hot_fr: number | null; hot_rl: number | null; hot_rr: number | null;
  tread_fl: number | null; tread_fr: number | null; tread_rl: number | null; tread_rr: number | null;
  ambient_c: number | null; track_c: number | null; recorded_at: string; notes: string | null;
};
type Feedback = {
  id: string; car_id: string; session_id: string | null; setup_id: string | null;
  corner: string | null; category: string; phase: string | null;
  balance: string | null; severity: string; confidence: number | null;
  description: string; recommendation: string | null; tags: string[];
  recorded_at: string;
};

type ReportKind = "setup" | "tires" | "session" | "debrief" | "compare";

const REPORT_KINDS: { id: ReportKind; label: string; icon: typeof FileText; blurb: string }[] = [
  { id: "setup",   label: "Setup sheet",        icon: FileText,      blurb: "Single car setup, ready for the binder." },
  { id: "tires",   label: "Tyre report",        icon: Disc,          blurb: "Pressures, temps, tread, heat cycles." },
  { id: "session", label: "Session summary",    icon: Timer,         blurb: "Conditions, laps, stints, fuel." },
  { id: "debrief", label: "Driver debrief",     icon: ClipboardList, blurb: "Categorised feedback + actions." },
  { id: "compare", label: "Setup comparison",   icon: GitCompare,    blurb: "Two setups side-by-side." },
];

function fmtLap(ms: number | null | undefined) {
  if (ms == null) return "—";
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3);
  return `${m}:${s.padStart(6, "0")}`;
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtDay(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}
function num(v: unknown, d = 1) {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—";
}
function carLabel(c?: Car | null) {
  if (!c) return "—";
  const sub = [c.year, c.make, c.model].filter(Boolean).join(" ");
  return sub ? `${c.name} · ${sub}` : c.name;
}

/* ============ root component ============ */
function ReportsPage() {
  const { user } = useAuth();
  const [kind, setKind] = useState<ReportKind>("setup");
  const [carId, setCarId] = useState<string>("");
  const [setupId, setSetupId] = useState<string>("");
  const [setupBId, setSetupBId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");

  const carsQ = useQuery({
    queryKey: ["rpt-cars", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id,name,make,model,year").order("created_at");
      if (error) throw error;
      return data as Car[];
    },
    enabled: !!user,
  });

  const setupsQ = useQuery({
    queryKey: ["rpt-setups", carId],
    queryFn: async () => {
      let q = supabase.from("setups").select("id,car_id,name,discipline,track,conditions,setup_data,notes,updated_at").order("updated_at", { ascending: false });
      if (carId) q = q.eq("car_id", carId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Setup[];
    },
    enabled: !!user,
  });

  const sessionsQ = useQuery({
    queryKey: ["rpt-sessions", carId],
    queryFn: async () => {
      let q = supabase.from("sessions").select("id,car_id,name,session_type,track,driver,weather,air_temp_c,track_temp_c,fuel_start_l,fuel_end_l,started_at,notes,setup_id").order("started_at", { ascending: false });
      if (carId) q = q.eq("car_id", carId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Session[];
    },
    enabled: !!user,
  });

  const cars = carsQ.data ?? [];
  const setups = setupsQ.data ?? [];
  const sessions = sessionsQ.data ?? [];
  const car = cars.find((c) => c.id === carId) ?? null;
  const setup = setups.find((s) => s.id === setupId) ?? null;
  const setupB = setups.find((s) => s.id === setupBId) ?? null;
  const session = sessions.find((s) => s.id === sessionId) ?? null;

  const handlePrint = () => window.print();

  return (
    <div className="space-y-4">
      {/* ===== Toolbar (hidden in print) ===== */}
      <div className="no-print space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-mono uppercase tracking-widest">Engineering Reports</h1>
            <p className="text-xs text-muted-foreground font-mono">Printable documents for the pit garage binder. Export via Print → Save as PDF.</p>
          </div>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-mono uppercase tracking-widest hover:opacity-90"
          >
            <Printer className="w-4 h-4" /> Print / PDF
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {REPORT_KINDS.map((r) => {
            const Icon = r.icon;
            const active = kind === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setKind(r.id)}
                className={`text-left rounded-md border px-3 py-2 transition-colors ${active ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 bg-card"}`}
              >
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest">
                  <Icon className={`w-3.5 h-3.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={active ? "text-primary" : ""}>{r.label}</span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground leading-tight">{r.blurb}</p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Selector label="Car" value={carId} onChange={(v) => { setCarId(v); setSetupId(""); setSetupBId(""); setSessionId(""); }}
            options={[{ value: "", label: "All cars" }, ...cars.map((c) => ({ value: c.id, label: carLabel(c) }))]} />
          {(kind === "setup" || kind === "compare") && (
            <Selector label={kind === "compare" ? "Setup A" : "Setup"} value={setupId} onChange={setSetupId}
              options={[{ value: "", label: "—" }, ...setups.map((s) => ({ value: s.id, label: s.name }))]} />
          )}
          {kind === "compare" && (
            <Selector label="Setup B" value={setupBId} onChange={setSetupBId}
              options={[{ value: "", label: "—" }, ...setups.filter((s) => s.id !== setupId).map((s) => ({ value: s.id, label: s.name }))]} />
          )}
          {(kind === "tires" || kind === "session" || kind === "debrief") && (
            <Selector label="Session" value={sessionId} onChange={setSessionId}
              options={[{ value: "", label: kind === "session" ? "—" : "All sessions" }, ...sessions.map((s) => ({ value: s.id, label: `${s.name} · ${fmtDay(s.started_at)}` }))]} />
          )}
        </div>
      </div>

      {/* ===== The printable sheet ===== */}
      <article className="print-sheet bg-card border border-border rounded-md p-6 md:p-8 max-w-[210mm] mx-auto text-[12px] leading-snug">
        <ReportHeader kind={kind} car={car} setup={setup} setupB={setupB} session={session} />
        <div className="my-4 h-[2px] bg-foreground/80 print-accent" />

        {kind === "setup" && <SetupSheet car={car} setup={setup} />}
        {kind === "tires" && <TireReport car={car} session={session} />}
        {kind === "session" && <SessionSummary car={car} session={session} />}
        {kind === "debrief" && <DebriefReport car={car} session={session} />}
        {kind === "compare" && <CompareReport car={car} a={setup} b={setupB} />}

        <ReportFooter />
      </article>
    </div>
  );
}

/* ============ shared bits ============ */
function Selector({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-muted/30 border border-border rounded-md px-2 py-1.5 text-xs font-mono text-foreground min-w-[180px]"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function ReportHeader({ kind, car, setup, setupB, session }: {
  kind: ReportKind; car: Car | null; setup: Setup | null; setupB: Setup | null; session: Session | null;
}) {
  const title =
    kind === "setup" ? "Setup Sheet"
    : kind === "tires" ? "Tyre Report"
    : kind === "session" ? "Session Summary"
    : kind === "debrief" ? "Driver Debrief"
    : "Setup Comparison";
  const subtitle =
    kind === "setup"   ? setup?.name ?? "Select a setup"
    : kind === "compare" ? `${setup?.name ?? "—"}  vs  ${setupB?.name ?? "—"}`
    : kind === "tires" ? (session?.name ?? "All recent stints")
    : kind === "session" || kind === "debrief" ? (session?.name ?? "Select a session")
    : "";
  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">My Race Engineer · Engineering Doc</div>
        <h2 className="text-2xl font-mono uppercase tracking-widest">{title}</h2>
        <div className="text-sm font-mono mt-1">{subtitle}</div>
      </div>
      <div className="text-right text-[10px] font-mono uppercase tracking-widest text-muted-foreground space-y-0.5">
        <div>{new Date().toLocaleString()}</div>
        <div>Car: <span className="text-foreground">{carLabel(car)}</span></div>
        {session?.track && <div>Track: <span className="text-foreground">{session.track}</span></div>}
        {setup?.track && !session && <div>Track: <span className="text-foreground">{setup.track}</span></div>}
        {session?.driver && <div>Driver: <span className="text-foreground">{session.driver}</span></div>}
      </div>
    </header>
  );
}

function ReportFooter() {
  return (
    <footer className="mt-8 pt-3 border-t border-border flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
      <span>Confidential · Race team documentation</span>
      <span>Generated by My Race Engineer</span>
    </footer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="avoid-break mt-5">
      <h3 className="text-[11px] font-mono uppercase tracking-[0.25em] text-primary border-b border-border pb-1 mb-2">{title}</h3>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-border py-1">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{k}</span>
      <span className="text-[12px] font-mono tabular-nums text-foreground">{v}</span>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="py-12 text-center text-xs font-mono uppercase tracking-widest text-muted-foreground">{msg}</div>;
}

/* ============ Setup sheet ============ */
const SETUP_GROUPS: { title: string; keys: { k: string; label: string; unit?: string }[] }[] = [
  { title: "Tyre Pressures (cold)", keys: [
    { k: "press_fl", label: "FL", unit: "psi" }, { k: "press_fr", label: "FR", unit: "psi" },
    { k: "press_rl", label: "RL", unit: "psi" }, { k: "press_rr", label: "RR", unit: "psi" },
  ]},
  { title: "Ride Height", keys: [
    { k: "ride_fl", label: "FL", unit: "mm" }, { k: "ride_fr", label: "FR", unit: "mm" },
    { k: "ride_rl", label: "RL", unit: "mm" }, { k: "ride_rr", label: "RR", unit: "mm" },
  ]},
  { title: "Camber", keys: [
    { k: "camber_fl", label: "FL", unit: "°" }, { k: "camber_fr", label: "FR", unit: "°" },
    { k: "camber_rl", label: "RL", unit: "°" }, { k: "camber_rr", label: "RR", unit: "°" },
  ]},
  { title: "Toe", keys: [
    { k: "toe_fl", label: "FL", unit: "°" }, { k: "toe_fr", label: "FR", unit: "°" },
    { k: "toe_rl", label: "RL", unit: "°" }, { k: "toe_rr", label: "RR", unit: "°" },
  ]},
  { title: "Springs / ARB", keys: [
    { k: "spring_f", label: "Spring F", unit: "N/mm" }, { k: "spring_r", label: "Spring R", unit: "N/mm" },
    { k: "arb_f", label: "ARB F" }, { k: "arb_r", label: "ARB R" },
  ]},
  { title: "Dampers", keys: [
    { k: "bump_f", label: "Bump F" }, { k: "bump_r", label: "Bump R" },
    { k: "rebound_f", label: "Rebound F" }, { k: "rebound_r", label: "Rebound R" },
  ]},
  { title: "Aero", keys: [
    { k: "wing_f", label: "Front wing" }, { k: "wing_r", label: "Rear wing" },
    { k: "splitter", label: "Splitter" }, { k: "diffuser", label: "Diffuser" },
  ]},
  { title: "Brakes / Diff", keys: [
    { k: "brake_bias", label: "Brake bias", unit: "%" }, { k: "brake_pressure", label: "Brake pressure" },
    { k: "diff_power", label: "Diff power" }, { k: "diff_coast", label: "Diff coast" },
  ]},
];

function getVal(rec: Record<string, unknown> | undefined, key: string): string {
  if (!rec) return "—";
  const v = rec[key];
  if (v == null || v === "") return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

function SetupSheet({ car, setup }: { car: Car | null; setup: Setup | null }) {
  if (!setup) return <EmptyState msg="Pick a setup to render the sheet." />;
  const data = (setup.setup_data ?? {}) as Record<string, unknown>;
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
        <KV k="Setup" v={setup.name} />
        <KV k="Discipline" v={setup.discipline} />
        <KV k="Track" v={setup.track ?? "—"} />
        <KV k="Conditions" v={setup.conditions ?? "—"} />
        <KV k="Updated" v={fmtDate(setup.updated_at)} />
        <KV k="Car" v={car?.name ?? "—"} />
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        {SETUP_GROUPS.map((g) => (
          <div key={g.title} className="avoid-break">
            <h4 className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground border-b border-border pb-0.5 mb-1">{g.title}</h4>
            <table className="w-full text-[11px] font-mono tabular-nums">
              <tbody>
                {g.keys.map((row) => (
                  <tr key={row.k} className="border-b border-dashed border-border last:border-b-0">
                    <td className="py-1 text-muted-foreground uppercase text-[10px] tracking-widest w-[55%]">{row.label}</td>
                    <td className="py-1 text-right">{getVal(data, row.k)}{row.unit && data[row.k] != null ? ` ${row.unit}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {setup.notes && (
        <Section title="Engineer notes">
          <p className="whitespace-pre-wrap text-[11px]">{setup.notes}</p>
        </Section>
      )}

      <Section title="Sign-off">
        <div className="grid grid-cols-3 gap-6 mt-2">
          {["Engineer", "Driver", "Crew chief"].map((r) => (
            <div key={r} className="text-[10px] font-mono uppercase tracking-widest">
              <div className="border-b border-foreground h-8" />
              <div className="mt-1 text-muted-foreground">{r}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ============ Tyre report ============ */
function TireReport({ car, session }: { car: Car | null; session: Session | null }) {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["rpt-tires", car?.id, session?.id],
    queryFn: async () => {
      let q = supabase.from("tire_logs").select("*").order("recorded_at", { ascending: false }).limit(40);
      if (car?.id) q = q.eq("car_id", car.id);
      if (session?.id) q = q.eq("session_id", session.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Tire[];
    },
    enabled: !!user && !!car,
  });

  if (!car) return <EmptyState msg="Pick a car to render the tyre report." />;
  const logs = q.data ?? [];
  if (logs.length === 0) return <EmptyState msg="No tyre logs found for this selection." />;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
        <KV k="Car" v={carLabel(car)} />
        <KV k="Session" v={session?.name ?? "All recent"} />
        <KV k="Stints" v={logs.length} />
        <KV k="Generated" v={fmtDate(new Date().toISOString())} />
      </div>

      <Section title="Pressures & temps (per stint)">
        <table className="w-full text-[11px] font-mono tabular-nums border-collapse">
          <thead>
            <tr className="text-[9px] uppercase tracking-widest text-muted-foreground border-b border-foreground">
              <th className="text-left py-1 pr-2">Set</th>
              <th className="text-left py-1 pr-2">Compound</th>
              <th className="text-right py-1 px-1" colSpan={4}>Cold psi (FL FR RL RR)</th>
              <th className="text-right py-1 px-1" colSpan={4}>Hot psi (FL FR RL RR)</th>
              <th className="text-right py-1 pr-2">HC</th>
              <th className="text-right py-1 pl-2">Date</th>
            </tr>
          </thead>
          <tbody className="print-zebra">
            {logs.map((t) => (
              <tr key={t.id} className="border-b border-dashed border-border">
                <td className="py-1 pr-2">{t.tire_set}</td>
                <td className="py-1 pr-2">{t.compound ?? "—"}</td>
                <td className="text-right px-1">{num(t.cold_fl)}</td>
                <td className="text-right px-1">{num(t.cold_fr)}</td>
                <td className="text-right px-1">{num(t.cold_rl)}</td>
                <td className="text-right px-1">{num(t.cold_rr)}</td>
                <td className="text-right px-1">{num(t.hot_fl)}</td>
                <td className="text-right px-1">{num(t.hot_fr)}</td>
                <td className="text-right px-1">{num(t.hot_rl)}</td>
                <td className="text-right px-1">{num(t.hot_rr)}</td>
                <td className="text-right pr-2">{t.heat_cycles ?? 0}</td>
                <td className="text-right pl-2">{fmtDay(t.recorded_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Tread depth (mm)">
        <table className="w-full text-[11px] font-mono tabular-nums">
          <thead>
            <tr className="text-[9px] uppercase tracking-widest text-muted-foreground border-b border-foreground">
              <th className="text-left py-1">Set</th>
              <th className="text-right px-1">FL</th><th className="text-right px-1">FR</th>
              <th className="text-right px-1">RL</th><th className="text-right px-1">RR</th>
              <th className="text-right px-1">Amb °C</th><th className="text-right px-1">Trk °C</th>
              <th className="text-left pl-2">Notes</th>
            </tr>
          </thead>
          <tbody className="print-zebra">
            {logs.map((t) => (
              <tr key={t.id} className="border-b border-dashed border-border">
                <td className="py-1">{t.tire_set}</td>
                <td className="text-right px-1">{num(t.tread_fl, 1)}</td>
                <td className="text-right px-1">{num(t.tread_fr, 1)}</td>
                <td className="text-right px-1">{num(t.tread_rl, 1)}</td>
                <td className="text-right px-1">{num(t.tread_rr, 1)}</td>
                <td className="text-right px-1">{num(t.ambient_c, 0)}</td>
                <td className="text-right px-1">{num(t.track_c, 0)}</td>
                <td className="pl-2 text-[10px] text-muted-foreground truncate max-w-[200px]">{t.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

/* ============ Session summary ============ */
function SessionSummary({ car, session }: { car: Car | null; session: Session | null }) {
  const { user } = useAuth();
  const lapsQ = useQuery({
    queryKey: ["rpt-laps", session?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("laps").select("*").eq("session_id", session!.id).order("lap_number", { ascending: true });
      if (error) throw error;
      return data as Lap[];
    },
    enabled: !!user && !!session,
  });

  if (!session) return <EmptyState msg="Pick a session to render the summary." />;
  const laps = lapsQ.data ?? [];
  const valid = laps.filter((l) => l.lap_time_ms > 0);
  const best = valid.length ? Math.min(...valid.map((l) => l.lap_time_ms)) : null;
  const avg = valid.length ? Math.round(valid.reduce((s, l) => s + l.lap_time_ms, 0) / valid.length) : null;
  const fuelUsed = session.fuel_start_l != null && session.fuel_end_l != null
    ? Math.max(0, session.fuel_start_l - session.fuel_end_l) : null;
  const fuelPerLap = fuelUsed != null && valid.length ? fuelUsed / valid.length : null;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
        <KV k="Session" v={session.name} />
        <KV k="Type" v={session.session_type} />
        <KV k="Track" v={session.track ?? "—"} />
        <KV k="Driver" v={session.driver ?? "—"} />
        <KV k="Weather" v={session.weather ?? "—"} />
        <KV k="Air °C" v={num(session.air_temp_c, 1)} />
        <KV k="Track °C" v={num(session.track_temp_c, 1)} />
        <KV k="Started" v={fmtDate(session.started_at)} />
      </div>

      <Section title="Performance">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
          <KV k="Laps" v={valid.length} />
          <KV k="Best lap" v={fmtLap(best)} />
          <KV k="Avg lap" v={fmtLap(avg)} />
          <KV k="Fuel used" v={fuelUsed != null ? `${fuelUsed.toFixed(1)} L` : "—"} />
          <KV k="L / lap" v={fuelPerLap != null ? fuelPerLap.toFixed(2) : "—"} />
          <KV k="Fuel start" v={session.fuel_start_l != null ? `${session.fuel_start_l} L` : "—"} />
          <KV k="Fuel end" v={session.fuel_end_l != null ? `${session.fuel_end_l} L` : "—"} />
          <KV k="Car" v={carLabel(car)} />
        </div>
      </Section>

      <Section title="Lap chart">
        {valid.length === 0 ? <EmptyState msg="No lap data recorded." /> : (
          <table className="w-full text-[11px] font-mono tabular-nums">
            <thead>
              <tr className="text-[9px] uppercase tracking-widest text-muted-foreground border-b border-foreground">
                <th className="text-left py-1 pr-2">Lap</th>
                <th className="text-right px-1">Time</th>
                <th className="text-right px-1">S1</th>
                <th className="text-right px-1">S2</th>
                <th className="text-right px-1">S3</th>
                <th className="text-right px-1">Δ best</th>
                <th className="text-left pl-2">Tyres</th>
                <th className="text-right pl-2">Fuel</th>
                <th className="text-left pl-2">Notes</th>
              </tr>
            </thead>
            <tbody className="print-zebra">
              {valid.map((l) => (
                <tr key={l.id} className={`border-b border-dashed border-border ${l.lap_time_ms === best ? "font-bold" : ""}`}>
                  <td className="py-1 pr-2">{l.lap_number ?? "—"}</td>
                  <td className="text-right px-1">{fmtLap(l.lap_time_ms)}</td>
                  <td className="text-right px-1">{fmtLap(l.sector_1_ms)}</td>
                  <td className="text-right px-1">{fmtLap(l.sector_2_ms)}</td>
                  <td className="text-right px-1">{fmtLap(l.sector_3_ms)}</td>
                  <td className="text-right px-1">{best && l.lap_time_ms !== best ? `+${((l.lap_time_ms - best) / 1000).toFixed(3)}` : "—"}</td>
                  <td className="pl-2 text-[10px]">{l.tire_set ?? "—"}</td>
                  <td className="text-right pl-2">{l.fuel_load != null ? `${l.fuel_load}` : "—"}</td>
                  <td className="pl-2 text-[10px] text-muted-foreground truncate max-w-[180px]">{l.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {session.notes && (
        <Section title="Session notes">
          <p className="whitespace-pre-wrap text-[11px]">{session.notes}</p>
        </Section>
      )}
    </div>
  );
}

/* ============ Debrief report ============ */
function DebriefReport({ car, session }: { car: Car | null; session: Session | null }) {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["rpt-feedback", car?.id, session?.id],
    queryFn: async () => {
      let q = supabase.from("driver_feedback").select("*").order("recorded_at", { ascending: false }).limit(80);
      if (car?.id) q = q.eq("car_id", car.id);
      if (session?.id) q = q.eq("session_id", session.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Feedback[];
    },
    enabled: !!user && !!car,
  });

  if (!car) return <EmptyState msg="Pick a car to render the debrief." />;
  const items = q.data ?? [];
  if (items.length === 0) return <EmptyState msg="No driver feedback found." />;

  const byCategory = items.reduce<Record<string, number>>((acc, f) => {
    acc[f.category] = (acc[f.category] ?? 0) + 1; return acc;
  }, {});
  const balances = items.reduce<Record<string, number>>((acc, f) => {
    if (f.balance) acc[f.balance] = (acc[f.balance] ?? 0) + 1; return acc;
  }, {});
  const avgConf = items.filter((f) => f.confidence != null).reduce((s, f, _i, a) => s + (f.confidence ?? 0) / a.length, 0);

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
        <KV k="Car" v={carLabel(car)} />
        <KV k="Session" v={session?.name ?? "All recent"} />
        <KV k="Entries" v={items.length} />
        <KV k="Avg confidence" v={avgConf ? avgConf.toFixed(1) : "—"} />
      </div>

      <Section title="Distribution">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">By category</div>
            <table className="w-full text-[11px] font-mono">
              <tbody>
                {Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).map(([k,v]) => (
                  <tr key={k} className="border-b border-dashed border-border">
                    <td className="py-1 uppercase text-[10px] tracking-widest">{k}</td>
                    <td className="text-right py-1 tabular-nums">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">By balance</div>
            <table className="w-full text-[11px] font-mono">
              <tbody>
                {Object.entries(balances).sort((a,b)=>b[1]-a[1]).map(([k,v]) => (
                  <tr key={k} className="border-b border-dashed border-border">
                    <td className="py-1 uppercase text-[10px] tracking-widest">{k}</td>
                    <td className="text-right py-1 tabular-nums">{v}</td>
                  </tr>
                ))}
                {Object.keys(balances).length === 0 && <tr><td className="py-1 text-muted-foreground">—</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section title="Feedback log">
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="text-[9px] uppercase tracking-widest text-muted-foreground border-b border-foreground">
              <th className="text-left py-1 pr-2">When</th>
              <th className="text-left pr-2">Cat</th>
              <th className="text-left pr-2">Corner</th>
              <th className="text-left pr-2">Phase</th>
              <th className="text-left pr-2">Balance</th>
              <th className="text-left pr-2">Sev</th>
              <th className="text-right pr-2">Conf</th>
              <th className="text-left">Description / recommendation</th>
            </tr>
          </thead>
          <tbody className="print-zebra">
            {items.map((f) => (
              <tr key={f.id} className="border-b border-dashed border-border align-top">
                <td className="py-1 pr-2 text-[10px] text-muted-foreground whitespace-nowrap">{fmtDay(f.recorded_at)}</td>
                <td className="pr-2 uppercase text-[10px] tracking-widest">{f.category}</td>
                <td className="pr-2">{f.corner ?? "—"}</td>
                <td className="pr-2">{f.phase ?? "—"}</td>
                <td className="pr-2">{f.balance ?? "—"}</td>
                <td className="pr-2 uppercase text-[10px] tracking-widest">{f.severity}</td>
                <td className="text-right pr-2 tabular-nums">{f.confidence ?? "—"}</td>
                <td className="text-[11px]">
                  <div>{f.description}</div>
                  {f.recommendation && <div className="text-muted-foreground mt-0.5">→ {f.recommendation}</div>}
                  {f.tags?.length > 0 && (
                    <div className="mt-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">{f.tags.join(" · ")}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

/* ============ Compare ============ */
function CompareReport({ car, a, b }: { car: Car | null; a: Setup | null; b: Setup | null }) {
  if (!a || !b) return <EmptyState msg="Pick two setups to compare." />;
  const da = (a.setup_data ?? {}) as Record<string, unknown>;
  const db = (b.setup_data ?? {}) as Record<string, unknown>;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
        <KV k="Car" v={carLabel(car)} />
        <KV k="Setup A" v={a.name} />
        <KV k="Setup B" v={b.name} />
        <KV k="Updated" v={`${fmtDay(a.updated_at)} / ${fmtDay(b.updated_at)}`} />
      </div>

      {SETUP_GROUPS.map((g) => (
        <Section key={g.title} title={g.title}>
          <table className="w-full text-[11px] font-mono tabular-nums">
            <thead>
              <tr className="text-[9px] uppercase tracking-widest text-muted-foreground border-b border-foreground">
                <th className="text-left py-1">Parameter</th>
                <th className="text-right px-2">A · {a.name}</th>
                <th className="text-right px-2">B · {b.name}</th>
                <th className="text-right px-2">Δ</th>
              </tr>
            </thead>
            <tbody className="print-zebra">
              {g.keys.map((row) => {
                const va = da[row.k]; const vb = db[row.k];
                const numA = typeof va === "number" ? va : (typeof va === "string" && va !== "" && !isNaN(+va) ? +va : null);
                const numB = typeof vb === "number" ? vb : (typeof vb === "string" && vb !== "" && !isNaN(+vb) ? +vb : null);
                const delta = numA != null && numB != null ? numB - numA : null;
                const diff = numA !== numB;
                return (
                  <tr key={row.k} className={`border-b border-dashed border-border ${diff ? "" : "text-muted-foreground"}`}>
                    <td className="py-1 uppercase text-[10px] tracking-widest">{row.label}{row.unit ? ` (${row.unit})` : ""}</td>
                    <td className="text-right px-2">{getVal(da, row.k)}</td>
                    <td className="text-right px-2">{getVal(db, row.k)}</td>
                    <td className="text-right px-2">{delta != null ? (delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)) : (diff ? "≠" : "—")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      ))}

      {(a.notes || b.notes) && (
        <Section title="Engineer notes">
          <div className="grid grid-cols-2 gap-6 text-[11px]">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">A · {a.name}</div>
              <p className="whitespace-pre-wrap">{a.notes ?? "—"}</p>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">B · {b.name}</div>
              <p className="whitespace-pre-wrap">{b.notes ?? "—"}</p>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

// hint for unused import linter (Download used in toolbar future)
void Download;