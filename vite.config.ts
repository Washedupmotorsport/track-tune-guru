// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  vite: {
    plugins: [VitePWA({
      strategies: "generateSW",
      filename: "sw.js",
      registerType: "autoUpdate",
      injectRegister: null,
      manifest: false,
      devOptions: { enabled: false },
      workbox: {
        cacheId: "mre-v1",
        globPatterns: ["**/*.{js,css,woff,woff2,png,jpg,ico,webmanifest}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: null,
        importScripts: ["/mre-reminders.js"],
        runtimeCaching: [
          { urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth") && !url.pathname.startsWith("/auth") && !url.pathname.startsWith("/reset-password") && !url.pathname.startsWith("/api") && !url.pathname.startsWith("/_serverFn"), handler: "NetworkFirst", options: { cacheName: "mre-v1-pages", networkTimeoutSeconds: 5 } },
          { urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/assets\/.*-[\w-]+\.(js|css|woff2?|png|jpe?g|webp)$/.test(url.pathname), handler: "CacheFirst", options: { cacheName: "mre-v1-assets", expiration: { maxEntries: 200 } } },
        ],
      },
    })],
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});
