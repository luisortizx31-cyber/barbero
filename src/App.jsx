import { useEffect, useState } from 'react'
import Pantalla from './features/Pantalla'
import Sillas from './features/Sillas'
import Historial from './features/Historial'
import Cortes from './features/Cortes'

const PESTANAS = [
  { id: 'pantalla', texto: '💈 Pantalla', Componente: Pantalla },
  { id: 'historial', texto: '💰 Caja', Componente: Historial },
  { id: 'cortes', texto: '✂ Cortes', Componente: Cortes },
  { id: 'sillas', texto: '🪑 Sillas', Componente: Sillas },
]
const CLAVE_PESTANA = 'barberia:pestana'

export default function App() {
  const [pestana, setPestana] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_PESTANA) || 'pantalla'
    } catch {
      return 'pantalla'
    }
  })
  const [completa, setCompleta] = useState(false)

  // Si se sale de pantalla completa con Esc o el botón del celular,
  // vuelve a mostrar las pestañas.
  useEffect(() => {
    const alCambiar = () => {
      if (!document.fullscreenElement) setCompleta(false)
    }
    document.addEventListener('fullscreenchange', alCambiar)
    return () => document.removeEventListener('fullscreenchange', alCambiar)
  }, [])

  function elegir(id) {
    setPestana(id)
    try {
      localStorage.setItem(CLAVE_PESTANA, id)
    } catch {
      // sin localStorage, solo no se recuerda la pestaña
    }
  }

  async function alternarCompleta() {
    if (completa) {
      setCompleta(false)
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
      return
    }
    setCompleta(true)
    await document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const { Componente } = PESTANAS.find((p) => p.id === pestana) ?? PESTANAS[0]

  return (
    <div className="min-h-svh">
      {!completa && (
        <nav className="sticky top-0 z-40 border-b border-linea bg-fondo/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl gap-1 p-2">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => elegir(p.id)}
                aria-current={pestana === p.id ? 'page' : undefined}
                className={`flex-1 rounded-xl px-1 py-2.5 text-xs font-bold sm:text-sm ${pestana === p.id ? 'bg-laton text-fondo' : 'text-tinta-suave'}`}
              >
                {p.texto}
              </button>
            ))}
          </div>
        </nav>
      )}
      <main className={`mx-auto p-4 ${completa ? 'max-w-none sm:p-8' : 'max-w-6xl'}`}>
        {pestana === 'pantalla' || completa ? (
          <Pantalla pantallaCompleta={completa} onPantallaCompleta={alternarCompleta} />
        ) : (
          <Componente />
        )}
      </main>
    </div>
  )
}
