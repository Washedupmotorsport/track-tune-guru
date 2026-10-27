import { isPreviewHost } from "./pwa-policy";

export async function registerOfflineWorker() {
  if (!("serviceWorker" in navigator)) return;
  const refused = !import.meta.env.PROD || window.self !== window.top ||
    isPreviewHost(window.location.hostname) || new URLSearchParams(window.location.search).get("sw") === "off";
  if (refused) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(registrations.filter((registration) => {
      const url = registration.active?.scriptURL ?? registration.waiting?.scriptURL ?? registration.installing?.scriptURL;
      return url && new URL(url).pathname === "/sw.js";
    }).map((registration) => registration.unregister()));
    return;
  }
  const { registerSW } = await import("virtual:pwa-register");
  registerSW({ immediate: true });
}