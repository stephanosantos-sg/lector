const CACHE = 'lector-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Network-only for article extraction.
  if (url.hostname === 'r.jina.ai') return;

  // Firestore/auth traffic must never be intercepted.
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('firebaseapp.com')) return;

  const cacheable = e.request.method === 'GET' &&
    (url.origin === location.origin || url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'www.gstatic.com');

  // Network-first for pages and same-origin files so updates land right away;
  // cache is the offline fallback. CDN libs stay cache-first (versioned URLs).
  if (e.request.mode === 'navigate' || url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (cacheable && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
      if (cacheable && resp.ok) {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return resp;
    }))
  );
});
