import { useState } from 'react'
import { useEstado, agregarServicio, guardarServicio, eliminarServicio } from '../data/store'

// Los cortes y servicios del local con su precio: se eligen al ocupar
// una silla y al cobrarla.
export default function Cortes() {
  const { servicios } = useEstado()
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')

  function agregar(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    agregarServicio(nombre, precio)
    setNombre('')
    setPrecio('')
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold">Cortes y precios</h2>
        <p className="text-sm text-tinta-suave">Se eligen al ocupar una silla y al cobrar. El precio se puede cambiar en un cobro si hace falta.</p>
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

// Se guarda solo al salir de cada campo.
function FilaServicio({ servicio }) {
  const [nombre, setNombre] = useState(servicio.nombre)
  const [precio, setPrecio] = useState(String(servicio.precio))

  return (
    <li className="flex items-center gap-2 p-3">
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
