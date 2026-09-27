// VippeDash — service worker: lets the installed app run offline.
// Network first, so a phone that can reach the dev server (USB port forwarding) always gets the latest files;
// without it the fetch fails straight away and the cached copy is used.
// When you add a file the game loads, add it to FILES too.
const CACHE = 'vippedash';
const FILES = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'fonts/LilitaOne-Regular.ttf',
  'js/util.js',
  'js/version.js',
  'js/physics.js',
  'js/level.js',
  'js/solver.js',
  'js/audio.js',
  'js/art.js',
  'js/horror.js',
  'js/render.js',
  'js/game.js',
  'js/mobile.js',
  'js/stats.js',
  'js/leaderboard.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || Response.error()))
  );
});
