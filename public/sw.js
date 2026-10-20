// Service worker para instalar la app en el celular (pedido del usuario,
// 2026-10-20). Guarda la app (no los datos: esos vienen de Firebase) para
// que abra rápido:
//   - la página: primero de internet (para tener siempre la última
//     versión publicada); sin internet, la guardada.
//   - los archivos con huella en el nombre (assets/index-XXXX.js): una vez
//     bajados no cambian, se sirven de lo guardado.
const CACHE = 'barberia-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Firebase y todo lo de afuera: directo, sin guardar.
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put('./', copia))
          return res
        })
        .catch(() => caches.match('./'))
    )
    return
  }

  e.respondWith(
    caches.match(req).then(
      (guardado) =>
        guardado ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copia = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copia))
          }
          return res
        })
    )
  )
})
