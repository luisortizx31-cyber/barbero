import { useEffect, useState } from 'react'
import { useEstado, useSesion, salir } from './data/store'
import Entrar from './features/Entrar'
import Plataforma from './features/Plataforma'
import Local from './features/Local'
import SoyBarbero from './features/SoyBarbero'
import Barberos from './features/Barberos'
import { FotoBarbero } from './ui/FotoBarbero'
import { FormBarbero } from './features/Barberos'
import { Hoja } from './ui/Hoja'
import { BotonSalirBarberia } from './ui/SalirBarberia'
import { irAlInicio } from './data/inicio'
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

const PANTALLAS = { citas: Citas, clientes: Clientes, caja: Caja, resumen: Resumen, cortes: Cortes, productos: Productos, sillas: Sillas, ajustes: Ajustes, barberos: Barberos }
const CLAVE_PESTANA = 'barberia:pestana'

// Quién entra (ver leerRuta en store.js):
//   clientes  (#/local/{id})     -> si hay sitio y quién corta, solo ver
//   televisor (#/pantalla/{id})  -> solo las sillas, sin botones
//   barberos  (#/barbero/{id})   -> las sillas: ocupar y cobrar
//   Luis (plataforma)            -> las barberías
//   dueño                        -> su barbería completa
export default function App() {
  const sesion = useSesion()
  const estado = useEstado()
  if (sesion.error) return <Cargando texto={sesion.error} accion={sesion.modo === 'panel' && Boolean(sesion.usuario)} alInicio={sesion.modo !== 'panel'} />
  if (sesion.modo === 'panel') {
    if (sesion.cargando && !sesion.usuario) return <Cargando texto="Abriendo…" />
    if (!sesion.usuario) return <Entrar />
    if (sesion.rol === 'super') return <Plataforma />
  }
  if (!estado) return <Cargando texto="Cargando la barbería…" />
  if (sesion.modo === 'local') return <Local />
  if (sesion.modo === 'pantalla') return <SoloPantalla soloVer />
  if (sesion.modo === 'barbero') return <AppBarbero barberiaId={sesion.barberiaId} />
  return <AppBarberia />
}

// Enlace de los barberos: primero "¿quién eres?" (queda recordado en su
// celular), después la pantalla de sillas con su foto arriba.
function AppBarbero({ barberiaId }) {
  const { barberos } = useEstado()
  const clave = `barberia:yo:${barberiaId}`
  const [yoId, setYoId] = useState(() => {
    try {
      return localStorage.getItem(clave)
    } catch {
      return null
    }
  })
  const [editando, setEditando] = useState(false)
  const yo = barberos.find((b) => b.id === yoId)

  function elegir(id) {
    setYoId(id)
    try {
      if (id) localStorage.setItem(clave, id)
      else localStorage.removeItem(clave)
    } catch {
      // sin localStorage, se pregunta cada vez
    }
  }

  if (!yo) return <SoyBarbero onElegir={elegir} />
  return (
    <>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-4">
        <button type="button" onClick={() => setEditando(true)} aria-label="Mi foto y mis datos">
          <FotoBarbero barbero={yo} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold">Hola, {yo.nombre.split(' ')[0]} ✂</p>
          <span className="flex flex-wrap gap-x-3">
            <button type="button" onClick={() => elegir(null)} className="text-xs text-tinta-suave underline decoration-dotted">
              No soy yo
            </button>
            <BotonSalirBarberia />
          </span>
        </div>
      </div>
      <SoloPantalla barberoYo={yo.id} />
      {editando && (
        <Hoja titulo="Mis datos" onCerrar={() => setEditando(false)}>
          <FormBarbero barbero={yo} onListo={() => setEditando(false)} />
        </Hoja>
      )}
    </>
  )
}

// Televisor y barberos: solo la pantalla de sillas, sin pestañas.
function SoloPantalla({ soloVer, barberoYo }) {
  const [completa, setCompleta] = useState(false)
  async function alternar() {
    if (completa) {
      setCompleta(false)
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
      return
    }
    setCompleta(true)
    await document.documentElement.requestFullscreen?.().catch(() => {})
  }
  return (
    <main className={`mx-auto p-4 ${completa ? 'max-w-none sm:p-8' : 'max-w-6xl'}`}>
      <Pantalla pantallaCompleta={completa || soloVer} enCompleta={completa} soloVer={soloVer} conCitas={false} onPantallaCompleta={alternar} barberoYo={barberoYo} />
      {soloVer && !completa && (
        <p className="mt-6 text-center">
          <BotonSalirBarberia />
        </p>
      )}
    </main>
  )
}

function Cargando({ texto, accion, alInicio }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl" aria-hidden="true">
        💈
      </p>
      <p className="text-tinta-suave">{texto}</p>
      {accion && (
        <button type="button" onClick={() => salir()} className="rounded-xl border border-linea px-4 py-2 text-sm text-tinta-suave">
          Salir de la cuenta
        </button>
      )}
      {alInicio && (
        <button type="button" onClick={irAlInicio} className="rounded-xl border border-linea px-4 py-2 text-sm text-tinta-suave">
          Ir al inicio
        </button>
      )}
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
  // Citas que esperan que se acepten o rechacen (de hoy en adelante).
  const porAceptar = citas.filter((c) => c.estado === 'pendiente' && c.fecha >= claveHoy).length

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
                {p.id === 'citas' && porAceptar > 0 && (
                  <span className="absolute right-[22%] top-1 rounded-full bg-ocupada px-1.5 text-[10px] leading-4 text-white">{porAceptar}</span>
                )}
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
