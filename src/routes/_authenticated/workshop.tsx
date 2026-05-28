import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Wrench, AlertTriangle, Package, Disc, ChevronRight, Activity, Flame, CheckCircle2, Gauge } from "lucide-react";

export const Route = createFileRoute("/_authenticated/workshop")({ component: WorkshopPage });

type Car = { id: string; name: string };
type Item = {
  id: string; car_id: string; component: string; unit: string;
  current_value: number; service_interval: number | null;
  last_service_value: number | null; warn_threshold: number | null; priority: string;
};
type Damage = { id: string; car_id: string; component: string; severity: string; status: string; occurred_at: string };
type Part = { id: string; name: string; quantity: number; min_quantity: number; location: string | null };
type TireLog = { id: string; tire_set: string; heat_cycles: number | null; recorded_at: string };

const SEV_STYLES: Record<string, string> = {
  minor: "text-muted-foreground",
  moderate: "text-accent",
  major: "text-primary",
  critical: "text-destructive",
};

function WorkshopPage() {
  const { user } = useAuth();

  const carsQ = useQuery({
    queryKey: ["cars-min", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id, name").order("created_at");
      if (error) throw error;
      return data as Car[];
    }, enabled: !!user,
  });

  const itemsQ = useQuery({
    queryKey: ["maintenance", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("maintenance_items").select("id,car_id,component,unit,current_value,service_interval,last_service_value,warn_threshold,priority");
      if (error) throw error;
      return data as Item[];
    }, enabled: !!user,
  });

  const damageQ = useQuery({
    queryKey: ["damage", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("damage_reports").select("id,car_id,component,severity,status,occurred_at").order("occurred_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data as Damage[];
    }, enabled: !!user,
  });

  const partsQ = useQuery({
    queryKey: ["parts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("parts_inventory").select("id,name,quantity,min_quantity,location");
      if (error) throw error;
      return data as Part[];
    }, enabled: !!user,
  });

  const tiresQ = useQuery({
    queryKey: ["tire-logs-min", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tire_logs").select("id,tire_set,heat_cycles,recorded_at").order("recorded_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as TireLog[];
    }, enabled: !!user,
  });

  const carName = (id: string) => carsQ.data?.find((c) => c.id === id)?.name ?? "—";

  // Service reminders: classify each item
  const reminders = (itemsQ.data ?? []).map((it) => {
    const used = it.current_value - (it.last_service_value ?? 0);
    const interval = it.service_interval ?? 0;
    const remaining = interval > 0 ? interval - used : null;
    const pct = interval > 0 ? Math.max(0, Math.min(1, used / interval)) : 0;
    const warn = interval > 0 && remaining != null && remaining / interval <= (it.warn_threshold ?? 0.2);
    const overdue = interval > 0 && remaining != null && remaining <= 0;
    return { ...it, used, interval, remaining, pct, warn, overdue };
  });
  const dueSoon = reminders.filter((r) => r.warn || r.overdue).sort((a, b) => Number(b.overdue) - Number(a.overdue));
  const lowStock = (partsQ.data ?? []).filter((p) => p.quantity <= p.min_quantity);
  const openDamage = (damageQ.data ?? []).filter((d) => d.status !== "resolved");
  const criticalDamage = openDamage.filter((d) => d.severity === "critical");

  // Tyre set heat-cycle rollup
  const tyreSets = new Map<string, { cycles: number; last: string }>();
  for (const t of tiresQ.data ?? []) {
    const cur = tyreSets.get(t.tire_set);
    const cycles = Math.max(t.heat_cycles ?? 0, cur?.cycles ?? 0);
    if (!cur) tyreSets.set(t.tire_set, { cycles, last: t.recorded_at });
    else tyreSets.set(t.tire_set, { cycles, last: cur.last });
  }
  const tyreSetList = Array.from(tyreSets.entries()).slice(0, 6);

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1"><Wrench className="w-3 h-3" /> Workshop</div>
          <h1 className="font-display text-3xl font-bold mt-1">Workshop</h1>
          <p className="text-sm text-muted-foreground mt-1">Service reminders, damage log, parts inventory.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        <Tile to="/maintenance" icon={<Wrench className="w-4 h-4" />} label="Service" value={`${dueSoon.length}`} sub="due / overdue" highlight={dueSoon.some((r) => r.overdue)} />
        <Tile to="/damage" icon={<AlertTriangle className="w-4 h-4" />} label="Damage" value={`${openDamage.length}`} sub={`${criticalDamage.length} critical`} highlight={criticalDamage.length > 0} />
        <Tile to="/inventory" icon={<Package className="w-4 h-4" />} label="Inventory" value={`${lowStock.length}`} sub="below min" highlight={lowStock.length > 0} />
        <Tile to="/tires" icon={<Disc className="w-4 h-4" />} label="Tyre sets" value={`${tyreSets.size}`} sub="tracked" />
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-4">
        {/* Service reminders */}
        <Panel title="Service reminders" icon={<Activity className="w-3 h-3" />} to="/maintenance" linkLabel="All items">
          {dueSoon.length === 0 && <Empty text="Nothing due. All systems green." icon={<CheckCircle2 className="w-5 h-5 text-accent" />} />}
          <ul className="divide-y divide-border">
            {dueSoon.slice(0, 8).map((r) => (
              <li key={r.id} className="py-2 flex items-center gap-3">
                <div className={"w-1 h-10 rounded-sm " + (r.overdue ? "bg-destructive" : "bg-primary")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-display font-bold text-sm truncate">{r.component}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{carName(r.car_id)}</div>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground tabular-nums">
                    {r.overdue ? <span className="text-destructive">OVERDUE</span> : <span className="text-primary">DUE SOON</span>}
                    {" · "}
                    {r.remaining != null ? `${r.remaining.toFixed(1)} ${r.unit} left` : `${r.used.toFixed(1)} ${r.unit} used`}
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div className={"h-full " + (r.overdue ? "bg-destructive" : "bg-primary")} style={{ width: `${r.pct * 100}%` }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Damage log */}
        <Panel title="Damage &amp; issues" icon={<AlertTriangle className="w-3 h-3" />} to="/damage" linkLabel="All reports">
          {openDamage.length === 0 && <Empty text="No open damage reports." icon={<CheckCircle2 className="w-5 h-5 text-accent" />} />}
          <ul className="divide-y divide-border">
            {openDamage.slice(0, 8).map((d) => (
              <li key={d.id} className="py-2 flex items-center gap-3">
                <Flame className={"w-4 h-4 " + SEV_STYLES[d.severity]} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-display font-bold text-sm truncate">{d.component}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{carName(d.car_id)}</div>
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span className={SEV_STYLES[d.severity]}>{d.severity}</span> · {d.status.replace("_", " ")} · {new Date(d.occurred_at).toLocaleDateString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Low stock */}
        <Panel title="Inventory alerts" icon={<Package className="w-3 h-3" />} to="/inventory" linkLabel="All parts">
          {lowStock.length === 0 && <Empty text="All parts above minimum." icon={<CheckCircle2 className="w-5 h-5 text-accent" />} />}
          <ul className="divide-y divide-border">
            {lowStock.slice(0, 8).map((p) => (
              <li key={p.id} className="py-2 flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-display font-bold text-sm truncate">{p.name}</div>
                    <div className="font-mono text-xs tabular-nums"><span className="text-destructive font-bold">{p.quantity}</span><span className="text-muted-foreground"> / min {p.min_quantity}</span></div>
                  </div>
                  {p.location && <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{p.location}</div>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Tyre sets */}
        <Panel title="Tyre inventory" icon={<Disc className="w-3 h-3" />} to="/tires" linkLabel="All sets">
          {tyreSetList.length === 0 && <Empty text="No tyre logs yet." icon={<Gauge className="w-5 h-5 text-muted-foreground" />} />}
          <ul className="divide-y divide-border">
            {tyreSetList.map(([name, info]) => (
              <li key={name} className="py-2 flex items-center justify-between gap-3">
                <div className="font-display font-bold text-sm">{name}</div>
                <div className="font-mono text-xs text-muted-foreground tabular-nums">{info.cycles} cycles · {new Date(info.last).toLocaleDateString()}</div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Tile({ to, icon, label, value, sub, highlight }: { to: string; icon: React.ReactNode; label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <Link to={to} className={"block rounded-md border p-3 transition-colors " + (highlight ? "border-destructive/60 bg-destructive/5 hover:border-destructive" : "border-border bg-card hover:border-primary/50")}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1">{icon}{label}</div>
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
      </div>
      <div className={"font-mono text-2xl font-bold tabular-nums mt-1 " + (highlight ? "text-destructive" : "")}>{value}</div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{sub}</div>
    </Link>
  );
}

function Panel({ title, icon, to, linkLabel, children }: { title: string; icon: React.ReactNode; to: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between px-3 h-9 border-b border-border">
        <div className="text-[10px] font-mono uppercase tracking-widest text-primary flex items-center gap-1">{icon}<span dangerouslySetInnerHTML={{ __html: title }} /></div>
        <Link to={to} className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center gap-1">{linkLabel} <ChevronRight className="w-3 h-3" /></Link>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

function Empty({ text, icon }: { text: string; icon: React.ReactNode }) {
  return <div className="py-6 flex flex-col items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">{icon}{text}</div>;
}