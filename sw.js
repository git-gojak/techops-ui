
const CACHE_NAME = "gojak-techops-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./api.js",

  "./css/tokens.css",
  "./css/reset.css",
  "./css/typography.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/modals.css",
  "./css/dashboard.css",
  "./css/responsive.css",

  "./js/app.js",
  "./js/auth.js",
  "./js/dashboard.js",

  "./icons/app-icon.svg"
];

// =====================================================
// INSTALL
// =====================================================

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// =====================================================
// ACTIVATE
// =====================================================

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// =====================================================
// FETCH
// =====================================================

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Jangan mengganggu API Google Apps Script
  // atau permintaan ke domain eksternal.
  if (url.origin !== self.location.origin) return;

  // Navigasi halaman: utamakan jaringan,
  // gunakan cache jika sedang offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => cache.put("./index.html", copy));
          }

          return response;
        })
        .catch(() =>
          caches.match("./index.html")
        )
    );

    return;
  }

  // File lokal: cache terlebih dahulu.
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;

        return fetch(request).then(response => {
          if (
            response &&
            response.ok &&
            response.type === "basic"
          ) {
            const copy = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, copy));
          }

          return response;
        });
      })
  );
});
