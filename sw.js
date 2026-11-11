const CACHE = 'daniel-calc-v5';
const EXTRA = ['./manifest.json', './icon-192.png', './icon-512.png'];
const OFFLINE_HTML = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="font-family:sans-serif;padding:32px;color:#1a6b7a"><h2>Not saved for offline yet</h2><p>Open this calculator once while online and wait for “Ready for offline use ✓”. After that it opens without internet.</p>';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // The page itself must be saved; if this fails the install fails and retries next visit.
    const res = await fetch(new Request('./index.html', { cache: 'reload' }));
    if (!res.ok) throw new Error('index.html ' + res.status);
    await c.put('./index.html', res.clone());
    await c.put('./', res);
    // Icons and manifest are nice-to-have: one missing file never blocks offline use.
    await Promise.all(EXTRA.map(u =>
      fetch(new Request(u, { cache: 'reload' })).then(r => r.ok && c.put(u, r)).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return; // currency API etc. handled by the app

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = (await c.match(req, { ignoreSearch: true })) || (await c.match('./index.html'));
      const update = fetch(req).then(r => { if (r.ok) c.put('./index.html', r.clone()); return r; }).catch(() => null);
      if (hit) { e.waitUntil(update); return hit; }
      return (await update) || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    })());
    return;
  }

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: true });
    const update = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(update); return hit; }
    return (await update) || new Response('', { status: 504 });
  })());
});
