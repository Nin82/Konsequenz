self.addEventListener("install", event => {
  console.log("Service Worker installato");
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  console.log("Service Worker attivo");
});

// NON intercettiamo tutte le richieste!
// Solo richieste GET locali (file del tuo progetto)
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Ignora CDNs e API esterne
  const isExternal =
    url.origin !== self.location.origin ||
    url.href.includes("cdn.") ||
    url.href.includes("backendless");

  if (isExternal) return; // <-- evita errori CORS

  event.respondWith(
    caches.open("konsequenz-cache").then(cache =>
      cache.match(event.request).then(response => {
        return (
          response ||
          fetch(event.request).then(networkResponse => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          })
        );
      })
    )
  );
});