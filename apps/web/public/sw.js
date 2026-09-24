const CACHE_PREFIX = "inorganic-shell-";
const CACHE_NAME = "inorganic-shell-v5";
const APP_SHELL = [
  "/",
  "/procvicovani",
  "/procvicovani/nazvoslovi",
  "/procvicovani/periodicka-tabulka",
  "/procvicovani/periodicka-tabulka/nazvy",
  "/procvicovani/prvky",
  "/procvicovani/rovnice",
  "/uceni/prvky",
  "/uceni/priprava-vyroba",
  "/pokrok",
  "/flashcards/prvky",
  "/manifest.webmanifest",
];
const CACHEABLE_PAGES = new Set(APP_SHELL.filter((path) => path !== "/manifest.webmanifest"));

function isPublicCacheableResponse(response, pathname) {
  const policy = response.headers.get("cache-control") ?? "";
  return (
    response.ok &&
    response.type === "basic" &&
    !response.redirected &&
    new URL(response.url).pathname === pathname &&
    !response.headers.has("set-cookie") &&
    !/(?:private|no-store)/iu.test(policy)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const allPageAssets = new Set();
      for (const path of APP_SHELL) {
        const response = await fetch(path, { credentials: "same-origin", redirect: "manual" });
        if (!isPublicCacheableResponse(response, path)) throw new Error(`Cannot cache ${path}`);
        if (path !== "/manifest.webmanifest") {
          const html = await response.clone().text();
          for (const reference of html.matchAll(/(?:src|href)="[^"]+"/g)) {
            const asset = reference[0].slice(reference[0].indexOf('="') + 2, -1);
            if (asset.startsWith("/_next/static/")) allPageAssets.add(asset);
          }
        }
        await cache.put(path, response);
      }
      await cache.addAll([...allPageAssets]);
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
    url.pathname.startsWith("/api/") ||
    url.pathname === "/login" ||
    (!url.pathname.startsWith("/_next/static/") &&
      !CACHEABLE_PAGES.has(url.pathname) &&
      url.pathname !== "/manifest.webmanifest" &&
      url.pathname !== "/icon.svg")
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (isPublicCacheableResponse(response, url.pathname)) {
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
        if (request.mode === "navigate" && CACHEABLE_PAGES.has(url.pathname)) {
          const shell = await caches.match("/");
          if (shell) {
            return shell;
          }
        }
        return Response.error();
      }),
  );
});
