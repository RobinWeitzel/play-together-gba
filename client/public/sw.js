// Pass-through service worker. Exists only to satisfy Chrome on Android's
// installability check (needs a registered SW with a fetch handler) so the
// site can be installed as a real PWA instead of a home-screen bookmark.
// Deliberately no caching — every request hits the network so users always
// get the latest server build, and COOP/COEP headers survive untouched.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intentionally empty: by not calling event.respondWith(), the browser
  // handles the request normally with original response headers intact.
});
