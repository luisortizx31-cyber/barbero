import { useEffect, useState } from 'react'
import { useEstado, useSesion } from './data/store'
import Entrar from './features/Entrar'
import Pantalla from './features/Pantalla'
import Citas from './features/Citas'
import Clientes from './features/Clientes'
import Caja from './features/Historial'
import Mas from './features/Mas'
import { SECCIONES_MAS } from './domain/secciones'
import Resumen from './features/Resumen'
import Cortes from './features/Cortes'
import Productos from './features/Productos'
import Sillas from './features/Sillas'
import Ajustes from './features/Ajustes'

const PESTANAS = [
  { id: 'pantalla', icono: '💈', texto: 'Sillas' },
  { id: 'citas', icono: '📅', texto: 'Citas' },
  { id: 'clientes', icono: '👥', texto: 'Clientes' },
  { id: 'caja', icono: '💰', texto: 'Caja' },
  { id: 'mas', icono: '☰', texto: 'Más' },
]

const PANTALLAS = { citas: Citas, clientes: Clientes, caja: Caja, resumen: Resumen, cortes: Cortes, productos: Productos, sillas: Sillas, ajustes: Ajustes }
const CLAVE_PESTANA = 'barberia:pestana'

// Sin sesión: pantalla para entrar. Con sesión, mientras llega la
// barbería de la nube: "Cargando…".
export default function App() {
  const sesion = useSesion()
  const estado = useEstado()
  if (sesion.cargando && !sesion.usuario) return <Cargando texto="Abriendo…" />
  if (!sesion.usuario) return <Entrar />
  if (sesion.error) return <Cargando texto={`No se pudo abrir la barbería: ${sesion.error}`} />
  if (!estado) return <Cargando texto="Cargando la barbería…" />
  return <AppBarberia />
}

function Cargando({ texto }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl" aria-hidden="true">
        💈
      </p>
      <p className="text-tinta-suave">{texto}</p>
    </div>
  )
}

function AppBarberia() {
  const { citas } = useEstado()
  // `vista`: una pestaña, o una sección de "Más" (resumen, cortes...).
  const [vista, setVista] = useState(() => {
    try {
      const v = localStorage.getItem(CLAVE_PESTANA)
      return v === 'historial' ? 'caja' : v || 'pantalla'
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

  function ir(id) {
    setVista(id)
    window.scrollTo(0, 0)
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

  const seccionMas = SECCIONES_MAS.find((s) => s.id === vista)
  const pestanaActiva = seccionMas ? 'mas' : vista
  const Componente = PANTALLAS[vista]
  const hoy = new Date()
  const claveHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  const citasHoy = citas.filter((c) => c.fecha === claveHoy && c.estado === 'pendiente').length

  return (
    <div className="min-h-svh pb-20">
      <main className={`mx-auto p-4 ${completa ? 'max-w-none sm:p-8' : 'max-w-6xl'}`}>
        {seccionMas && !completa && (
          <button type="button" onClick={() => ir('mas')} className="mb-4 rounded-xl border border-linea px-3 py-2 text-sm text-tinta-suave">
            ‹ Más
          </button>
        )}
        {vista === 'pantalla' || completa ? (
          <Pantalla pantallaCompleta={completa} onPantallaCompleta={alternarCompleta} />
        ) : vista === 'mas' ? (
          <Mas onIr={ir} />
        ) : Componente ? (
          <Componente />
        ) : (
          <Pantalla pantallaCompleta={false} onPantallaCompleta={alternarCompleta} />
        )}
      </main>

      {/* Pestañas abajo, a mano del pulgar */}
      {!completa && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-linea bg-fondo/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto flex max-w-2xl">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => ir(p.id)}
                aria-current={pestanaActiva === p.id ? 'page' : undefined}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${pestanaActiva === p.id ? 'text-laton' : 'text-tinta-suave'}`}
              >
                <span className="text-xl leading-none">{p.icono}</span>
                {p.texto}
                {p.id === 'citas' && citasHoy > 0 && (
                  <span className="absolute right-[22%] top-1 rounded-full bg-ocupada px-1.5 text-[10px] leading-4 text-white">{citasHoy}</span>
                )}
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
