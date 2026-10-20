import { useState } from 'react'
import { useEstado, useSesion, guardarCliente, eliminarCliente } from '../data/store'
import { enlaces } from '../data/plataforma'
import { resumenCliente, linkWhatsapp } from '../domain/clientes'
import { formatearMonto } from '../domain/dinero'
import { formatearHora } from '../domain/hora'
import { Hoja } from '../ui/Hoja'
import { ElegirCortes } from '../ui/Cobro'
import { FotoCorte, SubirFotoCorte } from '../ui/FotoCorte'

// Los clientes frecuentes: cuántas veces vinieron, cuándo fue la última,
// su corte de siempre, su tarjeta de fidelidad, y un toque para
// recordarles por WhatsApp que ya les toca volver.
export default function Clientes() {
  const estado = useEstado()
  const { clientes, config, servicios } = estado
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos') // 'todos' | 'recordar'
  const [abierto, setAbierto] = useState(null) // cliente | 'nuevo'

  const dias = Number(config.diasRecordatorio) || 21
  const conResumen = clientes.map((c) => ({ c, r: resumenCliente(estado, c) }))
  const paraRecordar = conResumen.filter(({ c, r }) => r.dias != null && r.dias >= dias && c.telefono)
  const q = busqueda.trim().toLowerCase()
  const lista = (filtro === 'recordar' ? paraRecordar : conResumen)
    .filter(({ c }) => !q || c.nombre.toLowerCase().includes(q) || (c.telefono || '').includes(q))
    .sort((a, b) => (filtro === 'recordar' ? b.r.dias - a.r.dias : a.c.nombre.localeCompare(b.c.nombre)))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">
          Clientes <span className="text-tinta-suave">({clientes.length})</span>
        </h2>
        <button type="button" onClick={() => setAbierto('nuevo')} className="rounded-xl bg-laton px-4 py-2.5 text-sm font-bold text-fondo">
          + Cliente
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-linea bg-panel p-1">
        {[
          ['todos', `Todos (${clientes.length})`],
          ['recordar', `🔔 Para recordar (${paraRecordar.length})`],
        ].map(([id, texto]) => (
          <button key={id} type="button" onClick={() => setFiltro(id)} aria-pressed={filtro === id} className={`rounded-lg py-2 text-sm font-bold ${filtro === id ? 'bg-laton text-fondo' : 'text-tinta-suave'}`}>
            {texto}
          </button>
        ))}
      </div>
      {filtro === 'recordar' && <p className="text-xs text-tinta-suave">Clientes con celular que no vienen hace {dias} días o más (se cambia en Más → Ajustes).</p>}

      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o celular…"
        className="w-full rounded-xl border border-linea bg-panel px-4 py-2.5 text-tinta outline-none focus-visible:border-laton"
      />

      {lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linea p-6 text-center text-tinta-suave">
          {clientes.length === 0 ? 'Todavía no hay clientes. Agrégalos aquí o al anotarlos en la espera.' : 'Nadie con ese filtro.'}
        </p>
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-panel">
          {lista.map(({ c, r }) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              {c.fotoCorte && <FotoCorte servicio={{ foto: c.fotoCorte, nombre: `Corte de ${c.nombre}` }} tam="h-11 w-11" ampliable />}
              <button type="button" onClick={() => setAbierto(c)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-bold">
                  {c.nombre}
                  {c.origen === 'web' && <span className="ml-1.5 rounded-full bg-panel-2 px-1.5 py-0.5 text-[10px] font-bold text-tinta-suave">📱 se registró solo</span>}
                </p>
                <p className="text-xs text-tinta-suave">
                  {r.visitas} {r.visitas === 1 ? 'visita' : 'visitas'}
                  {r.dias != null ? ` · última hace ${r.dias} ${r.dias === 1 ? 'día' : 'días'}` : ' · todavía no vino'}
                </p>
                {r.fidelidad && <Sellos f={r.fidelidad} chico />}
              </button>
              <BotonRecordar cliente={c} config={config} resumen={r} />
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <Hoja titulo={abierto === 'nuevo' ? 'Nuevo cliente' : abierto.nombre} onCerrar={() => setAbierto(null)}>
          <FichaCliente
            cliente={abierto === 'nuevo' ? null : clientes.find((c) => c.id === abierto.id)}
            estado={estado}
            servicios={servicios}
            onListo={() => setAbierto(null)}
          />
        </Hoja>
      )}
    </div>
  )
}

function Sellos({ f, chico }) {
  return (
    <span className={`mt-1 flex flex-wrap items-center gap-1 ${chico ? '' : 'gap-1.5'}`} aria-label={`Tarjeta: ${f.sellos} de ${f.meta}`}>
      {Array.from({ length: f.meta }, (_, i) => (
        <span
          key={i}
          className={`inline-flex items-center justify-center rounded-full border ${chico ? 'h-3.5 w-3.5 text-[8px]' : 'h-8 w-8 text-sm'} ${i < f.sellos ? 'border-laton bg-laton text-fondo' : 'border-linea'}`}
        >
          {!chico && i < f.sellos ? '✂' : ''}
        </span>
      ))}
      <span className={`inline-flex items-center justify-center rounded-full border-2 border-dashed ${chico ? 'h-3.5 w-3.5 text-[8px]' : 'h-8 w-8 text-sm'} ${f.tocaGratis ? 'border-libre bg-libre text-white' : 'border-laton/60'}`}>🎁</span>
      {f.tocaGratis && <span className={`font-bold text-libre ${chico ? 'text-[11px]' : 'text-sm'}`}>¡Le toca gratis!</span>}
    </span>
  )
}

// WhatsApp al cliente (pedido del usuario, 2026-10-18): el recordatorio
// de que ya le toca volver, cómo va su tarjeta ("llevas 2 cortes, te
// faltan 3 para uno gratis") y el enlace para ver desde su celular si
// hay sitio y quién está cortando.
function mensajeCliente(cliente, config, r, enlace) {
  const lineas = [`Hola ${cliente.nombre.split(' ')[0]} 👋, te saludamos de *${config.nombre}* ✂`]
  if (r.dias != null && r.dias >= 7) lineas.push(`Ya van ${r.dias} días de tu último corte, ¿te esperamos esta semana? 💈`)
  const f = r.fidelidad
  if (f) {
    lineas.push('')
    if (f.tocaGratis) lineas.push('🎁 *¡Tu próximo corte es GRATIS!* Completaste tu tarjeta.')
    else {
      const faltan = f.meta - f.sellos
      lineas.push(
        `🎁 Tu tarjeta: llevas *${f.sellos} ${f.sellos === 1 ? 'corte' : 'cortes'}*. Te ${faltan === 1 ? 'falta *1 corte*' : `faltan *${faltan} cortes*`} para uno *GRATIS*.`
      )
      lineas.push('✂'.repeat(f.sellos) + '▫'.repeat(faltan) + '🎁')
    }
  }
  lineas.push('', `Mira desde tu celular si hay sitio y quién está cortando antes de venir 👇`, enlace)
  return lineas.join('\n')
}

function BotonRecordar({ cliente, config, resumen, grande }) {
  const { barberiaId } = useSesion()
  const link = linkWhatsapp(cliente.telefono, mensajeCliente(cliente, config, resumen, enlaces(barberiaId).local))
  if (!link) return null
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className={`shrink-0 rounded-xl bg-libre font-bold text-white ${grande ? 'block w-full py-3 text-center' : 'px-3 py-2 text-xs'}`}
    >
      💬 {grande ? 'Mandarle su tarjeta y el enlace por WhatsApp' : 'WhatsApp'}
    </a>
  )
}

function FichaCliente({ cliente, estado, servicios, onListo }) {
  const [nombre, setNombre] = useState(cliente?.nombre || '')
  const [telefono, setTelefono] = useState(cliente?.telefono || '')
  const [cortes, setCortes] = useState(cliente?.servicioIds || [])
  const [notas, setNotas] = useState(cliente?.notas || '')
  const [fotoCorte, setFotoCorte] = useState(cliente?.fotoCorte || null)
  const r = cliente ? resumenCliente(estado, cliente) : null

  function guardar() {
    if (!nombre.trim()) return
    guardarCliente(cliente?.id ?? null, { nombre, telefono, servicioIds: cortes, notas, fotoCorte })
    onListo()
  }

  return (
    <div className="space-y-4">
      {r && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Dato titulo="Visitas" valor={r.visitas} />
            <Dato titulo="Última" valor={r.dias == null ? '—' : r.dias === 0 ? 'Hoy' : `${r.dias} d`} />
            <Dato titulo="Gastó" valor={formatearMonto(r.gastado)} />
          </div>
          {r.fidelidad && (
            <div className="rounded-2xl border border-laton/40 bg-laton-suave p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-laton">Tarjeta de fidelidad</p>
              <Sellos f={r.fidelidad} />
              <p className="mt-1 text-xs text-tinta-suave">
                {r.fidelidad.tocaGratis ? 'Su próximo corte es gratis. Se aplica al cobrar.' : `Le faltan ${r.fidelidad.meta - r.fidelidad.sellos} para su corte gratis.`}
              </p>
            </div>
          )}
          {cliente.telefono && <BotonRecordar cliente={cliente} config={estado.config} resumen={r} grande />}
        </>
      )}

      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre"
        aria-label="Nombre"
        className="w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 font-bold text-tinta outline-none focus-visible:border-laton"
      />
      <input
        type="tel"
        inputMode="tel"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="Celular (opcional · si es niño, el de su papá o mamá)"
        aria-label="Celular"
        className="cifra w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton"
      />
      <p className="-mt-2 text-xs text-tinta-suave">Sin celular también se guarda (solo con su nombre). Con el celular de su papá o mamá, en la página de clientes se encuentran todos los de la familia.</p>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">Su corte de siempre</p>
        <ElegirCortes servicios={servicios} elegidos={cortes} onCambiar={setCortes} />
      </div>
      {/* Foto de su corte (pedido del usuario, 2026-10-20): cómo le gusta,
          para que cualquier barbero se lo haga igual. Solo la ve el dueño. */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">Foto de su corte</p>
        <div className="flex items-center gap-3">
          <FotoCorte servicio={{ foto: fotoCorte, nombre: `Corte de ${nombre || 'cliente'}` }} tam="h-20 w-20" ampliable />
          <SubirFotoCorte foto={fotoCorte} onFoto={setFotoCorte} />
        </div>
      </div>
      <textarea
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={2}
        placeholder="Notas (ej. número 2 a los costados, sin raya)"
        className="w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 text-sm text-tinta outline-none focus-visible:border-laton"
      />
      <button type="button" onClick={guardar} disabled={!nombre.trim()} className="w-full rounded-2xl bg-laton py-3.5 font-extrabold text-fondo disabled:opacity-40">
        Guardar
      </button>

      {r && r.historial.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">Sus visitas</p>
          <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea">
            {r.historial.slice(0, 15).map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block">
                    {new Date(h.fin).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} · {formatearHora(h.fin)}
                  </span>
                  <span className="block truncate text-xs text-laton">{h.cobro?.servicios?.map((x) => x.nombre).join(' + ') || '—'}</span>
                </span>
                <span className="cifra shrink-0 font-bold">{h.cobro?.gratis ? '🎁' : formatearMonto(h.cobro?.monto || 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cliente && (
        <button
          type="button"
          onClick={() => {
            if (confirm(`¿Borrar a ${cliente.nombre}? Sus visitas quedan en la caja.`)) {
              eliminarCliente(cliente.id)
              onListo()
            }
          }}
          className="w-full text-center text-sm text-ocupada underline decoration-dotted"
        >
          Borrar cliente
        </button>
      )}
    </div>
  )
}

function Dato({ titulo, valor }) {
  return (
    <div className="rounded-2xl bg-fondo px-2 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-tinta-suave">{titulo}</p>
      <p className="cifra text-lg font-extrabold">{valor}</p>
    </div>
  )
}
