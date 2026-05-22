// Lightweight offline shell cache for Summit Racing.
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