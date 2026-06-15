// Lightweight offline shell cache for My Race Engineer.
const CACHE = "summit-v1";
const SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never cache Supabase, AI gateway, weather, or auth endpoints
  if (/supabase\.co|lovable\.dev|open-meteo\.com/.test(url.host)) return;

  // HTML: network-first, fall back to cached shell when offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Static assets: cache-first
  if (/\.(?:css|js|woff2?|ttf|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
  }
});

// =====================================================================
// Scheduled reminders (calendar events + race-weekend sessions)
// The page posts a desired schedule; the SW uses the Notification
// Triggers API where supported so alerts fire even when the tab is
// closed. Falls back to in-SW setTimeout while the worker is alive.
// =====================================================================
const SUPPORTS_TRIGGERS = "showTrigger" in Notification.prototype ||
  (typeof TimestampTrigger !== "undefined");
const swTimers = new Map(); // key -> timeoutId

async function clearScheduled(prefix) {
  // Cancel triggered notifications that haven't fired yet
  try {
    const pending = await self.registration.getNotifications({ includeTriggered: true });
    for (const n of pending) {
      if (!prefix || (n.tag && n.tag.startsWith(prefix))) n.close();
    }
  } catch { /* ignore */ }
  // Cancel in-memory timers
  for (const [key, id] of swTimers) {
    if (!prefix || key.startsWith(prefix)) {
      clearTimeout(id);
      swTimers.delete(key);
    }
  }
}

async function scheduleOne({ key, when, title, body, url }) {
  const delay = when - Date.now();
  if (delay <= 0) return;
  const options = {
    body,
    tag: key,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: url || "/" },
    requireInteraction: false,
  };
  if (SUPPORTS_TRIGGERS) {
    try {
      options.showTrigger = new TimestampTrigger(when);
      await self.registration.showNotification(title, options);
      return;
    } catch { /* fall through to setTimeout */ }
  }
  // Fallback: only reliable while SW is alive (a few minutes typically).
  const id = setTimeout(() => {
    self.registration.showNotification(title, options).catch(() => {});
    swTimers.delete(key);
  }, Math.min(delay, 2147483000));
  swTimers.set(key, id);
}

self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "schedule-reminders") {
    event.waitUntil((async () => {
      await clearScheduled(msg.prefix || "");
      for (const item of msg.items || []) {
        await scheduleOne(item);
      }
    })());
  } else if (msg.type === "clear-reminders") {
    event.waitUntil(clearScheduled(msg.prefix || ""));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) {
        try { await c.focus(); } catch { /* ignore */ }
        try { c.navigate(target); } catch { /* ignore */ }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});