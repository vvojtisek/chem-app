const CACHE_PREFIX = "inorganic-shell-";
const CACHE_NAME = "inorganic-shell-v3";
const APP_SHELL = ["/", "/procvicovani/nazvoslovi", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      const page = await cache.match("/procvicovani/nazvoslovi");
      if (!page) throw new Error("The nomenclature offline route was not cached.");
      const html = await page.text();
      const assets = new Set(
        Array.from(html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g), (match) => match[1]),
      );
      await cache.addAll([...assets]);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }
        if (request.mode === "navigate") {
          const shell = await caches.match("/");
          if (shell) {
            return shell;
          }
        }
        return Response.error();
      }),
  );
});
