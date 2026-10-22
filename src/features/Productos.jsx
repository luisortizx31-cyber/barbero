import { useState } from 'react'
import { useEstado, guardarProducto, eliminarProducto } from '../data/store'
import { formatearMonto } from '../domain/dinero'
import { Hoja } from '../ui/Hoja'
import { Aviso } from '../ui/Aviso'
import { useAviso } from '../ui/useAviso'

// Productos que vende el local (gel, cera, shampoo...): precio y cuántos
// quedan. Se venden al cobrar una silla o sueltos desde la Caja, y el
// stock baja solo.
// Igual que los cortes (pedido del usuario, 2026-10-22): la lista
// muestra cada producto con su precio y cuántos quedan; al tocarlo se
// abre su ficha para cambiarlo o sumar lo que llegó, y "+ Agregar
// producto" abre un formulario y avisa "Producto agregado".
export default function Productos() {
  const { productos } = useEstado()
  const [agregando, setAgregando] = useState(false)
  const [abierto, setAbierto] = useState(null) // id
  const { aviso, avisar, resaltado } = useAviso()
  const productoAbierto = productos.find((p) => p.id === abierto)
  const pocos = productos.filter((p) => p.stock != null && p.stock <= 2).length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">🧴 Productos</h2>
          <p className="text-sm text-tinta-suave">Se venden al cobrar una silla o sueltos desde la Caja. Si pones cuántos tienes, el stock baja solo al vender.</p>
        </div>
        <button type="button" onClick={() => setAgregando(true)} className="shrink-0 rounded-xl bg-laton px-4 py-2.5 text-sm font-bold text-fondo">
          + Agregar producto
        </button>
      </div>

      {pocos > 0 && (
        <p className="rounded-xl border border-ocupada/40 bg-ocupada-suave px-3 py-2 text-sm font-semibold text-ocupada">
          ⚠ {pocos} {pocos === 1 ? 'producto se está acabando' : 'productos se están acabando'}. Tócalo para sumar lo que llegó.
        </p>
      )}

      {productos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linea p-6 text-center text-tinta-suave">
          Todavía no hay productos.{' '}
          <button type="button" onClick={() => setAgregando(true)} className="font-bold text-laton underline decoration-dotted">
            Agrega el primero
          </button>
        </p>
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-panel">
          {productos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setAbierto(p.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-700 active:bg-panel-2 ${p.id === resaltado ? 'bg-libre-suave' : ''}`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-panel-2 text-xl">🧴</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{p.nombre}</span>
                  <EstadoStock producto={p} />
                </span>
                <span className="cifra shrink-0 font-extrabold text-laton">{formatearMonto(p.precio)}</span>
                <span className="shrink-0 text-xl text-tinta-suave" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {agregando && (
        <Hoja titulo="Agregar producto" onCerrar={() => setAgregando(false)}>
          <FormProducto
            onListo={(nuevo) => {
              setAgregando(false)
              avisar(`✓ Producto agregado: ${nuevo.nombre} · ${formatearMonto(nuevo.precio)}`, nuevo.id)
            }}
          />
        </Hoja>
      )}

      {productoAbierto && (
        <Hoja titulo={productoAbierto.nombre} onCerrar={() => setAbierto(null)}>
          <FormProducto
            key={productoAbierto.id}
            producto={productoAbierto}
            onListo={() => {
              setAbierto(null)
              avisar('✓ Cambios guardados', productoAbierto.id)
            }}
            onQuitado={() => {
              setAbierto(null)
              avisar(`Se quitó ${productoAbierto.nombre}`)
            }}
          />
        </Hoja>
      )}

      <Aviso aviso={aviso} />
    </div>
  )
}

function EstadoStock({ producto: p }) {
  if (p.stock == null) return <span className="block text-xs text-tinta-suave">Sin contar stock</span>
  if (p.stock === 0) return <span className="block text-xs font-bold text-ocupada">Agotado</span>
  if (p.stock <= 2) return <span className="block text-xs font-bold text-ocupada">Quedan {p.stock} · se está acabando</span>
  return <span className="block text-xs text-tinta-suave">Quedan {p.stock}</span>
}

// Agregar (sin `producto`) o ver y cambiar uno: nombre, precio y cuántos
// hay, con botones para sumar o restar del stock.
function FormProducto({ producto = null, onListo, onQuitado }) {
  const [nombre, setNombre] = useState(producto?.nombre || '')
  const [precio, setPrecio] = useState(producto ? String(producto.precio) : '')
  const [stock, setStock] = useState(producto?.stock == null ? '' : String(producto.stock))
  const valido = nombre.trim() && Number(precio) > 0
  const cambios =
    !producto || nombre.trim() !== producto.nombre || Number(precio) !== producto.precio || (stock === '' ? null : Number(stock)) !== producto.stock
  const sumar = (n) => setStock((s) => String(Math.max(0, (Number(s) || 0) + n)))

  function guardar(e) {
    e.preventDefault()
    if (!valido) return
    const nuevo = guardarProducto(producto?.id ?? null, { nombre: nombre.trim(), precio, stock })
    onListo(nuevo || producto)
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-tinta-suave">Producto</span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Cera mate"
          autoFocus={!producto}
          className="w-full rounded-xl border border-linea bg-fondo px-3 py-3 font-bold text-tinta outline-none focus-visible:border-laton"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-tinta-suave">Precio de venta</span>
        <span className="flex items-center gap-1 rounded-xl border border-linea bg-fondo px-3 focus-within:border-laton">
          <span className="cifra text-tinta-suave">S/</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="0"
            className="cifra w-full bg-transparent py-3 text-right text-lg font-bold text-laton outline-none"
          />
        </span>
      </label>
      <div>
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-tinta-suave">¿Cuántos tienes? (opcional)</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => sumar(-1)} className="h-12 w-12 shrink-0 rounded-xl border border-linea text-xl font-bold" aria-label="Uno menos">
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="Sin contar"
            className="cifra h-12 min-w-0 flex-1 rounded-xl border border-linea bg-fondo px-3 text-center text-lg font-bold text-tinta outline-none focus-visible:border-laton"
          />
          <button type="button" onClick={() => sumar(1)} className="h-12 w-12 shrink-0 rounded-xl border border-linea text-xl font-bold" aria-label="Uno más">
            +
          </button>
        </div>
        {producto && (
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="self-center text-xs text-tinta-suave">Llegó mercadería:</span>
            {[6, 12, 24].map((n) => (
              <button key={n} type="button" onClick={() => sumar(n)} className="rounded-lg border border-libre/50 bg-libre-suave px-3 py-1.5 text-xs font-bold text-libre">
                +{n}
              </button>
            ))}
          </div>
        )}
        <p className="mt-1 text-[11px] text-tinta-suave">Si lo dejas vacío no se cuenta el stock. Si pones cuántos hay, baja solo al vender.</p>
      </div>
      <button type="submit" disabled={!valido || !cambios} className="w-full rounded-2xl bg-laton py-4 text-base font-extrabold text-fondo disabled:opacity-40">
        {!valido ? 'Pon el nombre y el precio' : producto ? (cambios ? '✓ Guardar cambios' : 'Sin cambios') : `✓ Agregar ${nombre.trim()} · ${formatearMonto(Number(precio))}`}
      </button>
      {producto && (
        <button
          type="button"
          onClick={() => {
            if (!confirm(`¿Quitar "${producto.nombre}"? Ya no se podrá vender.`)) return
            eliminarProducto(producto.id)
            onQuitado()
          }}
          className="w-full text-center text-sm text-ocupada underline decoration-dotted"
        >
          Quitar este producto
        </button>
      )}
    </form>
  )
}
