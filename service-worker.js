const CACHE_NAME = 'photo-workflow-cache-v1';

// Lista dei file da mettere in cache all'installazione. 
// Assicurati che questi percorsi siano corretti!
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/lib/Backendless.js',
  '/lib/xlsx.min.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Evento: Installazione del Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache aperta e file pre-caricati.');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Service Worker: Errore durante il pre-caching', err);
      })
  );
});

// Evento: Fetch (Gestisce le richieste di rete)
self.addEventListener('fetch', event => {
  // Ignora le richieste alle API di Backendless (devono sempre essere fatte in tempo reale)
  if (event.request.url.includes('backendless.com') || event.request.url.includes('googleapis.com')) {
    // Prova a usare la rete, e in caso di fallimento della rete, non serve un fallback
    return fetch(event.request);
  }
  
  // Per tutti gli altri file (HTML, CSS, JS, Assets), usa "Cache First, then Network"
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se il file è in cache, lo restituisce immediatamente
        if (response) {
          return response;
        }
        // Altrimenti, va sulla rete
        return fetch(event.request);
      })
  );
});

// Evento: Attivazione (Pulisce le vecchie cache)
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log(`Service Worker: Eliminazione vecchia cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});