/* Deliberately minimal. Every page here is server-rendered per session
   and RLS-scoped to whoever is signed in -- caching HTML or API responses
   would risk serving one person's club/roster data back to someone else
   from a stale cache, or showing stale data after a real change. This
   exists only to satisfy PWA installability (a registered service worker
   with a fetch handler); it deliberately caches nothing dynamic.

   /t/* and /platformconsole are proxied to a different app entirely
   (next.config.js rewrites) -- explicitly left untouched here rather than
   risking this worker's scope bleeding into a route it doesn't own. The
   old integration proposal's service worker had exactly this bug (its
   scope intercepted /t/* against its own footnote) -- see CLAUDE.md §7. */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/t/') || url.pathname === '/platformconsole') {
    return;
  }
  event.respondWith(fetch(event.request));
});
