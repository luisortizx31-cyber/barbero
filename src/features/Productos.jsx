import { useState } from 'react'
import { useEstado, guardarProducto, eliminarProducto } from '../data/store'
import { formatearMonto } from '../domain/dinero'

// Productos que vende el local (gel, cera, shampoo...): precio y cuántos
// quedan. Se venden al cobrar una silla o sueltos desde la Caja, y el
// stock baja solo.
export default function Productos() {
  const { productos } = useEstado()
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [stock, setStock] = useState('')

  function agregar(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    guardarProducto(null, { nombre: nombre.trim(), precio, stock })
    setNombre('')
    setPrecio('')
    setStock('')
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold">🧴 Productos</h2>
        <p className="text-sm text-tinta-suave">Se venden al cobrar una silla o sueltos desde la Caja. Si pones cuántos tienes, el stock baja solo al vender.</p>
      </div>

      <form onSubmit={agregar} className="space-y-2 rounded-2xl border border-linea bg-panel p-4">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Cera mate"
          aria-label="Producto"
          className="w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton"
        />
        <div className="grid grid-cols-2 gap-2">
          <Numero etiqueta="Precio S/" value={precio} onChange={setPrecio} />
          <Numero etiqueta="Tengo" value={stock} onChange={setStock} placeholder="opcional" />
        </div>
        <button type="submit" disabled={!nombre.trim()} className="w-full rounded-xl bg-laton py-2.5 font-bold text-fondo disabled:opacity-30">
          + Agregar producto
        </button>
      </form>

      {productos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linea p-6 text-center text-tinta-suave">Todavía no hay productos.</p>
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-panel">
          {productos.map((p) => (
            <FilaProducto key={p.id} producto={p} />
          ))}
        </ul>
      )}
    </div>
  )
}

function Numero({ etiqueta, value, onChange, onBlur, placeholder = '0' }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-linea bg-fondo px-3 focus-within:border-laton">
      <span className="shrink-0 text-xs font-bold text-tinta-suave">{etiqueta}</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="cifra w-full bg-transparent py-2.5 text-right font-bold text-laton outline-none"
      />
    </label>
  )
}

function FilaProducto({ producto: p }) {
  const [nombre, setNombre] = useState(p.nombre)
  const [precio, setPrecio] = useState(String(p.precio))
  const [stock, setStock] = useState(p.stock == null ? '' : String(p.stock))
  const guardar = (cambios) => guardarProducto(p.id, { nombre: p.nombre, precio: p.precio, stock: p.stock, ...cambios })

  return (
    <li className="space-y-2 p-3">
      <div className="flex items-center gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={() => nombre.trim() && nombre.trim() !== p.nombre && guardar({ nombre: nombre.trim() })}
          aria-label="Producto"
          className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1.5 font-bold text-tinta outline-none focus-visible:border-laton focus-visible:bg-fondo"
        />
        {p.stock != null && p.stock <= 2 && <span className="shrink-0 rounded-full bg-ocupada-suave px-2 py-0.5 text-[11px] font-bold text-ocupada">{p.stock === 0 ? 'Agotado' : 'Quedan pocos'}</span>}
        <button type="button" onClick={() => confirm(`¿Quitar "${p.nombre}"?`) && eliminarProducto(p.id)} aria-label={`Quitar ${p.nombre}`} className="shrink-0 px-2 text-ocupada">
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Numero etiqueta="Precio S/" value={precio} onChange={setPrecio} onBlur={() => Number(precio) !== p.precio && guardar({ precio })} />
        <Numero etiqueta="Quedan" value={stock} onChange={setStock} placeholder="—" onBlur={() => guardar({ stock })} />
      </div>
      <p className="text-right text-xs text-tinta-suave">{formatearMonto(p.precio)} c/u</p>
    </li>
  )
}
