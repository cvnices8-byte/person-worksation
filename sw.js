const CACHE_NAME = "yanxi-workstation-v11";
const APP_SHELL = [
  "./",
  "./index.html",
  "./experience.css?v=20260921-11",
  "./experience.js?v=20260921-11",
  "./styles.css?v=20260921-10",
  "./app.js?v=20260921-11",
  "./db.js?v=20260921-10",
  "./data.js?v=20260921-10",
  "./manifest.webmanifest",
  "./icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        }),
    ),
  );
});
