import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

// Browser-only reminder scheduler.
// Important: notifications fire only while the app is open in a tab.
// True background push is not configured for this app.

const SETTINGS_KEY = "mre:reminders:v1";
const FIRED_KEY = "mre:reminders:fired:v1";
const HORIZON_MS = 24 * 60 * 60 * 1000; // schedule up to 24h ahead
const RESCAN_MS = 5 * 60 * 1000;

export type ReminderSettings = {
  enabled: boolean;
  eventLeadsMin: number[];   // calendar events: e.g. [1440, 60]
  sessionLeadMin: number;    // active-weekend sessions: e.g. 30
};

const DEFAULTS: ReminderSettings = {
  enabled: false,
  eventLeadsMin: [1440, 60],
  sessionLeadMin: 30,
};

type Ctx = {
  permission: NotificationPermission | "unsupported";
  settings: ReminderSettings;
  setSettings: (s: Partial<ReminderSettings>) => void;
  requestPermission: () => Promise<NotificationPermission | "unsupported">;
  enable: () => Promise<boolean>;
  disable: () => void;
  scheduledCount: number;
  testNotify: () => void;
};

const ReminderContext = createContext<Ctx | undefined>(undefined);

function loadSettings(): ReminderSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { return DEFAULTS; }
}

function saveSettings(s: ReminderSettings) {
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function loadFired(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FIRED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as Array<[string, number]>;
    const cutoff = Date.now() - 7 * 86400000;
    const fresh = arr.filter(([, t]) => t > cutoff);
    return new Set(fresh.map(([k]) => k));
  } catch { return new Set(); }
}
function persistFired(set: Set<string>) {
  try {
    const now = Date.now();
    const arr: Array<[string, number]> = Array.from(set).map((k) => [k, now]);
    window.localStorage.setItem(FIRED_KEY, JSON.stringify(arr));
  } catch { /* ignore */ }
}

function notify(title: string, body: string, tag: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, tag, icon: "/favicon.ico", badge: "/favicon.ico" });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* ignore */ }
}

export function ReminderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettingsState] = useState<ReminderSettings>(() => loadSettings());
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const firedRef = useRef<Set<string>>(loadFired());
  const timeoutsRef = useRef<number[]>([]);
  const [scheduledCount, setScheduledCount] = useState(0);

  const setSettings = useCallback((s: Partial<ReminderSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...s };
      saveSettings(next);
      return next;
    });
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
    if (Notification.permission === "granted" || Notification.permission === "denied") {
      setPermission(Notification.permission);
      return Notification.permission;
    }
    const p = await Notification.requestPermission();
    setPermission(p);
    return p;
  }, []);

  const enable = useCallback(async () => {
    const p = await requestPermission();
    if (p === "granted") {
      setSettings({ enabled: true });
      return true;
    }
    return false;
  }, [requestPermission, setSettings]);

  const disable = useCallback(() => setSettings({ enabled: false }), [setSettings]);

  const testNotify = useCallback(() => {
    notify("Reminders are on", "You'll get alerts for upcoming events and sessions.", "mre-test");
  }, []);

  const eventsQ = useQuery({
    queryKey: ["reminders:events", user?.id],
    queryFn: async () => {
      const nowIso = new Date(Date.now() - 60_000).toISOString();
      const horizonIso = new Date(Date.now() + HORIZON_MS + 60_000).toISOString();
      const { data, error } = await supabase
        .from("calendar_events")
        .select("id, title, event_type, starts_at, track, location")
        .gte("starts_at", nowIso)
        .lte("starts_at", horizonIso);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && settings.enabled && permission === "granted",
    refetchInterval: RESCAN_MS,
    staleTime: 60_000,
  });

  const sessionsQ = useQuery({
    queryKey: ["reminders:sessions", user?.id],
    queryFn: async () => {
      const nowIso = new Date(Date.now() - 60_000).toISOString();
      const horizonIso = new Date(Date.now() + HORIZON_MS + 60_000).toISOString();
      const { data, error } = await supabase
        .from("sessions")
        .select("id, name, session_type, started_at, track, event_id")
        .gte("started_at", nowIso)
        .lte("started_at", horizonIso);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && settings.enabled && permission === "granted",
    refetchInterval: RESCAN_MS,
    staleTime: 60_000,
  });

  // Schedule timers
  useEffect(() => {
    // Clear previous timers
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];

    if (!settings.enabled || permission !== "granted") {
      setScheduledCount(0);
      return;
    }

    const now = Date.now();
    let count = 0;

    const schedule = (key: string, when: number, title: string, body: string) => {
      const delay = when - now;
      if (delay <= 0 || delay > HORIZON_MS) return;
      if (firedRef.current.has(key)) return;
      const id = window.setTimeout(() => {
        notify(title, body, key);
        firedRef.current.add(key);
        persistFired(firedRef.current);
      }, delay);
      timeoutsRef.current.push(id);
      count++;
    };

    for (const ev of eventsQ.data ?? []) {
      const startMs = new Date(ev.starts_at).getTime();
      if (!Number.isFinite(startMs)) continue;
      for (const lead of settings.eventLeadsMin) {
        const when = startMs - lead * 60_000;
        const label = lead >= 1440 ? `${Math.round(lead/1440)}d` : lead >= 60 ? `${Math.round(lead/60)}h` : `${lead}m`;
        const where = ev.track || ev.location || "";
        schedule(
          `evt:${ev.id}:${lead}`,
          when,
          `${ev.title} in ${label}`,
          [ev.event_type, where, new Date(ev.starts_at).toLocaleString()].filter(Boolean).join(" · "),
        );
      }
    }

    for (const s of sessionsQ.data ?? []) {
      const startMs = new Date(s.started_at).getTime();
      if (!Number.isFinite(startMs)) continue;
      const lead = settings.sessionLeadMin;
      schedule(
        `sess:${s.id}:${lead}`,
        startMs - lead * 60_000,
        `${s.name || s.session_type} starts in ${lead} min`,
        [s.session_type, s.track || "", new Date(s.started_at).toLocaleTimeString()].filter(Boolean).join(" · "),
      );
    }

    setScheduledCount(count);

    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
    };
  }, [settings, permission, eventsQ.data, sessionsQ.data]);

  const value = useMemo<Ctx>(() => ({
    permission, settings, setSettings, requestPermission, enable, disable, scheduledCount, testNotify,
  }), [permission, settings, setSettings, requestPermission, enable, disable, scheduledCount, testNotify]);

  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}

export function useReminders(): Ctx {
  const ctx = useContext(ReminderContext);
  if (!ctx) {
    return {
      permission: "unsupported",
      settings: DEFAULTS,
      setSettings: () => {},
      requestPermission: async () => "unsupported",
      enable: async () => false,
      disable: () => {},
      scheduledCount: 0,
      testNotify: () => {},
    };
  }
  return ctx;
}