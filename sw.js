
const CACHE_NAME = "gojak-techops-ui-v5";

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
  "./js/icons.js",
  "./js/dashboard.js",
  "./js/inventory.js",
  "./js/maintenance.js",
  "./js/hardware.js",
  "./icons/app-icon.svg",
  "./icons/ui.svg"
];

// INSTALL
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key =>
            key.startsWith("gojak-techops-ui-") &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH - NETWORK FIRST
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Jangan mengganggu API eksternal.
  if (url.origin !== self.location.origin) return;

  // Navigasi halaman.
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
            .then(cached => cached || Response.error())
        )
    );

    return;
  }

  // File CSS, JS, icon, dan file aplikasi.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, copy));
        }

        return response;
      })
      .catch(() =>
        caches.match(request)
          .then(cached => cached || Response.error())
      )
  );
});
