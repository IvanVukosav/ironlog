// App-shell service worker: lets the installed app open instantly and show
// its UI offline. The API's answers to reads always come from the network
// when it can be reached; without a connection, the last answer kept here
// stands in, so pages still show what they showed last.
const CACHE_NAME = "ironlog-shell-v1";
const API_CACHE = "ironlog-api-v1";
const APP_SHELL = ["/index.html", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png"];
// Never kept: sign-in answers, and backup downloads (large, and made fresh on purpose).
const API_NOT_KEPT = ["/api/auth/", "/api/backup/"];
// A day's workout is kept by the app itself, with the changes not sent yet: a copy here could be
// older than that one and hide them.
const API_KEPT_BY_APP = ["/api/workouts"];
// The most API answers kept; the oldest go first.
const API_KEEP = 300;

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
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== API_CACHE)
            .map((key) => caches.delete(key)),
        ),
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

// A read from the API (on its own origin in production): the network's answer, kept for later;
// without a connection, the one kept last. With none kept, the request fails as it would have,
// so the page knows it is offline.
function apiRead(request) {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(API_CACHE).then((cache) =>
          cache
            .put(request, copy)
            .then(() => cache.keys())
            .then((keys) => Promise.all(keys.slice(0, -API_KEEP).map((key) => cache.delete(key)))),
        );
      }
      return response;
    })
    .catch((err) =>
      caches
        .open(API_CACHE)
        .then((cache) => cache.match(request))
        .then((kept) => kept || Promise.reject(err)),
    );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET") return;

  if (url.pathname.startsWith("/api/")) {
    const kept =
      !API_NOT_KEPT.some((prefix) => url.pathname.startsWith(prefix)) &&
      !API_KEPT_BY_APP.includes(url.pathname);
    if (kept) event.respondWith(apiRead(request));
    return;
  }
  if (url.origin !== self.location.origin) return;

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
