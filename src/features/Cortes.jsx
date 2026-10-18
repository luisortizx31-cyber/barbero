import { useState } from 'react'
import { useEstado, agregarServicio, guardarServicio, eliminarServicio } from '../data/store'
import { duracionDe } from '../domain/horario'
import { FotoCorte, SubirFotoCorte } from '../ui/FotoCorte'

// Los cortes y servicios del local con su precio y cuánto duran: se
// eligen al ocupar una silla y al cobrarla, y la duración sirve para la
// espera estimada y para las horas libres de las citas.
export default function Cortes() {
  const { servicios } = useEstado()
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [duracion, setDuracion] = useState('30')
  const [foto, setFoto] = useState(null)

  function agregar(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    agregarServicio(nombre, precio, duracion, foto)
    setNombre('')
    setPrecio('')
    setDuracion('30')
    setFoto(null)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold">Cortes y precios</h2>
        <p className="text-sm text-tinta-suave">Se eligen al ocupar una silla, al cobrar y al reservar cita. Lo que dura cada corte sirve para calcular la espera y las horas libres.</p>
      </div>

      <form onSubmit={agregar} className="rounded-2xl border border-linea bg-panel p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">Agregar corte o servicio</p>
        <div className="flex gap-2">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Diseño con navaja"
            aria-label="Nombre del corte"
            className="min-w-0 flex-1 rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton"
          />
          <CampoPrecio value={precio} onChange={setPrecio} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CampoMinutos value={duracion} onChange={setDuracion} />
          <FotoCorte servicio={{ nombre, foto }} tam="h-11 w-11" />
          <SubirFotoCorte foto={foto} onFoto={setFoto} />
        </div>
        <p className="mt-1 text-[11px] text-tinta-suave">La foto la ven los clientes al elegir su corte.</p>
        <button type="submit" disabled={!nombre.trim()} className="mt-2 w-full rounded-xl bg-laton py-2.5 font-bold text-fondo disabled:opacity-30">
          + Agregar
        </button>
      </form>

      <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-panel">
        {servicios.map((x) => (
          <FilaServicio key={x.id} servicio={x} />
        ))}
        {servicios.length === 0 && <li className="p-6 text-center text-tinta-suave">Todavía no hay cortes.</li>}
      </ul>
    </div>
  )
}

function CampoPrecio({ value, onChange, onBlur }) {
  return (
    <label className="flex shrink-0 items-center gap-1 rounded-xl border border-linea bg-fondo px-3 focus-within:border-laton">
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
        className="cifra w-16 bg-transparent py-2.5 text-right font-bold text-laton outline-none"
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

// Se guarda solo al salir de cada campo.
function FilaServicio({ servicio }) {
  const [nombre, setNombre] = useState(servicio.nombre)
  const [precio, setPrecio] = useState(String(servicio.precio))
  const [duracion, setDuracion] = useState(String(duracionDe(servicio)))

  return (
    <li className="flex flex-wrap items-center gap-2 p-3">
      <FotoCorte servicio={servicio} tam="h-12 w-12" ampliable />
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onBlur={() => nombre.trim() && nombre.trim() !== servicio.nombre && guardarServicio(servicio.id, { nombre: nombre.trim() })}
        aria-label="Nombre del corte"
        className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-2 font-bold text-tinta outline-none focus-visible:border-laton focus-visible:bg-fondo"
      />
      <CampoPrecio
        value={precio}
        onChange={setPrecio}
        onBlur={() => Number(precio) !== servicio.precio && guardarServicio(servicio.id, { precio: Number(precio) || 0 })}
      />
      <CampoMinutos
        value={duracion}
        onChange={setDuracion}
        onBlur={() => Number(duracion) !== duracionDe(servicio) && guardarServicio(servicio.id, { duracion: Math.max(5, Number(duracion) || 30) })}
      />
      <SubirFotoCorte foto={servicio.foto} onFoto={(f) => guardarServicio(servicio.id, { foto: f })} />
      <button
        type="button"
        onClick={() => confirm(`¿Quitar "${servicio.nombre}"?`) && eliminarServicio(servicio.id)}
        aria-label={`Quitar ${servicio.nombre}`}
        className="shrink-0 rounded-lg px-2 py-2 text-ocupada"
      >
        ✕
      </button>
    </li>
  )
}
