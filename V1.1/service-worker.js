const CACHE_NAME = "floor-tracker-v7";

const APP_SHELL = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json"
];


// ============================================================
// INSTALL
// ============================================================

self.addEventListener("install", event => {

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
    );

    self.skipWaiting();
});


// ============================================================
// ACTIVATE
// ============================================================

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys().then(keys => {

            return Promise.all(

                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))

            );

        })

    );

    self.clients.claim();
});


// ============================================================
// FETCH
// ============================================================

self.addEventListener("fetch", event => {

    // Only handle GET requests.
    if (event.request.method !== "GET") {
        return;
    }

    const url = new URL(event.request.url);


    // --------------------------------------------------------
    // Server files should always come from the server.
    // This includes:
    //
    // /api/files
    // /uploads/...
    // /plans/...
    //
    // We don't want the PWA caching an old floor plan.
    // --------------------------------------------------------

    if (
        url.pathname.startsWith("/api/") ||
        url.pathname.startsWith("/uploads/") ||
        url.pathname.startsWith("/plans/")
    ) {
        return;
    }


    // --------------------------------------------------------
    // App shell:
    // Cache first, then network.
    // --------------------------------------------------------

    event.respondWith(

        caches.match(event.request)
            .then(cachedResponse => {

                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then(networkResponse => {

                        // Only cache normal successful responses.
                        if (
                            networkResponse &&
                            networkResponse.status === 200 &&
                            networkResponse.type === "basic"
                        ) {

                            const responseCopy =
                                networkResponse.clone();

                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(
                                        event.request,
                                        responseCopy
                                    );
                                });
                        }

                        return networkResponse;
                    });

            })
    );
});