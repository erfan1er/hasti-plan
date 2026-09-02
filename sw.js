/* Hasti Plan — service worker.
   Bump CACHE whenever you change index.html or anything in assets/, otherwise
   phones that already installed the app keep serving the old copy. */
const CACHE = "hastiplan-v1";

/* Relative URLs resolve against the SW's own location, so this keeps working
   when the app is served from a GitHub Pages subpath (/user.github.io/gym-plan/). */
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/fonts/Vazirmatn-var.woff2",
  "./assets/fonts/JetBrainsMono-var.woff2",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/apple-touch-icon.png",
  "./assets/favicon-32.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  /* Navigations go network-first so a redeploy is picked up on the next online
     launch; the cached shell is the offline fallback. */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  /* Everything else (fonts, icons, the manifest): stale-while-revalidate.
     Serve the cached copy instantly so the app stays fast and works offline, but
     always refetch in the background — so a redeploy lands on the next launch
     even if CACHE was not bumped. */
  e.respondWith(
    caches.match(req).then(hit => {
      const fresh = fetch(req).then(res => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || fresh;
    })
  );
});
