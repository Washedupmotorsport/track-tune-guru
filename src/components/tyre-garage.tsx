import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useActiveWeekend } from "@/lib/active-weekend";
import { sessionLogContext } from "@/lib/race-day-rules";
import {
  analyzeTyreReading,
  rotationPreset,
  setTotals,
  CORNERS,
  type Corner,
  type TyreReading,
} from "@/lib/tyre-analysis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Disc,
  Gauge,
  Info,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { hotPressureValues } from "@/lib/hot-pressure-entry";

type Car = { id: string; name: string };
type TyreSet = {
  id: string;
  car_id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  compound: string | null;
  size: string | null;
  serial_no: string | null;
  notes: string | null;
  created_at: string;
};
type Assignment = {
  id: string;
  car_id: string;
  tyre_set_id: string;
  tyre_slot: number;
  position: Corner;
  fitted_at: string;
  removed_at: string | null;
};
type SetLog = {
  id: string;
  tyre_set_id: string | null;
  recorded_at: string;
  cold_fl: number | null;
  cold_fr: number | null;
  cold_rl: number | null;
  cold_rr: number | null;
  hot_fl: number | null;
  hot_fr: number | null;
  hot_rl: number | null;
  hot_rr: number | null;
  tread_fl: number | null;
  tread_fr: number | null;
  tread_rl: number | null;
  tread_rr: number | null;
  temp_fl_inner: number | null;
  temp_fl_mid: number | null;
  temp_fl_outer: number | null;
  temp_fr_inner: number | null;
  temp_fr_mid: number | null;
  temp_fr_outer: number | null;
  temp_rl_inner: number | null;
  temp_rl_mid: number | null;
  temp_rl_outer: number | null;
  temp_rr_inner: number | null;
  temp_rr_mid: number | null;
  temp_rr_outer: number | null;
  laps: number | null;
  distance_km: number | null;
  heat_cycles: number | null;
};

const cornerName: Record<Corner, string> = {
  fl: "Front left",
  fr: "Front right",
  rl: "Rear left",
  rr: "Rear right",
};

function logToReading(l: SetLog): TyreReading {
  return {
    cold: { fl: l.cold_fl, fr: l.cold_fr, rl: l.cold_rl, rr: l.cold_rr },
    hot: { fl: l.hot_fl, fr: l.hot_fr, rl: l.hot_rl, rr: l.hot_rr },
    tread: { fl: l.tread_fl, fr: l.tread_fr, rl: l.tread_rl, rr: l.tread_rr },
    temps: {
      fl: { inner: l.temp_fl_inner, mid: l.temp_fl_mid, outer: l.temp_fl_outer },
      fr: { inner: l.temp_fr_inner, mid: l.temp_fr_mid, outer: l.temp_fr_outer },
      rl: { inner: l.temp_rl_inner, mid: l.temp_rl_mid, outer: l.temp_rl_outer },
      rr: { inner: l.temp_rr_inner, mid: l.temp_rr_mid, outer: l.temp_rr_outer },
    },
  };
}

export function TyreGarage({
  sessionId,
  onHotSaved,
}: { sessionId?: string; onHotSaved?: () => void } = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { activeWeekend, activeCar, activeSession } = useActiveWeekend();
  const [createOpen, setCreateOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(!!sessionId);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    manufacturer: "",
    model: "",
    compound: "",
    size: "",
    serial_no: "",
    car_id: "",
  });
  const [quick, setQuick] = useState({ fl: "", fr: "", rl: "", rr: "", laps: "" });
  const [quickSetId, setQuickSetId] = useState("");

  const sessionQ = useQuery({
    queryKey: ["hot-pressure-session", sessionId],
    enabled: !!sessionId,
    retry: false,
    queryFn: async () => {
      const { data: session, error } = await supabase
        .from("sessions")
        .select("id, name, car_id")
        .eq("id", sessionId ?? "")
        .single();
      if (error) throw error;
      const { data: car, error: carError } = await supabase
        .from("cars")
        .select("id, name")
        .eq("id", session.car_id)
        .single();
      if (carError) throw carError;
      return { ...session, carName: car.name };
    },
  });
  const carId = sessionId ? (sessionQ.data?.car_id ?? "") : (activeCar?.id ?? "");
  useEffect(() => {
    setQuickSetId("");
    setQuickOpen(!!sessionId);
    setRotateOpen(false);
    setQuick({ fl: "", fr: "", rl: "", rr: "", laps: "" });
  }, [carId, activeSession?.id, sessionId]);

  const carsQ = useQuery({
    queryKey: ["cars-min", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cars").select("id, name").order("created_at");
      if (error) throw error;
      return data as Car[];
    },
    enabled: !!user,
  });

  const setsQ = useQuery({
    queryKey: ["tyre_sets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tyre_sets").select("*").order("created_at");
      if (error) throw error;
      return data as TyreSet[];
    },
    enabled: !!user,
  });

  const assignmentsQ = useQuery({
    queryKey: ["tyre_assignments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tyre_assignments")
        .select("*")
        .is("removed_at", null);
      if (error) throw error;
      return data as Assignment[];
    },
    enabled: !!user,
  });

  const setLogsQ = useQuery({
    queryKey: ["tire_logs_by_set", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tire_logs")
        .select("*")
        .not("tyre_set_id", "is", null)
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return data as SetLog[];
    },
    enabled: !!user,
  });

  const carSets = useMemo(
    () => (setsQ.data ?? []).filter((s) => !carId || s.car_id === carId),
    [setsQ.data, carId],
  );
  const carAssignments = useMemo(
    () => (assignmentsQ.data ?? []).filter((a) => !carId || a.car_id === carId),
    [assignmentsQ.data, carId],
  );
  const slotAt = useMemo(() => {
    const map: Partial<Record<Corner, { set: TyreSet; slot: number }>> = {};
    for (const a of carAssignments) {
      const set = (setsQ.data ?? []).find((s) => s.id === a.tyre_set_id);
      if (set) map[a.position] = { set, slot: a.tyre_slot };
    }
    return map;
  }, [carAssignments, setsQ.data]);

  const fittedSetId = carAssignments[0]?.tyre_set_id ?? null;
  const effectiveQuickSet =
    (carSets.some((set) => set.id === quickSetId) ? quickSetId : "") ||
    fittedSetId ||
    carSets[0]?.id ||
    "";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tyre_sets"] });
    qc.invalidateQueries({ queryKey: ["tyre_assignments"] });
    qc.invalidateQueries({ queryKey: ["tire_logs_by_set"] });
    qc.invalidateQueries({ queryKey: ["tire_logs"] });
  };

  const createSet = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      const targetCar = form.car_id || carId;
      if (!targetCar) throw new Error("Pick a car");
      if (!form.name.trim()) throw new Error("Set name required");
      const { error } = await supabase.from("tyre_sets").insert({
        user_id: user.id,
        car_id: targetCar,
        name: form.name.trim(),
        manufacturer: form.manufacturer || null,
        model: form.model || null,
        compound: form.compound || null,
        size: form.size || null,
        serial_no: form.serial_no || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tyre set registered");
      setCreateOpen(false);
      setForm({
        name: "",
        manufacturer: "",
        model: "",
        compound: "",
        size: "",
        serial_no: "",
        car_id: "",
      });
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteSet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tyre_sets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Set removed");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Fit a set to the car: close current assignments, put slots 1-4 on FL/FR/RL/RR.
  const fitSet = useMutation({
    mutationFn: async (setId: string) => {
      if (!user || !carId) throw new Error("Pick an active weekend with a car");
      const set = (setsQ.data ?? []).find((s) => s.id === setId);
      if (!set) throw new Error("Set not found");
      const open = (assignmentsQ.data ?? []).filter((a) => a.car_id === carId);
      const { error } = await supabase.rpc("replace_tyre_layout", {
        p_car_id: carId,
        p_set_id: setId,
        p_slots: [1, 2, 3, 4],
        p_expected_ids: open.map((a) => a.id),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Set fitted to car");
      invalidate();
    },
    onError: (e) => {
      invalidate();
      toast.error(e instanceof Error ? e.message : "Failed");
    },
  });

  // Rotate: move slots between positions, closing and reopening assignments so history is preserved.
  const rotate = useMutation({
    mutationFn: async (preset: "front-to-rear" | "cross" | "rear-to-front") => {
      if (!user || !carId) throw new Error("Pick an active weekend with a car");
      const open = (assignmentsQ.data ?? []).filter((a) => a.car_id === carId);
      if (open.length < 4) throw new Error("Fit a full set first");
      const current: Partial<Record<Corner, number>> = {};
      for (const a of open) current[a.position] = a.tyre_slot;
      const next = rotationPreset(current, preset);
      const setId = open[0]?.tyre_set_id;
      if (!setId || open.some((a) => a.tyre_set_id !== setId))
        throw new Error("Fit a single complete set before rotating");
      const slots = CORNERS.map((pos) => next[pos]);
      if (slots.some((slot) => slot == null)) throw new Error("Fit all four tyre positions first");
      const { error } = await supabase.rpc("replace_tyre_layout", {
        p_car_id: carId,
        p_set_id: setId,
        p_slots: slots.filter((slot): slot is number => slot != null),
        p_expected_ids: open.map((a) => a.id),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tyres rotated — history preserved");
      setRotateOpen(false);
      invalidate();
    },
    onError: (e) => {
      invalidate();
      toast.error(e instanceof Error ? e.message : "Failed");
    },
  });

  // Quick hot-pressure entry: four taps + save, linked to the active session and set.
  const quickSave = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      if (sessionId) {
        // Never fall back to global active context for a Session Detail shortcut.
        const { data: context } = await sessionQ.refetch({ throwOnError: true });
        if (!context || context.id !== sessionId || context.car_id !== carId)
          throw new Error("The correct session could not be loaded. Please retry.");
        const pressures = hotPressureValues(quick);
        const { data: previous, error: readError } = await supabase
          .from("tire_logs")
          .select("id")
          .eq("session_id", context.id)
          .eq("car_id", context.car_id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (readError) throw readError;
        const result = previous
          ? await supabase
              .from("tire_logs")
              .update(pressures)
              .eq("id", previous.id)
              .eq("session_id", context.id)
              .eq("car_id", context.car_id)
              .select("id")
              .single()
          : await supabase
              .from("tire_logs")
              .insert({
                user_id: user.id,
                car_id: context.car_id,
                session_id: context.id,
                tyre_set_id: effectiveQuickSet || null,
                tire_set:
                  carSets.find((s) => s.id === effectiveQuickSet)?.name ?? "Session pressures",
                ...pressures,
              })
              .select("id")
              .single();
        if (result.error) throw result.error;
        return;
      }
      if (!carId) throw new Error("Pick an active weekend with a car");
      if (!carSets.some((set) => set.id === effectiveQuickSet && set.car_id === carId))
        throw new Error("Pick a tyre set belonging to this car");
      const num = (s: string) => (s ? Number(s) : null);
      const { error } = await supabase.from("tire_logs").insert({
        user_id: user.id,
        car_id: carId,
        tyre_set_id: effectiveQuickSet,
        tire_set: (setsQ.data ?? []).find((s) => s.id === effectiveQuickSet)?.name ?? "Set",
        ...sessionLogContext(carId, activeWeekend, activeSession),
        hot_fl: num(quick.fl),
        hot_fr: num(quick.fr),
        hot_rl: num(quick.rl),
        hot_rr: num(quick.rr),
        laps: quick.laps ? parseInt(quick.laps, 10) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hot pressures saved");
      setQuickOpen(false);
      setQuick({ fl: "", fr: "", rl: "", rr: "", laps: "" });
      invalidate();
      onHotSaved?.();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const setName = (id: string | null) => (setsQ.data ?? []).find((s) => s.id === id)?.name ?? "—";

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-1">
            <Disc className="w-3 h-3" /> Tyre sets
          </div>
          <h2 className="font-display text-2xl font-bold mt-1">Set registry &amp; car layout</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Identify each set (manufacturer, model, compound, size, serial), fit it to the car,
            rotate positions without losing history, and log hot pressures in seconds.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                disabled={!carId}
                title={!carId ? "Pick an active weekend with a car" : "Log four hot pressures fast"}
              >
                <Gauge className="w-4 h-4 mr-1" /> Quick hot pressures
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Hot pressures — quick entry</DialogTitle>
              </DialogHeader>
              {sessionId && (
                <div className="space-y-1">
                  {sessionQ.isPending && <p role="status">Loading session…</p>}
                  {sessionQ.isError && (
                    <div role="alert" className="text-destructive">
                      Could not load this session and car. Saving is disabled.
                      <Button variant="outline" onClick={() => sessionQ.refetch()}>
                        Retry session
                      </Button>
                    </div>
                  )}
                  {sessionQ.data && (
                    <>
                      <p className="font-display text-lg font-bold break-words">
                        {sessionQ.data.carName}
                      </p>
                      <p className="text-sm font-semibold break-words">{sessionQ.data.name}</p>
                    </>
                  )}
                </div>
              )}
              <div className="space-y-3">
                {!sessionId && (
                  <div>
                    <Label>Tyre set</Label>
                    <Select value={effectiveQuickSet} onValueChange={setQuickSetId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a set" />
                      </SelectTrigger>
                      <SelectContent>
                        {carSets.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {CORNERS.map((c) => (
                    <div key={c}>
                      <Label htmlFor={`quick-hot-${c}`} className="font-mono uppercase text-xs">
                        {cornerName[c]} (psi)
                      </Label>
                      <Input
                        id={`quick-hot-${c}`}
                        inputMode="decimal"
                        type="number"
                        step="any"
                        autoFocus={!sessionId && c === "fl"}
                        className="h-14 text-2xl font-mono text-center"
                        value={quick[c]}
                        onChange={(e) => setQuick({ ...quick, [c]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                {!sessionId && (
                  <div>
                    <Label>Laps this run (optional)</Label>
                    <Input
                      inputMode="numeric"
                      type="number"
                      value={quick.laps}
                      onChange={(e) => setQuick({ ...quick, laps: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={() => quickSave.mutate()}
                  disabled={
                    quickSave.isPending ||
                    (!!sessionId && (!sessionQ.data || sessionQ.isError || sessionQ.isFetching))
                  }
                  className="w-full h-12 text-base"
                >
                  {quickSave.isPending ? "Saving…" : "Save hot pressures"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-glow">
                <Plus className="w-4 h-4 mr-1" /> New set
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Register a tyre set</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                {!carId && (
                  <div className="col-span-2">
                    <Label>Car *</Label>
                    <Select
                      value={form.car_id}
                      onValueChange={(v) => setForm({ ...form, car_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a car" />
                      </SelectTrigger>
                      <SelectContent>
                        {(carsQ.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Set name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Set A"
                  />
                </div>
                <div>
                  <Label>Serial / ID number</Label>
                  <Input
                    value={form.serial_no}
                    onChange={(e) => setForm({ ...form, serial_no: e.target.value })}
                    placeholder="e.g. D1234-56"
                  />
                </div>
                <div>
                  <Label>Manufacturer</Label>
                  <Input
                    value={form.manufacturer}
                    onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                    placeholder="Hoosier"
                  />
                </div>
                <div>
                  <Label>Model</Label>
                  <Input
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="A7"
                  />
                </div>
                <div>
                  <Label>Compound</Label>
                  <Input
                    value={form.compound}
                    onChange={(e) => setForm({ ...form, compound: e.target.value })}
                    placeholder="Medium"
                  />
                </div>
                <div>
                  <Label>Size</Label>
                  <Input
                    value={form.size}
                    onChange={(e) => setForm({ ...form, size: e.target.value })}
                    placeholder="245/40R17"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createSet.mutate()} disabled={createSet.isPending}>
                  Register set
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Visual car layout */}
      <div className="mt-5 grid sm:grid-cols-[auto_1fr] gap-5 items-start">
        <div className="mx-auto">
          <div className="rounded-2xl border border-border bg-background/60 px-6 py-4">
            <div className="grid grid-cols-2 gap-x-10 gap-y-2">
              {(["fl", "fr", "rl", "rr"] as Corner[]).map((pos) => {
                const fit = slotAt[pos];
                return (
                  <div
                    key={pos}
                    className={`w-24 rounded-lg border p-2 text-center ${fit ? "border-primary/50 bg-primary/5" : "border-dashed border-border"}`}
                  >
                    <div className="font-display font-bold uppercase text-xs">{pos}</div>
                    {fit ? (
                      <>
                        <div className="font-mono text-sm font-bold mt-0.5 truncate">
                          {fit.set.name}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          tyre #{fit.slot}
                        </div>
                      </>
                    ) : (
                      <div className="font-mono text-[10px] text-muted-foreground mt-1">empty</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
              front ↑
            </div>
          </div>
          <div className="mt-3 flex gap-2 justify-center">
            <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={carAssignments.length < 4}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Rotate
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Rotate tyres</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Moves each tyre to a new corner. The old positions are closed out and kept in
                  history.
                </p>
                <div className="grid gap-2 mt-2">
                  <Button
                    variant="outline"
                    className="justify-start h-12"
                    onClick={() => rotate.mutate("front-to-rear")}
                    disabled={rotate.isPending}
                  >
                    Front ↔ rear (straight)
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start h-12"
                    onClick={() => rotate.mutate("cross")}
                    disabled={rotate.isPending}
                  >
                    Cross (FL↔RR, FR↔RL)
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start h-12"
                    onClick={() => rotate.mutate("rear-to-front")}
                    disabled={rotate.isPending}
                  >
                    Left ↔ right swap
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Set cards */}
        <div className="space-y-3 min-w-0">
          {setsQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!setsQ.isLoading && carSets.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <Disc className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                No tyre sets registered{carId ? " for this car" : ""} yet. Register one to start
                tracking its life across weekends.
              </p>
            </div>
          )}
          {carSets.map((s) => {
            const logs = (setLogsQ.data ?? []).filter((l) => l.tyre_set_id === s.id);
            const totals = setTotals(logs);
            const latest = logs[0];
            const obs = latest ? analyzeTyreReading(logToReading(latest)) : [];
            const fitted = carAssignments.some((a) => a.tyre_set_id === s.id);
            return (
              <div key={s.id} className="rounded-lg border border-border bg-background/40 p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-display text-lg font-bold truncate">
                      {s.name}
                      {fitted && (
                        <span className="ml-2 align-middle rounded-full bg-primary/15 text-primary px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest">
                          on car
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {[s.manufacturer, s.model, s.compound, s.size].filter(Boolean).join(" · ") ||
                        "No spec recorded"}
                      {s.serial_no && ` · ID ${s.serial_no}`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {carId && !fitted && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fitSet.mutate(s.id)}
                        disabled={fitSet.isPending}
                      >
                        Fit to car
                      </Button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${s.name}? Its logs stay but lose the set link.`))
                          deleteSet.mutate(s.id);
                      }}
                      className="p-2 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${s.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MiniStat label="Total laps" value={String(totals.laps)} />
                  <MiniStat
                    label="Distance"
                    value={totals.distanceKm ? `${totals.distanceKm.toFixed(0)} km` : "—"}
                  />
                  <MiniStat label="Heat cycles" value={String(totals.heatCycles)} />
                </div>

                {obs.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Observations from latest reading
                    </div>
                    {obs.map((o, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                          o.severity === "flag"
                            ? "border-destructive/40 bg-destructive/10"
                            : "border-border bg-card"
                        }`}
                      >
                        {o.severity === "flag" ? (
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-destructive shrink-0" />
                        ) : o.severity === "watch" ? (
                          <Info className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-chart-3 shrink-0" />
                        )}
                        <span>{o.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {logs.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">
                      History ({logs.length} reading{logs.length === 1 ? "" : "s"})
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      {logs.map((l) => (
                        <div
                          key={l.id}
                          className="rounded-md border border-border bg-card px-3 py-2 text-xs font-mono"
                        >
                          <span className="text-muted-foreground">
                            {new Date(l.recorded_at).toLocaleDateString()}
                          </span>
                          {" · "}hot {l.hot_fl ?? "—"}/{l.hot_fr ?? "—"}/{l.hot_rl ?? "—"}/
                          {l.hot_rr ?? "—"}
                          {l.laps != null && ` · ${l.laps} laps`}
                          {l.heat_cycles != null && l.heat_cycles > 0 && ` · ${l.heat_cycles} HC`}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {!carId && (
        <p className="mt-4 text-xs text-muted-foreground">
          Tip: pick an active weekend with a car to fit sets, rotate and quick-log pressures against
          the live session.
        </p>
      )}
      <div className="sr-only">{setName(fittedSetId)}</div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-card px-3 py-2">
      <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-bold font-mono tabular-nums">{value}</div>
    </div>
  );
}
