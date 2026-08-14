const CACHE_PAGINAS = "paginas-v1";
const CACHE_ESTATICOS = "estaticos-v1";
const CACHE_IMAGENES = "imagenes-v2";
const CACHES_ACTUALES = [CACHE_PAGINAS, CACHE_ESTATICOS, CACHE_IMAGENES];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) => Promise.all(nombres.filter((n) => !CACHES_ACTUALES.includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Imágenes generadas: el nombre de archivo es inmutable, cache-first.
  // Esta comprobación va SIEMPRE antes que la de /api/ a secas.
  if (url.pathname.startsWith("/api/imagen/")) {
    evento.respondWith(cachePrimero(request, CACHE_IMAGENES));
    return;
  }

  // Datos vivos: historial, generación, estado, etc. Nunca se cachean, ni se lee
  // ni se escribe en Cache Storage para esta rama.
  if (url.pathname.startsWith("/api/")) {
    evento.respondWith(fetch(request));
    return;
  }

  // Navegación entre páginas: red primero, cache como respaldo sin conexión.
  if (request.mode === "navigate") {
    evento.respondWith(redPrimero(request, CACHE_PAGINAS));
    return;
  }

  // Assets estáticos de Next: stale-while-revalidate.
  if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(revalidarEnSegundoPlano(request, CACHE_ESTATICOS));
    return;
  }
});

async function cachePrimero(request, nombreCache) {
  const cache = await caches.open(nombreCache);
  const enCache = await cache.match(request);
  if (enCache) return enCache;

  const respuesta = await fetch(request);
  if (respuesta.ok) cache.put(request, respuesta.clone());
  return respuesta;
}

async function redPrimero(request, nombreCache) {
  const cache = await caches.open(nombreCache);
  try {
    const respuesta = await fetch(request);
    if (respuesta.ok) cache.put(request, respuesta.clone());
    return respuesta;
  } catch {
    const enCache = await cache.match(request);
    return enCache || Response.error();
  }
}

async function revalidarEnSegundoPlano(request, nombreCache) {
  const cache = await caches.open(nombreCache);
  const enCache = await cache.match(request);

  const actualizacion = fetch(request)
    .then((respuesta) => {
      if (respuesta.ok) cache.put(request, respuesta.clone());
      return respuesta;
    })
    .catch(() => enCache);

  return enCache || actualizacion;
}
