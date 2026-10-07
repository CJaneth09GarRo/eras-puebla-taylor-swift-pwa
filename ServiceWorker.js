// Define versión y recursos propios necesarios para abrir la app y navegar offline.
const CACHE = "eras-puebla-v10";
const FILES = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/community.js",
  "./js/supabase-config.js",
  "./manifest.json",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/img/taylor-midnights.jpg",
  "./assets/img/eras/taylor-swift.svg",
  "./assets/img/eras/fearless.svg",
  "./assets/img/eras/speak-now.svg",
  "./assets/img/eras/red.svg",
  "./assets/img/eras/1989.svg",
  "./assets/img/eras/reputation.svg",
  "./assets/img/eras/lover.svg",
  "./assets/img/eras/folklore.svg",
  "./assets/img/eras/evermore.svg",
  "./assets/img/eras/midnights.svg",
  "./assets/img/eras/tortured-poets.svg",
  "./assets/img/eras/showgirl.svg"
];

// Precache crítico antes de activar la app nueva; si falla, no instala una versión incompleta.
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

// Limpia cachés anteriores y toma control de las pestañas abiertas.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// Cache-first en archivos locales; si falla la navegación offline, devuelve el documento inicial.
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
        }
        return response;
      });
    }).catch(error => {
      if (request.mode === "navigate") return caches.match("./index.html");
      throw error;
    })
  );
});
