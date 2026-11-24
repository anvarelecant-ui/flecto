const ROOT = new URL("./",self.location.href).pathname;
const PREFIX="flecto-shell-"+ROOT+"-";
const CACHE=PREFIX+"v2";
self.addEventListener("install", (e) =>
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      const r = await fetch(ROOT);
      if (!r.ok) throw Error("shell");
      const text = await r.clone().text();
      await c.put(ROOT, r);
      const paths = [
        ...text.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g),
      ].map((m) => m[1].replaceAll("&amp;", "&"));
      await c.addAll([
        ...new Set([...paths, ROOT+"icon.svg", ROOT+"manifest.webmanifest"]),
      ]);
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys())
        if (k.startsWith(PREFIX) && k !== CACHE)
          await caches.delete(k);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || !u.pathname.startsWith(ROOT)) return;
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match(ROOT)));
    return;
  }
  if (
    !/^\/(?:_next\/static\/|engines\/|codec-worker\.js$|icon\.svg$)/.test(
      "/"+u.pathname.slice(ROOT.length),
    )
  )
    return;
  e.respondWith(
    (async () => {
      const c = await caches.open(CACHE),
        hit = await c.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) await c.put(e.request, r.clone());
      return r;
    })(),
  );
});
