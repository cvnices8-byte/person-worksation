const CACHE_NAME = "yanxi-workstation-v13";
const APP_SHELL = [
  "./",
  "./index.html",
  "./experience.css?v=20260921-13",
  "./experience.js?v=20260921-11",
  "./styles.css?v=20260921-10",
  "./app.js?v=20260921-13",
  "./boot.js?v=20260921-13",
  "./focus-timer.js?v=20260921-13",
  "./db.js?v=20260921-10",
  "./data.js?v=20260921-10",
  "./manifest.webmanifest?v=13",
  "./icons/icon.svg?v=13",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("yanxi-workstation-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: "no-cache" });
        if (!response.ok) throw new Error("Page unavailable");
        const cache = await caches.open(CACHE_NAME);
        await cache.put("./index.html", response.clone());
        return response;
      } catch {
        return (await caches.match("./index.html")) || Response.error();
      }
    })());
    return;
  }
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
          }
          return response;
        }),
    ),
  );
});
