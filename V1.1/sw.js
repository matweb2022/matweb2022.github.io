const CACHE_NAME = "floor-tracker-v3";

const APP_SHELL = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./maps/factory.jpg",
    "./maps/assembly.jpg",
    "./maps/welding.jpg"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") {
        return;
    }

    const url = new URL(event.request.url);

    if (
        url.pathname.startsWith("/api/") ||
        url.pathname.startsWith("/uploads/") ||
        url.pathname.startsWith("/plans/")
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (
                    response &&
                    response.status === 200 &&
                    response.type === "basic"
                ) {
                    const responseCopy = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(event.request, responseCopy));
                }

                return response;
            })
            .catch(() => {
                return caches.match(event.request)
                    .then(cached => cached || caches.match("./index.html"));
            })
    );
});
