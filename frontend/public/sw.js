const CACHE_NAME = "dermasathiai-shell-v1";
const SHELL_FILES = ["/", "/manifest.webmanifest", "/assets/dermasathi-favicon.png", "/assets/dermasathi-brand-mark.png", "/assets/pwa-icon-192.png"];
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_FILES);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("dermasathiai-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API/auth responses or Vite development modules/clinical data.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/src/") || url.pathname.startsWith("/node_modules/") || url.pathname.startsWith("/@") || url.pathname.startsWith("/__vite")) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type === "basic") {
        await cache.put(request.mode === "navigate" ? "/" : request, response.clone());
      }
      return response;
    } catch (_error) {
      const cached = await cache.match(request.mode === "navigate" ? "/" : request);
      if (cached) return cached;
      if (request.mode === "navigate") {
        const shell = await cache.match("/");
        if (shell) return shell;
      }
      return new Response("Offline — reconnect to continue using DermaSathiAI.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});
