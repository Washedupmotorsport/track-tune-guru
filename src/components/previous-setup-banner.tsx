import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Copy, Eye, GitCompare, History, Trophy } from "lucide-react";
import { toast } from "sonner";
import { formatLapTime } from "@/lib/lap-time";
import {
  rankHistoricalSetups,
  circuitHistory,
  pickHighlights,
  type SetupHistoryEntry,
  type RankedSetup,
} from "@/lib/setup-retrieval";

type Props = {
  carId: string;
  carName?: string | null;
  track?: string | null;
  trackId?: string | null;
  weather?: string | null;
  trackTempC?: number | null;
  compound?: string | null;
};

type SetupRow = { id: string; name: string; track: string | null; updated_at: string };
type SessionRow = {
  id: string;
  setup_id: string | null;
  track: string | null;
  track_id: string | null;
  weather: string | null;
  track_temp_c: number | null;
  started_at: string;
};

/**
 * "Previous best setup available" banner shown when entering a race weekend.
 * Ranks the car's historical setups at this circuit and offers view / copy / compare.
 * Copying always creates a new setup — the original is never touched.
 */
export function PreviousSetupBanner({
  carId,
  carName,
  track,
  trackId,
  weather,
  trackTempC,
  compound,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const setupsQ = useQuery({
    queryKey: ["hist-setups", carId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setups")
        .select("id, name, track, updated_at")
        .eq("car_id", carId);
      if (error) throw error;
      return data as SetupRow[];
    },
  });

  const sessionsQ = useQuery({
    queryKey: ["hist-sessions", carId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, setup_id, track, track_id, weather, track_temp_c, started_at")
        .eq("car_id", carId)
        .not("setup_id", "is", null)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data as SessionRow[];
    },
  });

  const sessionIds = useMemo(() => (sessionsQ.data ?? []).map((s) => s.id), [sessionsQ.data]);

  const lapsQ = useQuery({
    queryKey: ["hist-laps", carId, sessionIds.join(",")],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("laps")
        .select("session_id, lap_time_ms")
        .in("session_id", sessionIds);
      if (error) throw error;
      return data as { session_id: string; lap_time_ms: number }[];
    },
  });

  const tiresQ = useQuery({
    queryKey: ["hist-tires", carId, sessionIds.join(",")],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tire_logs")
        .select("session_id, compound, recorded_at")
        .in("session_id", sessionIds)
        .not("compound", "is", null);
      if (error) throw error;
      return data as { session_id: string; compound: string | null; recorded_at: string }[];
    },
  });

  const entries = useMemo<SetupHistoryEntry[]>(() => {
    return circuitHistory(
      setupsQ.data ?? [],
      sessionsQ.data ?? [],
      lapsQ.data ?? [],
      tiresQ.data ?? [],
      { carId, track, trackId },
    );
  }, [setupsQ.data, sessionsQ.data, lapsQ.data, tiresQ.data, carId, track, trackId]);

  const ranked = useMemo(
    () => rankHistoricalSetups(entries, { carId, track, trackId, weather, trackTempC, compound }),
    [entries, carId, track, trackId, weather, trackTempC, compound],
  );
  const highlights = useMemo(() => pickHighlights(ranked), [ranked]);

  const copySetup = useMutation({
    mutationFn: async (setupId: string) => {
      if (!user) throw new Error("Sign in required");
      const { data: src, error: readErr } = await supabase
        .from("setups")
        .select("*")
        .eq("id", setupId)
        .single();
      if (readErr) throw readErr;
      const { error } = await supabase.from("setups").insert({
        user_id: user.id,
        car_id: src.car_id,
        name: `${src.name} (copy)`,
        discipline: src.discipline,
        track: track ?? src.track,
        conditions: src.conditions,
        setup_data: src.setup_data,
        preset_type: src.preset_type,
        ideal_conditions: src.ideal_conditions,
        is_baseline: false,
        notes: `Copied from "${src.name}" on ${new Date().toLocaleDateString()}. Original setup preserved unchanged.`,
      });
      if (error) throw error;
      return src.name;
    },
    onSuccess: (name, setupId) => {
      setCopiedId(setupId);
      toast.success(`"${name}" copied as a new setup — the original is untouched`);
      qc.invalidateQueries({ queryKey: ["hist-setups", carId] });
      qc.invalidateQueries({ queryKey: ["setups"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Copy failed"),
  });

  if (!carId || (!track && !trackId)) return null;
  if (setupsQ.isLoading || sessionsQ.isLoading) return null;

  const circuit = track ?? "this circuit";

  if (ranked.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/60 p-4 flex items-start gap-3">
        <History className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground">
          No previous setups recorded at{" "}
          <span className="text-foreground font-medium">{circuit}</span> for this car yet. Once you
          run a session here with a setup attached, it will show up here as a starting point.
        </p>
      </div>
    );
  }

  const best = highlights.fastest ?? highlights.bestMatch;
  if (!best) return null;
  const others = [
    highlights.mostRecent && highlights.mostRecent.setupId !== best.setupId
      ? { label: "Most recent", r: highlights.mostRecent }
      : null,
    highlights.bestMatch &&
    highlights.bestMatch.setupId !== best.setupId &&
    highlights.bestMatch.setupId !== highlights.mostRecent?.setupId
      ? { label: "Best match for conditions", r: highlights.bestMatch }
      : null,
  ].filter((x): x is { label: string; r: RankedSetup } => !!x);

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 sm:p-5 shadow-card">
      <div className="font-mono text-xs uppercase tracking-[0.2em] text-primary flex items-center gap-1.5">
        <Trophy className="w-3.5 h-3.5" /> Previous best setup available
      </div>
      <div className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <div>
          <span className="text-muted-foreground">Circuit:</span>{" "}
          <span className="font-medium">{circuit}</span>
        </div>
        {carName && (
          <div>
            <span className="text-muted-foreground">Vehicle:</span>{" "}
            <span className="font-medium">{carName}</span>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Previous best lap:</span>{" "}
          <span className="font-mono font-bold">
            {best.bestLapMs != null ? formatLapTime(best.bestLapMs) : "—"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Conditions:</span>{" "}
          <span className="font-medium">
            {[
              best.weather,
              best.trackTempC != null ? `track ${best.trackTempC}°C` : null,
              best.compound,
            ]
              .filter(Boolean)
              .join(" · ") || "not recorded"}
          </span>
        </div>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Setup: <span className="text-foreground font-medium">{best.setupName}</span>
        {best.lastUsedAt && <> · last used {new Date(best.lastUsedAt).toLocaleDateString()}</>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline" className="h-10">
          <Link to="/setups/$setupId" params={{ setupId: best.setupId }}>
            <Eye className="w-4 h-4 mr-1" /> View setup
          </Link>
        </Button>
        <Button
          size="sm"
          className="h-10 shadow-glow"
          disabled={copySetup.isPending || copiedId === best.setupId}
          onClick={() => copySetup.mutate(best.setupId)}
        >
          <Copy className="w-4 h-4 mr-1" />
          {copiedId === best.setupId ? "Copied" : "Use as starting setup"}
        </Button>
        <Button asChild size="sm" variant="outline" className="h-10">
          <Link to="/setup-library" search={{ tab: "comparisons" }}>
            <GitCompare className="w-4 h-4 mr-1" /> Compare setups
          </Link>
        </Button>
      </div>

      {others.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/60 space-y-1">
          {others.map(({ label, r }) => (
            <div key={r.setupId} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                {label}: <span className="text-foreground">{r.setupName}</span>
                {r.bestLapMs != null && (
                  <>
                    {" "}
                    · <span className="font-mono">{formatLapTime(r.bestLapMs)}</span>
                  </>
                )}
                {r.lastUsedAt && <> · {new Date(r.lastUsedAt).toLocaleDateString()}</>}
              </span>
              <button
                className="text-primary hover:underline font-mono uppercase tracking-widest text-[10px] shrink-0"
                onClick={() => copySetup.mutate(r.setupId)}
                disabled={copySetup.isPending || copiedId === r.setupId}
              >
                {copiedId === r.setupId ? "Copied" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
