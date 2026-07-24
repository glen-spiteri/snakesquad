// Offline support for the installed app.
//
// Deliberately NETWORK-FIRST: a stale cache silently serving old study code to a
// participant mid-run would be worse than a slow load. Online, everyone always
// gets the version currently on GitHub Pages; the cache is only a fallback for
// when the phone has no signal. Nothing here ever sends data anywhere.

const CACHE = 'snakesquad-v1';

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/main.js',
  './js/state.js',
  './js/log.js',
  './js/dom.js',
  './js/game/models.js',
  './js/game/bot.js',
  './js/game/engine.js',
  './js/game/container.js',
  './js/screens/title.js',
  './js/screens/consent.js',
  './js/screens/terms.js',
  './js/screens/name.js',
  './js/screens/survey.js',
  './js/screens/coopIntro.js',
  './js/screens/invite.js',
  './js/screens/location.js',
  './js/screens/debrief.js',
  './js/screens/researcher.js',
  './js/content/surveyItems.js',
  './js/content/privacyPolicy.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Individually, so one bad path can't fail the whole install.
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html')))
  );
});
