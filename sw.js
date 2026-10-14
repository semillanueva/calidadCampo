/* Service worker de Verificación de Siembra (sitio propio).
   Guarda la página y sus librerías en el teléfono para que abra sin
   internet. Va en la raíz del repositorio, junto a index.html.

   Al cambiar index.html no hace falta tocar este archivo: con internet
   siempre se baja la versión nueva. Cambia VERSION solo si cambias la lista
   de librerías. */
const VERSION = 'siembracampo-v1';

const BASE = self.registration.scope;              // https://semillanueva.github.io/SiembraCampo/
const PAGINA = new URL('index.html', BASE).href;
const PROPIOS = [PAGINA, new URL('manifest.webmanifest', BASE).href, new URL('icon.svg', BASE).href];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    const c = await caches.open(VERSION);
    // Uno por uno: si falta el ícono, la página y las librerías se guardan igual.
    await Promise.all([...PROPIOS, ...LIBS].map(async u => {
      try { const r = await fetch(u, { cache: 'reload' }); if (r.ok) await c.put(u, r); }
      catch (e) { /* sin red al instalar: se reintenta en la próxima visita */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    // Solo borra versiones viejas de ESTE sitio; no toca cachés de otras apps.
    for (const k of await caches.keys()) if (k !== VERSION && k.startsWith('siembracampo-')) await caches.delete(k);
    await self.clients.claim();
  })());
});

const sinQuery = u => { const x = new URL(u); return x.origin + x.pathname; };

// Red primero con tiempo límite: con señal débil no se queda colgado esperando.
async function redPrimero(req, clave) {
  const c = await caches.open(VERSION);
  try {
    const r = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('lento')), 3500))
    ]);
    if (r && r.ok) c.put(clave, r.clone());
    return r;
  } catch (e) {
    const g = await c.match(clave);
    if (g) return g;
    throw e;
  }
}
// Las librerías tienen la versión en la URL y no cambian: caché primero.
async function cachePrimero(req) {
  const c = await caches.open(VERSION);
  const g = await c.match(req.url);
  if (g) return g;
  const r = await fetch(req);
  if (r && (r.ok || r.type === 'opaque')) c.put(req.url, r.clone());
  return r;
}

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const u = sinQuery(req.url);
  if (LIBS.includes(req.url)) { ev.respondWith(cachePrimero(req)); return; }
  // La página abre igual como .../SiembraCampo/ o .../SiembraCampo/index.html
  if (u === PAGINA || u === BASE) { ev.respondWith(redPrimero(req, PAGINA)); return; }
  if (PROPIOS.includes(u)) { ev.respondWith(redPrimero(req, u)); return; }
});