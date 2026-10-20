// Puente de actualización: sustituye el service worker antiguo que usaba el nombre sw.js.
// En activación se desregistra y recarga las pestañas para que app.js instale ServiceWorker.js.
self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    self.registration.unregister().then(() =>
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients =>
        Promise.all(clients.map(client => client.navigate(client.url)))
      )
    )
  );
});
