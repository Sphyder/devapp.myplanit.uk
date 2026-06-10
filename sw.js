const CACHE = 'survey-devapp-v1.0.0';
const SHELL = [
    '/',
    '/styles.css',
    '/app.js',
    '/db.js',
    '/sync.js',
    '/manifest.json',
    '/favicon.ico',
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    const { request } = e;
    const url = new URL(request.url);

    // Only handle same-origin GET requests
    if (request.method !== 'GET') return;

    // API calls: network first, cache fallback
    if (url.pathname.startsWith('/api/')) {
        e.respondWith(
            fetch(request).then(resp => {
                if (resp.ok) {
                    const clone = resp.clone();
                    caches.open(CACHE).then(c => c.put(request, clone));
                }
                return resp;
            }).catch(() => caches.match(request).then(r => r || new Response('{"error":"offline"}', {
                headers: { 'Content-Type': 'application/json' }
            })))
        );
        return;
    }

    // App shell: cache first, network fallback
    if (url.pathname === '/' || url.pathname.startsWith('/icons/') || url.pathname.match(/\.(js|css|json|png)$/)) {
        e.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached;
                return fetch(request).then(resp => {
                    if (resp.ok) {
                        const clone = resp.clone();
                        caches.open(CACHE).then(c => c.put(request, clone));
                    }
                    return resp;
                });
            })
        );
    }
});
