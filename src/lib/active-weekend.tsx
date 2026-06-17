import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type ActiveWeekend = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  track: string | null;
  track_id: string | null;
  car_id: string | null;
  status: string | null;
};

export type ActiveCar = { id: string; name: string | null; year: number | null; make: string | null; model: string | null } | null;
export type ActiveTrack = { id: string; name: string } | null;
export type ActiveSession = { id: string; name: string; session_type: string; started_at: string; event_id: string | null } | null;

type Ctx = {
  loading: boolean;
  activeWeekend: ActiveWeekend | null;
  activeCar: ActiveCar;
  activeTrack: ActiveTrack;
  activeSession: ActiveSession;
  weekends: ActiveWeekend[];
  setActiveWeekendId: (id: string | null) => void;
};

const ActiveWeekendContext = createContext<Ctx | undefined>(undefined);

const STORAGE_KEY = "mre:activeWeekendId";

export function ActiveWeekendProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [manualId, setManualId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  // Sync from URL when on /weekends/$eventId
  useEffect(() => {
    const m = pathname.match(/^\/weekends\/([^/]+)/);
    if (m && m[1]) {
      setManualId(m[1]);
      try { window.localStorage.setItem(STORAGE_KEY, m[1]); } catch { /* ignore */ }
    }
  }, [pathname]);

  const setActiveWeekendId = (id: string | null) => {
    setManualId(id);
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  };

  const weekendsQ = useQuery({
    queryKey: ["active-weekend:list", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("id, title, starts_at, ends_at, track, track_id, car_id, status")
        .in("event_type", ["race", "test"])
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ActiveWeekend[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const weekends = weekendsQ.data ?? [];

  const activeWeekend = useMemo<ActiveWeekend | null>(() => {
    if (!weekends.length) return null;
    if (manualId) {
      const m = weekends.find((w) => w.id === manualId);
      if (m) return m;
      // Stored id no longer maps to a visible weekend (deleted or access revoked).
      // Clear it so we don't keep attaching new sessions to a phantom event id.
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
    const now = Date.now();
    // Running: started, not ended
    const running = weekends.find((w) => {
      const s = new Date(w.starts_at).getTime();
      const e = w.ends_at ? new Date(w.ends_at).getTime() : s + 86400000;
      return s <= now && now <= e;
    });
    if (running) return running;
    // Else next upcoming
    const upcoming = [...weekends]
      .filter((w) => new Date(w.starts_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    if (upcoming[0]) return upcoming[0];
    // Else most recent past
    return weekends[0] ?? null;
  }, [weekends, manualId]);

  const carQ = useQuery({
    queryKey: ["active-weekend:car", activeWeekend?.car_id],
    queryFn: async () => {
      if (!activeWeekend?.car_id) return null;
      const { data } = await supabase
        .from("cars")
        .select("id, name, year, make, model")
        .eq("id", activeWeekend.car_id)
        .maybeSingle();
      return (data as ActiveCar) ?? null;
    },
    enabled: !!activeWeekend?.car_id,
  });

  const trackQ = useQuery({
    queryKey: ["active-weekend:track", activeWeekend?.track_id],
    queryFn: async () => {
      if (!activeWeekend?.track_id) return null;
      const { data } = await supabase
        .from("tracks")
        .select("id, name")
        .eq("id", activeWeekend.track_id)
        .maybeSingle();
      return (data as ActiveTrack) ?? null;
    },
    enabled: !!activeWeekend?.track_id,
  });

  const sessionQ = useQuery({
    queryKey: ["active-weekend:session", activeWeekend?.id, user?.id],
    queryFn: async () => {
      if (!activeWeekend) return null;
      const { data } = await supabase
        .from("sessions")
        .select("id, name, session_type, started_at, event_id")
        .eq("event_id", activeWeekend.id)
        .order("started_at", { ascending: false })
        .limit(1);
      return ((data?.[0] as ActiveSession) ?? null);
    },
    enabled: !!user && !!activeWeekend,
    refetchInterval: 60_000,
  });

  const value: Ctx = {
    loading: weekendsQ.isLoading,
    activeWeekend,
    activeCar: carQ.data ?? null,
    activeTrack: trackQ.data ?? null,
    activeSession: sessionQ.data ?? null,
    weekends,
    setActiveWeekendId,
  };

  return <ActiveWeekendContext.Provider value={value}>{children}</ActiveWeekendContext.Provider>;
}

export function useActiveWeekend(): Ctx {
  const ctx = useContext(ActiveWeekendContext);
  if (!ctx) {
    return {
      loading: false,
      activeWeekend: null,
      activeCar: null,
      activeTrack: null,
      activeSession: null,
      weekends: [],
      setActiveWeekendId: () => {},
    };
  }
  return ctx;
}