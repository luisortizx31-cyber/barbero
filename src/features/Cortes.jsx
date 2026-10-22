import { useState } from 'react'
import { useEstado, agregarServicio, guardarServicio, eliminarServicio } from '../data/store'
import { duracionDe } from '../domain/horario'
import { formatearMonto } from '../domain/dinero'
import { FotoCorte, SubirFotoCorte } from '../ui/FotoCorte'
import { Hoja } from '../ui/Hoja'
import { Aviso } from '../ui/Aviso'
import { useAviso } from '../ui/useAviso'

// Los cortes y servicios del local con su precio y cuánto duran: se
// eligen al ocupar una silla y al cobrarla, y la duración sirve para la
// espera estimada y para las horas libres de las citas.
// La lista muestra solo los cortes; al tocar uno se abre su ficha con el
// precio, la duración y la foto (cámara o galería) para cambiarlos.
// Agregar uno abre su formulario en una ventana ahí mismo y al guardarlo
// avisa "Corte agregado" y lo resalta en la lista (pedidos del usuario,
// 2026-10-22).
export default function Cortes() {
  const { servicios } = useEstado()
  const [agregando, setAgregando] = useState(false)
  const [abierto, setAbierto] = useState(null) // id del corte con su ficha abierta
  // El aviso de abajo; mientras dura, el corte agregado o cambiado
  // queda resaltado.
  const { aviso, avisar, resaltado: nuevoId } = useAviso()

  function agregado(servicio) {
    setAgregando(false)
    avisar(`✓ Corte agregado: ${servicio.nombre} · ${formatearMonto(servicio.precio)}`, servicio.id)
  }

  const corteAbierto = servicios.find((x) => x.id === abierto)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Cortes y precios</h2>
          <p className="text-sm text-tinta-suave">Se eligen al ocupar una silla, al cobrar y al reservar cita. Lo que dura cada corte sirve para calcular la espera y las horas libres.</p>
        </div>
        <button type="button" onClick={() => setAgregando(true)} className="shrink-0 rounded-xl bg-laton px-4 py-2.5 text-sm font-bold text-fondo">
          + Agregar corte
        </button>
      </div>

      <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-panel">
        {servicios.map((x) => (
          <li key={x.id}>
            <button
              type="button"
              onClick={() => setAbierto(x.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-700 active:bg-panel-2 ${x.id === nuevoId ? 'bg-libre-suave' : ''}`}
            >
              <FotoCorte servicio={x} tam="h-12 w-12" />
              <span className="min-w-0 flex-1 truncate font-bold">{x.nombre}</span>
              <span className="shrink-0 text-xl text-tinta-suave" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        ))}
        {servicios.length === 0 && (
          <li className="p-6 text-center text-tinta-suave">
            Todavía no hay cortes.{' '}
            <button type="button" onClick={() => setAgregando(true)} className="font-bold text-laton underline decoration-dotted">
              Agrega el primero
            </button>
          </li>
        )}
      </ul>

      {agregando && (
        <Hoja titulo="Agregar corte o servicio" onCerrar={() => setAgregando(false)}>
          <FormNuevoCorte onAgregado={agregado} />
        </Hoja>
      )}

      {corteAbierto && (
        <Hoja titulo={corteAbierto.nombre} onCerrar={() => setAbierto(null)}>
          <FichaCorte
            key={corteAbierto.id}
            servicio={corteAbierto}
            onGuardado={() => {
              setAbierto(null)
              avisar('✓ Cambios guardados', corteAbierto.id)
            }}
            onQuitado={() => {
              setAbierto(null)
              avisar(`Se quitó ${corteAbierto.nombre}`)
            }}
          />
        </Hoja>
      )}

      <Aviso aviso={aviso} />
    </div>
  )
}

// El formulario del corte nuevo: nombre, precio, cuánto dura y su foto.
function FormNuevoCorte({ onAgregado }) {
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [duracion, setDuracion] = useState('30')
  const [foto, setFoto] = useState(null)
  const listo = nombre.trim() && Number(precio) > 0

  function agregar(e) {
    e.preventDefault()
    if (!listo) return
    onAgregado(agregarServicio(nombre, precio, duracion, foto))
  }

  return (
    <form onSubmit={agregar} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-tinta-suave">Nombre del corte</span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Diseño con navaja"
          autoFocus
          className="w-full rounded-xl border border-linea bg-fondo px-3 py-3 font-bold text-tinta outline-none focus-visible:border-laton"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-tinta-suave">Precio</span>
          <CampoPrecio value={precio} onChange={setPrecio} ancho />
        </div>
        <div>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-tinta-suave">Cuánto dura</span>
          <CampoMinutos value={duracion} onChange={setDuracion} />
        </div>
      </div>
      <div>
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-tinta-suave">Foto del corte (opcional)</span>
        <div className="flex items-center gap-3">
          <FotoCorte servicio={{ nombre, foto }} tam="h-20 w-20" />
          <div className="space-y-1">
            <SubirFotoCorte foto={foto} onFoto={setFoto} />
            <p className="text-[11px] text-tinta-suave">La ven los clientes al elegir su corte.</p>
          </div>
        </div>
      </div>
      <button type="submit" disabled={!listo} className="w-full rounded-2xl bg-laton py-4 text-base font-extrabold text-fondo disabled:opacity-40">
        {listo ? `✓ Agregar ${nombre.trim()} · ${formatearMonto(Number(precio))}` : 'Pon el nombre y el precio'}
      </button>
    </form>
  )
}

function CampoPrecio({ value, onChange, onBlur, ancho = false }) {
  return (
    <label className={`flex shrink-0 items-center gap-1 rounded-xl border border-linea bg-fondo px-3 focus-within:border-laton ${ancho ? 'w-full' : ''}`}>
      <span className="cifra text-tinta-suave">S/</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="0"
        aria-label="Precio"
        className={`cifra bg-transparent py-2.5 text-right font-bold text-laton outline-none ${ancho ? 'w-full' : 'w-16'}`}
      />
    </label>
  )
}

function CampoMinutos({ value, onChange, onBlur }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-linea bg-fondo px-3 focus-within:border-laton">
      <span className="text-xs font-bold text-tinta-suave">⏱ Dura</span>
      <input
        type="number"
        inputMode="numeric"
        min="5"
        step="5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-label="Minutos que dura"
        className="cifra w-14 bg-transparent py-2 text-right font-bold text-tinta outline-none"
      />
      <span className="text-xs text-tinta-suave">min</span>
    </label>
  )
}

// La ficha de un corte: todo lo que tiene (nombre, precio, cuánto dura y
// su foto) para verlo y cambiarlo. La foto se guarda al momento; lo demás
// con "Guardar cambios".
function FichaCorte({ servicio, onGuardado, onQuitado }) {
  const [nombre, setNombre] = useState(servicio.nombre)
  const [precio, setPrecio] = useState(String(servicio.precio))
  const [duracion, setDuracion] = useState(String(duracionDe(servicio)))
  const cambios = nombre.trim() !== servicio.nombre || Number(precio) !== servicio.precio || Number(duracion) !== duracionDe(servicio)
  const valido = nombre.trim() && Number(precio) > 0

  function guardar(e) {
    e.preventDefault()
    if (!valido) return
    guardarServicio(servicio.id, { nombre: nombre.trim(), precio: Number(precio), duracion: Math.max(5, Number(duracion) || 30) })
    onGuardado()
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <div className="flex items-center gap-4">
        <FotoCorte servicio={servicio} tam="h-28 w-28" ampliable />
        <div className="space-y-1">
          <SubirFotoCorte foto={servicio.foto} onFoto={(f) => guardarServicio(servicio.id, { foto: f })} />
          <p className="text-[11px] text-tinta-suave">{servicio.foto ? 'Toca la foto para verla en grande.' : 'Tómale una foto o elígela de la galería.'}</p>
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-tinta-suave">Nombre del corte</span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full rounded-xl border border-linea bg-fondo px-3 py-3 font-bold text-tinta outline-none focus-visible:border-laton"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-tinta-suave">Precio</span>
          <CampoPrecio value={precio} onChange={setPrecio} ancho />
        </div>
        <div>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-tinta-suave">Cuánto dura</span>
          <CampoMinutos value={duracion} onChange={setDuracion} />
        </div>
      </div>
      <button type="submit" disabled={!cambios || !valido} className="w-full rounded-2xl bg-laton py-4 text-base font-extrabold text-fondo disabled:opacity-40">
        {cambios ? '✓ Guardar cambios' : 'Sin cambios'}
      </button>
      <button
        type="button"
        onClick={() => {
          if (!confirm(`¿Quitar "${servicio.nombre}"? Ya no se podrá elegir al cobrar ni al reservar.`)) return
          eliminarServicio(servicio.id)
          onQuitado()
        }}
        className="w-full text-center text-sm text-ocupada underline decoration-dotted"
      >
        Quitar este corte
      </button>
    </form>
  )
}
