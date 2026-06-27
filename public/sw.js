// Kill-switch service worker.
//
// This app ships NO service worker of its own. This file exists ONLY to evict a
// stale/orphaned service worker that a previous app (or an older build) may have
// registered on this origin (e.g. localhost:3000). Such an orphan intercepts
// Next.js navigation/RSC requests and serves cached or mangled responses — which
// shows up as a raw RSC flight payload or a page that "renders but never starts".
//
// When the browser re-checks the registered /sw.js script, it picks up THIS file,
// which immediately unregisters itself, deletes all caches, and reloads open tabs.
// After it runs once, the origin is clean and no service worker controls the page.

self.addEventListener('install', () => {
  // Activate immediately instead of waiting for existing clients to close.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache the orphan may have populated.
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      } catch {
        // caches API may be unavailable; ignore.
      }

      // Remove this (and thus the orphaned) registration.
      try {
        await self.registration.unregister()
      } catch {
        // ignore
      }

      // Reload any open tabs so they fetch fresh, uncontrolled responses.
      try {
        const clients = await self.clients.matchAll({ type: 'window' })
        for (const client of clients) {
          if ('navigate' in client) client.navigate(client.url)
        }
      } catch {
        // ignore
      }
    })(),
  )
})

// Never intercept fetches — pass everything straight to the network.
self.addEventListener('fetch', () => {})
