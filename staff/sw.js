// Maven Work Desk — PWA V1 service worker (see docs/PRODUCT_BOUNDARIES.md
// "PWA V1 scope"): install-first and online-first only. This worker
// deliberately caches NOTHING -- every request, including Supabase API
// calls, static assets, and the app shell itself, passes straight through
// to the network unmodified. Offline editing, offline mutation, background
// sync, and any caching of authenticated Supabase/client/attendance/Work
// Desk data are explicitly out of V1 scope and must not be added here
// without that document being updated first.
//
// The only reason this file exists at all is that browsers require a
// registered service worker with a fetch handler before they'll offer to
// install the app to a home screen/desktop -- it exists to satisfy that
// requirement, not to provide offline behavior.

self.addEventListener('install', function (event) {
  // Move to "activated" immediately rather than waiting for every open tab
  // to close first -- there is no cached app state to protect by waiting,
  // since this worker never caches anything.
  self.skipWaiting();
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
  // Explicit network passthrough -- never served from a cache, so this
  // can never accidentally return stale app code or stale/authenticated
  // API data. If this handler were removed entirely, Chrome would refuse
  // to consider the app installable; that is its only job.
  event.respondWith(fetch(event.request));
});
