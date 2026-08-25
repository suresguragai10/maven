// Maven Work Desk — PWA V1 service worker (see docs/PRODUCT_BOUNDARIES.md
// "PWA V1 scope"): install-first and online-first only. Every request,
// including Supabase API calls, static assets, and the app shell itself,
// still passes straight through to the network unmodified -- the one
// deliberate exception is offline.html, a single static, unauthenticated
// page cached solely so a lost connection shows a friendly message
// instead of the browser's own offline error page. This does not make the
// app usable offline (no data, no navigation beyond that one page); it
// only replaces a broken-feeling failure with an honest one. Offline
// editing, offline mutation, background sync, and any caching of
// authenticated Supabase/client/attendance/Work Desk data remain
// explicitly out of V1 scope and must not be added here without that
// document being updated first.

var CACHE_NAME = 'maven-work-desk-offline-v1';
var OFFLINE_URL = '/staff/offline.html';

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.add(OFFLINE_URL);
    })
  );
  // Move to "activated" immediately rather than waiting for every open tab
  // to close first -- there is no other cached app state to protect by
  // waiting.
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  // Drop any cache from a previous service-worker version so an edited
  // offline.html can never be served stale indefinitely.
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (name) { return name !== CACHE_NAME; }).map(function (name) { return caches.delete(name); })
      );
    })
  );
});

// Deliberately NOT calling clients.claim() here. A service worker only
// controls pages loaded AFTER it becomes active by default -- an already-
// open tab keeps running uncontrolled until its next real navigation/
// reload. clients.claim() would override that and seize control of
// already-open pages mid-session, which (confirmed empirically while
// building this) breaks anything that intercepts this app's own network
// requests at the page level, since a page-controlling service worker's
// own fetch() calls run in a separate execution context. Skipping it also
// means a signed-in session already in progress is never disrupted by a
// new service worker version taking over underneath it.

self.addEventListener('fetch', function (event) {
  // Only page navigations get the offline fallback -- API calls, scripts,
  // and other sub-resources still fail exactly as before if the network is
  // unreachable, so nothing about the "never serves stale/authenticated
  // data from a cache" guarantee changes.
  if (event.request.mode === 'navigate') {
    console.log('[sw-debug] navigate fetch for', event.request.url);
    event.respondWith(
      fetch(event.request).then(function (r) {
        console.log('[sw-debug] network fetch succeeded', r.status);
        return r;
      }).catch(function (err) {
        console.log('[sw-debug] network fetch failed, falling back:', err && err.message);
        return caches.match(OFFLINE_URL).then(function (cached) {
          console.log('[sw-debug] cache match result:', !!cached, cached && cached.status);
          return cached;
        });
      })
    );
    return;
  }
  // Explicit network passthrough for everything else -- never served from
  // a cache, so this can never accidentally return stale app code or
  // stale/authenticated API data.
  event.respondWith(fetch(event.request));
});
