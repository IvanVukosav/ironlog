// App-shell service worker: lets the installed app open instantly and show
// its UI offline. Data always comes from the network (the API is on
// another origin and is never cached here).
const CACHE_NAME = "ironlog-shell-v1";
const APP_SHELL = ["/index.html", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function cacheCopy(request, response) {
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Pages: network first so a new deploy shows up right away; the cached
  // shell when offline. Every route is the same SPA index.html.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => cacheCopy("/index.html", response))
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  // Vite's hashed build files never change under the same name: cache first.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches
        .match(request)
        .then(
          (cached) => cached || fetch(request).then((response) => cacheCopy(request, response)),
        ),
    );
  }
});
