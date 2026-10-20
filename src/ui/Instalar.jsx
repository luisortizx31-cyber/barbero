import { useSyncExternalStore } from 'react'

// Instalar la app en el celular (pedido del usuario, 2026-10-20). En
// Android/Chrome el navegador avisa una sola vez, al abrir la página, que
// se puede instalar (beforeinstallprompt): se guarda ese aviso para usarlo
// cuando toquen el botón. En iPhone no hay aviso: se explica cómo hacerlo
// desde Safari. Abierta ya como app, el botón no sale; si ya está
// instalada (Chrome lo dice con getInstalledRelatedApps, ver
// related_applications en el manifiesto), se dice dónde buscarla.
let aviso = null
let instalada = false
const oyentes = new Set()
const cambio = () => oyentes.forEach((fn) => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    aviso = e
    cambio()
  })
  window.addEventListener('appinstalled', () => {
    aviso = null
    instalada = true
    cambio()
  })
  navigator.getInstalledRelatedApps?.()
    .then((apps) => {
      instalada = apps.length > 0
      cambio()
    })
    .catch(() => {})
}

function suscribir(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

const comoApp = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
const esIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

export function BotonInstalar({ className = '' }) {
  const avisoActual = useSyncExternalStore(suscribir, () => aviso)
  const yaInstalada = useSyncExternalStore(suscribir, () => instalada)
  if (comoApp()) return null

  if (yaInstalada && !avisoActual) {
    return (
      <p className={`rounded-2xl border border-libre/60 bg-libre-suave px-4 py-3 text-center text-sm ${className}`}>
        ✓ Ya tienes la app instalada. Búscala como <span className="font-bold">«Barbería»</span> (tijeras doradas) en tu pantalla de inicio o en tus aplicaciones.
      </p>
    )
  }

  if (avisoActual) {
    return (
      <button
        type="button"
        onClick={async () => {
          avisoActual.prompt()
          await avisoActual.userChoice
          aviso = null
          cambio()
        }}
        className={`w-full rounded-2xl border-2 border-laton bg-laton-suave py-3.5 font-extrabold text-laton ${className}`}
      >
        📲 Instalar la app en mi celular
      </button>
    )
  }

  if (esIphone()) {
    return (
      <p className={`rounded-2xl border border-linea bg-panel px-4 py-3 text-center text-sm text-tinta-suave ${className}`}>
        📲 Para instalarla: en Safari toca <span className="font-bold">Compartir</span> (el cuadrito con la flecha) y luego <span className="font-bold">«Agregar a inicio»</span>.
      </p>
    )
  }

  return (
    <p className={`rounded-2xl border border-linea bg-panel px-4 py-3 text-center text-sm text-tinta-suave ${className}`}>
      📲 Para instalarla: abre el menú del navegador (⋮) y toca <span className="font-bold">«Instalar app»</span> o <span className="font-bold">«Agregar a pantalla principal»</span>. Si te dice que ya está instalada, búscala como <span className="font-bold">«Barbería»</span> en tus aplicaciones.
    </p>
  )
}
