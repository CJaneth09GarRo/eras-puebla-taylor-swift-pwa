// Define versión y recursos propios necesarios para abrir la app y navegar offline.
const CACHE = "eras-puebla-v26";
const API_CACHE = "eras-puebla-api-v1";
const FILES = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/local-db.js",
  "./js/fan-tools.js",
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

// Bypass an older active worker's cache, then store fresh bytes at the canonical URL.
async function precacheFiles() {
  const cache = await caches.open(CACHE);
  await Promise.all(FILES.map(async file => {
    const canonicalUrl = new URL(file, self.location.href);
    const networkUrl = new URL(canonicalUrl);
    networkUrl.searchParams.set("pwa-cache", CACHE);
    const response = await fetch(networkUrl, { cache: "reload" });
    if (!response.ok) throw new Error(`No se pudo precargar ${file}.`);
    await cache.put(canonicalUrl, response);
  }));
}

// Descarga la app y, si la API responde, prepara también el primer catálogo offline.
self.addEventListener("install", event => {
  event.waitUntil(Promise.all([
    precacheFiles(),
    caches.open(API_CACHE).then(async cache => {
      const request = new Request(new URL("./api/eras", self.location.href));
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response);
      } catch {
        // Si la API no está disponible, se instalarán de todos modos los recursos estáticos.
      }
    })
  ]).then(() => self.skipWaiting()));
});

// Limpia solo cachés de esta PWA y toma control de las pestañas abiertas.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith("eras-puebla-v") && key !== CACHE).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// La API usa network-first para mostrar datos recientes y conserva la última respuesta offline.
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname === new URL("./api/eras", self.location.href).pathname) {
    event.respondWith((async () => {
      const cache = await caches.open(API_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return await cache.match(request) || Response.json({ error: "API sin conexión" }, { status: 503 });
      }
    })());
    return;
  }

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
