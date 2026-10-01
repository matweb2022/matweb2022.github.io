const CACHE = "floor-tracker-v12";

const ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json"
];


self.addEventListener("install", event => {

    event.waitUntil(
        caches.open(CACHE).then(cache => {
            return cache.addAll(ASSETS);
        })
    );

    self.skipWaiting();
});


self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys().then(keys => {

            return Promise.all(

                keys
                    .filter(key => key !== CACHE)
                    .map(key => caches.delete(key))

            );

        })

    );

    self.clients.claim();
});


self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith(

        caches.match(event.request).then(cachedResponse => {

            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then(response => {

                if (
                    response &&
                    response.status === 200 &&
                    response.type === "basic"
                ) {

                    const copy = response.clone();

                    caches.open(CACHE).then(cache => {
                        cache.put(event.request, copy);
                    });

                }

                return response;

            });

        })

    );

});