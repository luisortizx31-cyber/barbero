import { useState } from 'react'
import { formatearMonto, METODOS } from '../domain/dinero'
import { formatearHora, formatearDuracion } from '../domain/hora'
import { fidelidad } from '../domain/clientes'
import { totalProductos } from '../domain/caja'
import { FotoBarbero } from './FotoBarbero'
import { FotoCorte } from './FotoCorte'

// Los cortes del local como botones para marcar (se puede elegir más
// de uno, por ejemplo corte + cejas).
export function ElegirCortes({ servicios, elegidos, onCambiar }) {
  function alternar(id) {
    onCambiar(elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id])
  }
  if (servicios.length === 0) return <p className="text-sm text-tinta-suave">Todavía no hay cortes. Agrégalos en Más → Cortes.</p>
  const conFotos = servicios.some((x) => x.foto)
  return (
    <div className="grid grid-cols-2 gap-2">
      {servicios.map((x) => {
        const marcado = elegidos.includes(x.id)
        return (
          <button
            key={x.id}
            type="button"
            onClick={() => alternar(x.id)}
            aria-pressed={marcado}
            className={`overflow-hidden rounded-2xl border-2 text-left transition active:scale-[0.98] ${conFotos ? 'p-0' : 'px-3 py-3'} ${marcado ? 'border-laton bg-laton-suave' : 'border-linea bg-fondo'}`}
          >
            {conFotos && <FotoCorte servicio={x} tam="h-24 w-full" className="rounded-none" />}
            <span className={conFotos ? 'block px-3 py-2' : 'contents'}>
            <span className="block text-sm font-bold leading-tight">
              {marcado ? '✓ ' : ''}
              {x.nombre}
            </span>
            <span className="cifra mt-1 block text-base font-extrabold text-laton">{formatearMonto(x.precio)}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Nombre del cliente con sugerencias de los clientes frecuentes.
// valor: { clienteId, nombre }
// `sentadoEn(clienteId)`: la silla donde ya se está cortando (no se
// puede elegir de nuevo), o null.
export function ElegirCliente({ clientes, valor, onCambiar, placeholder = 'Nombre del cliente (opcional)', sentadoEn = () => null }) {
  const [abierto, setAbierto] = useState(false)
  const q = valor.nombre.trim().toLowerCase()
  const sugerencias = q && !valor.clienteId ? clientes.filter((c) => c.nombre.toLowerCase().includes(q) || (c.telefono || '').includes(q)).slice(0, 5) : []

  return (
    <div className="relative">
      <input
        value={valor.nombre}
        onChange={(e) => {
          onCambiar({ clienteId: null, nombre: e.target.value })
          setAbierto(true)
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        placeholder={placeholder}
        aria-label="Cliente"
        className="w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton"
      />
      {valor.clienteId && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-libre">✓ frecuente</span>}
      {abierto && sugerencias.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-linea bg-panel-2 shadow-xl">
          {sugerencias.map((c) => {
            const silla = sentadoEn(c.id)
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onCambiar({ clienteId: c.id, nombre: c.nombre })
                    setAbierto(false)
                  }}
                  disabled={Boolean(silla)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm disabled:opacity-50"
                >
                  <span className="font-bold">{c.nombre}</span>
                  {silla ? <span className="text-xs font-bold text-ocupada">ya está en {silla.nombre}</span> : <span className="cifra text-xs text-tinta-suave">{c.telefono}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// Al ocupar: quién se sienta (el siguiente de la cola, alguien con
// cita, un cliente frecuente o uno de paso) y qué corte se va a hacer.
export function HojaOcupar({ silla, sillas: sillasTodas = [], servicios, clientes, espera, citas, barberos = [], barberoInicial = null, onOcupar }) {
  const primerNombre = (id) => barberos.find((b) => b.id === id)?.nombre.split(' ')[0] || ''
  const opciones = [
    ...espera.map((x, i) => ({
      clave: `e-${x.id}`,
      etiqueta: `${i === 0 ? '⏳ Sigue: ' : '⏳ '}${x.nombre}${x.barberoId ? ` (quiere a ${primerNombre(x.barberoId)})` : ''}`,
      nombre: x.nombre,
      clienteId: x.clienteId,
      servicioIds: x.servicioIds,
      esperaId: x.id,
      barberoId: x.barberoId || null,
    })),
    ...citas.map((c) => ({
      clave: `c-${c.id}`,
      etiqueta: `📅 ${c.hora} ${c.nombre}${c.barberoId ? ` (con ${primerNombre(c.barberoId)})` : ''}`,
      nombre: c.nombre,
      clienteId: c.clienteId,
      servicioIds: c.servicioIds,
      citaId: c.id,
      barberoId: c.barberoId || null,
    })),
  ]
  // Una persona no puede estar cortándose en dos sillas (pedido del
  // usuario, 2026-10-20): el cliente frecuente por su ficha, el de paso
  // por su nombre.
  const otrasOcupadas = sillasTodas.filter((s) => s.id !== silla.id && s.ocupadaDesde)
  const sentadoEn = (clienteId) => (clienteId && otrasOcupadas.find((s) => s.clienteId === clienteId)) || null
  const mismoNombreEn = (nombre) => (nombre?.trim() && otrasOcupadas.find((s) => !s.clienteId && s.cliente && s.cliente.trim().toLowerCase() === nombre.trim().toLowerCase())) || null
  const yaSentado = (o) => sentadoEn(o.clienteId) || mismoNombreEn(o.nombre)
  // De entrada, el primero que puede sentarse en ESTA silla (sin
  // preferencia, o que quiere al barbero de esta silla).
  const puedenSentarse = opciones.filter((o) => !yaSentado(o))
  const inicial = puedenSentarse.find((o) => !o.barberoId || o.barberoId === silla.barberoFijoId) ?? puedenSentarse[0]
  const [elegida, setElegida] = useState(inicial?.clave ?? null)
  // Dónde está cortando cada barbero ahora (no se puede elegir a uno que
  // ya está cortando en otra silla).
  const ocupadoEn = (id) => sillasTodas.find((s) => s.id !== silla.id && s.ocupadaDesde && s.barberoId === id) || null
  const libreONull = (id) => (id && !ocupadoEn(id) ? id : null)
  const [barberoId, setBarberoId] = useState(libreONull(inicial?.barberoId) || libreONull(barberoInicial))
  const opcion = opciones.find((o) => o.clave === elegida)
  const [cliente, setCliente] = useState({ clienteId: null, nombre: '' })
  const [cortes, setCortes] = useState(() => inicial?.servicioIds ?? [])

  function elegirOpcion(o) {
    setElegida(o?.clave ?? null)
    setCortes(o?.servicioIds ?? [])
    // Si pidió un barbero, corta ese (si no está cortando en otra silla).
    if (o?.barberoId && !ocupadoEn(o.barberoId)) setBarberoId(o.barberoId)
  }

  const quien = opcion ?? cliente
  const sentadoAqui = yaSentado(quien)
  // Con barberos registrados hay que decir quién corta: si no, la silla
  // mostraría a su barbero fijo aunque esté cortando en otra.
  const faltaBarbero = barberos.length > 0 && !barberoId
  const total = servicios.filter((x) => cortes.includes(x.id)).reduce((t, x) => t + x.precio, 0)

  return (
    <div className="space-y-5">
      {barberos.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">¿Quién corta?</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {barberos.map((b) => {
              const enOtra = ocupadoEn(b.id)
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBarberoId(b.id)}
                  disabled={Boolean(enOtra)}
                  aria-pressed={barberoId === b.id}
                  className={`flex w-20 shrink-0 flex-col items-center gap-1 rounded-2xl border-2 p-2 disabled:opacity-40 ${barberoId === b.id ? 'border-laton bg-laton-suave' : 'border-linea'}`}
                >
                  <FotoBarbero barbero={b} tam="h-12 w-12" texto="text-sm" />
                  <span className="w-full truncate text-center text-xs font-bold">{b.nombre.split(' ')[0]}</span>
                  {enOtra && <span className="w-full truncate text-center text-[10px] text-ocupada">en {enOtra.nombre}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">¿Quién se sienta?</p>
        {opciones.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {opciones.map((o) => {
              const en = yaSentado(o)
              return (
                <button
                  key={o.clave}
                  type="button"
                  onClick={() => elegirOpcion(o)}
                  disabled={Boolean(en)}
                  aria-pressed={elegida === o.clave}
                  className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold disabled:opacity-40 ${elegida === o.clave ? 'border-laton bg-laton-suave text-tinta' : 'border-linea text-tinta-suave'}`}
                >
                  {o.etiqueta}
                  {en ? ` · ya en ${en.nombre}` : ''}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => elegirOpcion(null)}
              aria-pressed={!opcion}
              className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold ${!opcion ? 'border-laton bg-laton-suave text-tinta' : 'border-linea text-tinta-suave'}`}
            >
              Otro cliente
            </button>
          </div>
        )}
        {!opcion && (
          <ElegirCliente
            clientes={clientes}
            valor={cliente}
            sentadoEn={sentadoEn}
            onCambiar={(v) => {
              setCliente(v)
              const c = v.clienteId && clientes.find((x) => x.id === v.clienteId)
              if (c?.servicioIds?.length) setCortes(c.servicioIds)
            }}
          />
        )}
        {sentadoAqui && <p className="mt-2 rounded-xl bg-ocupada-suave px-3 py-2 text-center text-sm text-ocupada">{quien.nombre} ya se está cortando en {sentadoAqui.nombre}. Libera esa silla primero, o elige a otra persona.</p>}
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">¿Qué corte? (se puede cambiar al cobrar)</p>
        <ElegirCortes servicios={servicios} elegidos={cortes} onCambiar={setCortes} />
      </div>

      {faltaBarbero && (
        <p className="rounded-xl bg-ocupada-suave px-3 py-2 text-center text-sm text-ocupada">
          {barberoInicial && ocupadoEn(barberoInicial)
            ? `${barberos.find((b) => b.id === barberoInicial)?.nombre || 'Ese barbero'} ya está cortando en ${ocupadoEn(barberoInicial).nombre}. Elige quién corta aquí, o libera esa silla primero.`
            : 'Elige quién va a cortar.'}
        </p>
      )}
      <button
        type="button"
        disabled={faltaBarbero || Boolean(sentadoAqui)}
        onClick={() =>
          onOcupar({ servicioIds: cortes, clienteId: quien.clienteId ?? null, nombre: quien.nombre ?? '', esperaId: opcion?.esperaId ?? null, citaId: opcion?.citaId ?? null, barberoId })
        }
        className="w-full rounded-2xl bg-ocupada py-4 text-base font-extrabold text-white active:scale-[0.98] disabled:opacity-40"
      >
        Ocupar {silla.nombre}
        {quien.nombre ? ` · ${quien.nombre}` : ''}
        {total > 0 ? ` · ${formatearMonto(total)}` : ''}
      </button>
    </div>
  )
}

// Al liberar: cobrar lo que se hizo (cortes y productos) y cómo pagó.
// Si al cliente le toca el corte gratis de la tarjeta, se ofrece.
export function HojaCobrar({ silla, servicios, productos, historial, config, ahora, onCobrar, onSinCobrar }) {
  const [elegidos, setElegidos] = useState(() => (silla.servicioIds || []).filter((id) => servicios.some((x) => x.id === id)))
  const [vendidos, setVendidos] = useState({}) // productoId -> cantidad
  const [montoManual, setMontoManual] = useState(null) // null = la suma
  const [metodo, setMetodo] = useState('efectivo')
  const tarjeta = fidelidad(historial, silla.clienteId, Number(config.fidelidadCada) || 0)
  const [gratis, setGratis] = useState(false)

  const itemsProductos = productos.filter((p) => vendidos[p.id] > 0).map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio, cantidad: vendidos[p.id] }))
  const sumaCortes = gratis ? 0 : servicios.filter((x) => elegidos.includes(x.id)).reduce((t, x) => t + x.precio, 0)
  const suma = sumaCortes + totalProductos(itemsProductos)
  const monto = montoManual ?? suma
  const puedeCobrar = monto > 0 || (gratis && elegidos.length > 0)

  function cambiarCantidad(id, delta) {
    setVendidos((v) => ({ ...v, [id]: Math.max(0, (v[id] || 0) + delta) }))
    setMontoManual(null)
  }

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-fondo px-3 py-2 text-sm text-tinta-suave">
        {silla.cliente ? <span className="font-bold text-tinta">{silla.cliente} · </span> : ''}
        desde <span className="cifra font-bold text-tinta">{formatearHora(silla.ocupadaDesde)}</span> · lleva{' '}
        <span className="cifra font-bold text-tinta">{formatearDuracion(ahora - new Date(silla.ocupadaDesde))}</span>
        {silla.barbero ? ` · ✂ ${silla.barbero}` : ''}
      </p>

      {tarjeta?.tocaGratis && (
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-laton bg-laton-suave p-3">
          <input
            type="checkbox"
            checked={gratis}
            onChange={(e) => {
              setGratis(e.target.checked)
              setMontoManual(null)
            }}
            className="h-5 w-5 accent-[var(--color-laton)]"
          />
          <span>
            <span className="block font-extrabold">🎁 ¡Le toca su corte gratis!</span>
            <span className="text-xs text-tinta-suave">Completó su tarjeta de {tarjeta.meta} cortes. Márcalo para no cobrarle el corte.</span>
          </span>
        </label>
      )}

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">¿Qué se hizo?</p>
        <ElegirCortes
          servicios={servicios}
          elegidos={elegidos}
          onCambiar={(ids) => {
            setElegidos(ids)
            setMontoManual(null)
          }}
        />
      </div>

      {productos.length > 0 && (
        <details className="rounded-2xl border border-linea bg-fondo">
          <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-tinta-suave">
            🧴 ¿Se llevó algún producto?{itemsProductos.length ? ` (${itemsProductos.reduce((t, x) => t + x.cantidad, 0)})` : ''}
          </summary>
          <ul className="divide-y divide-linea border-t border-linea">
            {productos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{p.nombre}</span>
                  <span className="cifra text-xs text-laton">{formatearMonto(p.precio)}</span>
                  {p.stock != null && <span className="ml-2 text-xs text-tinta-suave">quedan {p.stock}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => cambiarCantidad(p.id, -1)} disabled={!vendidos[p.id]} className="h-8 w-8 rounded-lg border border-linea disabled:opacity-30" aria-label={`Quitar ${p.nombre}`}>
                    −
                  </button>
                  <span className="cifra w-5 text-center font-bold">{vendidos[p.id] || 0}</span>
                  <button
                    type="button"
                    onClick={() => cambiarCantidad(p.id, 1)}
                    disabled={p.stock != null && (vendidos[p.id] || 0) >= p.stock}
                    className="h-8 w-8 rounded-lg border border-linea disabled:opacity-30"
                    aria-label={`Agregar ${p.nombre}`}
                  >
                    +
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-linea bg-fondo px-4 py-3">
        <span className="text-sm font-bold uppercase tracking-wide text-tinta-suave">Total</span>
        <span className="flex items-center gap-1">
          <span className="cifra text-xl font-extrabold text-laton">S/</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            value={monto}
            onChange={(e) => setMontoManual(e.target.value === '' ? 0 : Number(e.target.value))}
            aria-label="Total a cobrar"
            className="cifra w-24 rounded-lg bg-transparent text-right text-3xl font-extrabold text-laton outline-none focus-visible:bg-panel-2"
          />
        </span>
      </div>
      {montoManual != null && montoManual !== suma && (
        <p className="-mt-3 text-right text-xs text-tinta-suave">
          Suma {formatearMonto(suma)}.{' '}
          <button type="button" onClick={() => setMontoManual(null)} className="underline decoration-dotted">
            Usar ese
          </button>
        </p>
      )}

      {monto > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">¿Cómo pagó?</p>
          <div className="grid grid-cols-3 gap-2">
            {METODOS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetodo(m.id)}
                aria-pressed={metodo === m.id}
                className={`rounded-2xl border-2 py-3 text-sm font-bold ${metodo === m.id ? 'border-libre bg-libre-suave text-libre' : 'border-linea bg-fondo text-tinta-suave'}`}
              >
                <span className="block text-xl">{m.icono}</span>
                {m.texto}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={!puedeCobrar}
        onClick={() =>
          onCobrar({
            servicios: servicios.filter((x) => elegidos.includes(x.id)).map((x) => ({ nombre: x.nombre, precio: gratis ? 0 : x.precio })),
            productos: itemsProductos,
            monto: Number(monto),
            metodo,
            gratis,
          })
        }
        className="w-full rounded-2xl bg-libre py-4 text-lg font-extrabold text-white active:scale-[0.98] disabled:opacity-40"
      >
        {monto > 0 ? `✓ Cobrar ${formatearMonto(monto)} y liberar` : '🎁 Corte gratis · liberar'}
      </button>
      <button type="button" onClick={onSinCobrar} className="w-full text-center text-sm text-tinta-suave underline decoration-dotted">
        Liberar sin cobrar
      </button>
    </div>
  )
}

// Venta suelta de productos (sin silla), desde la Caja.
export function HojaVender({ productos, onVender }) {
  const [vendidos, setVendidos] = useState({})
  const [metodo, setMetodo] = useState('efectivo')
  const items = productos.filter((p) => vendidos[p.id] > 0).map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio, cantidad: vendidos[p.id] }))
  const total = totalProductos(items)

  if (productos.length === 0) return <p className="text-sm text-tinta-suave">Todavía no hay productos. Agrégalos en Más → Productos.</p>
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-fondo">
        {productos.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
            <span className="min-w-0">
              <span className="block truncate font-bold">{p.nombre}</span>
              <span className="cifra text-sm text-laton">{formatearMonto(p.precio)}</span>
              {p.stock != null && <span className="ml-2 text-xs text-tinta-suave">quedan {p.stock}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => setVendidos((v) => ({ ...v, [p.id]: Math.max(0, (v[p.id] || 0) - 1) }))} disabled={!vendidos[p.id]} className="h-9 w-9 rounded-lg border border-linea disabled:opacity-30">
                −
              </button>
              <span className="cifra w-5 text-center font-bold">{vendidos[p.id] || 0}</span>
              <button
                type="button"
                onClick={() => setVendidos((v) => ({ ...v, [p.id]: (v[p.id] || 0) + 1 }))}
                disabled={p.stock != null && (vendidos[p.id] || 0) >= p.stock}
                className="h-9 w-9 rounded-lg border border-linea disabled:opacity-30"
              >
                +
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-3 gap-2">
        {METODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMetodo(m.id)}
            aria-pressed={metodo === m.id}
            className={`rounded-2xl border-2 py-2.5 text-sm font-bold ${metodo === m.id ? 'border-libre bg-libre-suave text-libre' : 'border-linea bg-fondo text-tinta-suave'}`}
          >
            {m.icono} {m.texto}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={total <= 0}
        onClick={() => onVender(items, metodo)}
        className="w-full rounded-2xl bg-libre py-4 text-lg font-extrabold text-white disabled:opacity-40"
      >
        ✓ Vender {formatearMonto(total)}
      </button>
    </div>
  )
}
