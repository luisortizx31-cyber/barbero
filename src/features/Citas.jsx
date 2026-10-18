import { useState } from 'react'
import { useEstado, guardarCita, cambiarEstadoCita, eliminarCita, guardarCliente, aceptarCita } from '../data/store'
import { claveDia, formatearDia, formatearHora } from '../domain/hora'
import { linkWhatsapp } from '../domain/clientes'
import { formatearMonto } from '../domain/dinero'
import { Hoja } from '../ui/Hoja'
import { ElegirCliente, ElegirCortes } from '../ui/Cobro'
import { ElegirBarbero } from '../ui/ElegirBarbero'
import { FotoBarbero } from '../ui/FotoBarbero'
import { duracionDeCortes } from '../domain/horario'
import { ESTADOS_ACTIVOS, momentoCita, esperaHasta, tolerancia } from '../domain/citas'
import { useAhora } from '../domain/hora'

// Citas: el cliente reserva una hora (y si quiere, una silla). Salen en
// la Pantalla ("Reservada 4:30 p. m.") y al ocupar la silla se elige
// quién llegó con cita. Se le puede confirmar por WhatsApp.

function hora12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return formatearHora(d.toISOString())
}

const ESTADOS = {
  pendiente: { texto: 'Por aceptar', clase: 'bg-laton-suave text-laton' },
  confirmada: { texto: '✓ Aceptada', clase: 'bg-libre text-white' },
  atendida: { texto: 'Atendida', clase: 'bg-libre-suave text-libre' },
  cancelada: { texto: 'Cancelada', clase: 'bg-ocupada-suave text-ocupada' },
  'no-llego': { texto: 'No llegó', clase: 'bg-ocupada-suave text-ocupada' },
}

export default function Citas() {
  const { citas, sillas, servicios, clientes, config, barberos } = useEstado()
  const [dia, setDia] = useState(claveDia())
  const [editando, setEditando] = useState(null) // cita | 'nueva'
  const [aceptando, setAceptando] = useState(null) // cita
  const ahora = useAhora(30000)
  const delDia = citas.filter((c) => c.fecha === dia).sort((a, b) => a.hora.localeCompare(b.hora))
  const pendientesProximas = citas.filter((c) => c.estado === 'pendiente' && c.fecha > dia).length

  function moverDia(delta) {
    const [a, m, d] = dia.split('-').map(Number)
    setDia(claveDia(new Date(a, m - 1, d + delta)))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">📅 Citas</h2>
        <button type="button" onClick={() => setEditando('nueva')} className="rounded-xl bg-laton px-4 py-2.5 text-sm font-bold text-fondo">
          + Nueva cita
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-linea bg-panel p-2">
        <button type="button" onClick={() => moverDia(-1)} className="rounded-lg border border-linea px-3 py-2 text-tinta-suave" aria-label="Día anterior">
          ‹
        </button>
        <label className="flex-1 text-center">
          <span className="block font-bold first-letter:uppercase">{dia === claveDia() ? 'Hoy, ' : ''}{formatearDia(dia)}</span>
          <input type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} className="bg-transparent text-center text-xs text-tinta-suave outline-none" />
        </label>
        <button type="button" onClick={() => moverDia(1)} className="rounded-lg border border-linea px-3 py-2 text-tinta-suave" aria-label="Día siguiente">
          ›
        </button>
      </div>

      {delDia.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linea p-6 text-center text-tinta-suave">No hay citas ese día.</p>
      ) : (
        <ul className="space-y-2">
          {delDia.map((c) => {
            const silla = sillas.find((s) => s.id === c.sillaId)
            const barbero = barberos.find((b) => b.id === c.barberoId)
            const cortes = servicios.filter((s) => c.servicioIds?.includes(s.id))
            const wa = linkWhatsapp(c.telefono, mensajeConfirmacion(c, { config, barbero, cortes }))
            const activa = ESTADOS_ACTIVOS.includes(c.estado)
            const vencida = activa && momentoCita(c, config, ahora) === 'vencida'
            return (
              <li key={c.id} className={`overflow-hidden rounded-2xl border bg-panel ${vencida ? 'border-ocupada' : c.estado === 'confirmada' ? 'border-libre' : activa ? 'border-laton/60' : 'border-linea opacity-70'}`}>
                <button type="button" onClick={() => setEditando(c)} className="flex w-full items-center gap-3 p-4 text-left">
                  <span className="cifra shrink-0 text-xl font-extrabold text-laton">{hora12(c.hora)}</span>
                  {barbero && <FotoBarbero barbero={barbero} tam="h-10 w-10" texto="text-sm" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{c.nombre}</span>
                    <span className="block truncate text-xs text-tinta-suave">
                      {barbero ? `✂ ${barbero.nombre}` : silla ? silla.nombre : 'Cualquier barbero'}
                      {cortes.length ? ` · ${cortes.map((x) => x.nombre).join(' + ')} · ${formatearMonto(cortes.reduce((t, x) => t + x.precio, 0))}` : ''}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${(ESTADOS[c.estado] || ESTADOS.pendiente).clase}`}>{(ESTADOS[c.estado] || ESTADOS.pendiente).texto}</span>
                    {c.estado === 'confirmada' && silla && <span className="text-[10px] font-bold text-libre">{silla.nombre}</span>}
                    {c.origen === 'web' && <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-bold text-tinta-suave">📱 por la web</span>}
                  </span>
                </button>
                {vencida && (
                  <div className="flex items-center justify-between gap-2 border-t border-ocupada/40 bg-ocupada-suave px-4 py-2.5 text-sm">
                    <span className="font-bold text-ocupada">⌛ Pasaron {tolerancia(config)} min y no llegó</span>
                    <button type="button" onClick={() => cambiarEstadoCita(c.id, 'no-llego')} className="rounded-lg bg-ocupada px-3 py-1.5 text-xs font-bold text-white">
                      Liberar su hora
                    </button>
                  </div>
                )}
                {activa && !vencida && (
                  <div className="grid grid-cols-3 divide-x divide-linea border-t border-linea text-xs font-bold">
                    {c.estado === 'pendiente' ? (
                      <button type="button" onClick={() => setAceptando(c)} className="py-2.5 text-libre">
                        ✓ Aceptar
                      </button>
                    ) : wa ? (
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="py-2.5 text-center text-libre">
                        💬 Avisarle
                      </a>
                    ) : (
                      <span className="py-2.5 text-center text-tinta-suave/50">Sin celular</span>
                    )}
                    <button type="button" onClick={() => cambiarEstadoCita(c.id, 'atendida')} className="py-2.5 text-tinta-suave">
                      ✓ Atendida
                    </button>
                    <button type="button" onClick={() => confirm('¿Cancelar esta cita?') && cambiarEstadoCita(c.id, 'cancelada')} className="py-2.5 text-ocupada">
                      ✕ Cancelar
                    </button>
                  </div>
                )}
                {c.estado === 'confirmada' && !vencida && (
                  <p className="border-t border-linea px-4 py-1.5 text-[11px] text-tinta-suave">Se le espera hasta las {esperaHasta(c, config)}.</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {pendientesProximas > 0 && <p className="text-center text-xs text-tinta-suave">Hay {pendientesProximas} citas pendientes en los próximos días (usa ›).</p>}

      {aceptando && (
        <Hoja titulo={`Aceptar la cita de ${aceptando.nombre}`} subtitulo={`${formatearDia(aceptando.fecha)} · ${hora12(aceptando.hora)}`} onCerrar={() => setAceptando(null)}>
          <AceptarCita cita={aceptando} sillas={sillas} barberos={barberos} servicios={servicios} config={config} onListo={() => setAceptando(null)} />
        </Hoja>
      )}

      {editando && (
        <Hoja titulo={editando === 'nueva' ? 'Nueva cita' : 'Cita'} onCerrar={() => setEditando(null)}>
          <FormCita cita={editando === 'nueva' ? null : editando} diaInicial={dia} sillas={sillas} servicios={servicios} clientes={clientes} barberos={barberos} onListo={() => setEditando(null)} />
        </Hoja>
      )}
    </div>
  )
}

function FormCita({ cita, diaInicial, sillas, servicios, clientes, barberos, onListo }) {
  const [barberoId, setBarberoId] = useState(cita?.barberoId || null)
  const [fecha, setFecha] = useState(cita?.fecha || diaInicial)
  const [hora, setHora] = useState(cita?.hora || '10:00')
  const [sillaId, setSillaId] = useState(cita?.sillaId || '')
  const [cliente, setCliente] = useState({ clienteId: cita?.clienteId || null, nombre: cita?.nombre || '' })
  const [telefono, setTelefono] = useState(cita?.telefono || '')
  const [cortes, setCortes] = useState(cita?.servicioIds || [])
  const [guardarFrecuente, setGuardarFrecuente] = useState(false)

  // Otra cita pendiente a la misma hora en la misma silla.
  const { citas } = useEstado()
  const choque = sillaId && citas.find((c) => c.id !== cita?.id && c.estado === 'pendiente' && c.fecha === fecha && c.hora === hora && c.sillaId === sillaId)

  function guardar() {
    let { clienteId } = cliente
    if (!clienteId && guardarFrecuente) clienteId = guardarCliente(null, { nombre: cliente.nombre, telefono, servicioIds: cortes }).id
    guardarCita(cita?.id ?? null, {
      fecha,
      hora,
      sillaId: sillaId || null,
      barberoId: barberoId || null,
      duracion: duracionDeCortes(servicios, cortes) ?? 30,
      clienteId,
      nombre: cliente.nombre.trim() || 'Cliente',
      telefono,
      servicioIds: cortes,
    })
    onListo()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" className="rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton" />
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Hora" className="rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton" />
      </div>
      <ElegirCliente
        clientes={clientes}
        valor={cliente}
        placeholder="Nombre del cliente"
        onCambiar={(v) => {
          setCliente(v)
          const c = v.clienteId && clientes.find((x) => x.id === v.clienteId)
          if (c) {
            if (c.telefono) setTelefono(c.telefono)
            if (c.servicioIds?.length) setCortes(c.servicioIds)
          }
        }}
      />
      <input
        type="tel"
        inputMode="tel"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="Celular (para confirmarle por WhatsApp)"
        className="cifra w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton"
      />
      {!cliente.clienteId && cliente.nombre.trim() && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={guardarFrecuente} onChange={(e) => setGuardarFrecuente(e.target.checked)} className="h-4 w-4" />
          Guardarlo como cliente frecuente
        </label>
      )}
      {barberos.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">¿Con qué barbero?</p>
          <ElegirBarbero barberos={barberos} valor={barberoId} onCambiar={setBarberoId} />
        </div>
      )}
      <select value={sillaId} onChange={(e) => setSillaId(e.target.value)} aria-label="Silla" className="w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton">
        <option value="">Cualquier silla</option>
        {sillas.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
            {s.barbero ? ` · ${s.barbero}` : ''}
          </option>
        ))}
      </select>
      {choque && <p className="rounded-xl bg-ocupada-suave px-3 py-2 text-sm text-ocupada">Ya hay una cita a esa hora en esa silla ({choque.nombre}).</p>}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">¿Qué corte? (opcional)</p>
        <ElegirCortes servicios={servicios} elegidos={cortes} onCambiar={setCortes} />
      </div>
      <button type="button" onClick={guardar} disabled={!cliente.nombre.trim() || !fecha || !hora} className="w-full rounded-2xl bg-laton py-4 text-base font-extrabold text-fondo disabled:opacity-40">
        Guardar cita
      </button>
      {cita && (
        <button
          type="button"
          onClick={() => {
            if (confirm('¿Borrar esta cita?')) {
              eliminarCita(cita.id)
              onListo()
            }
          }}
          className="w-full text-center text-sm text-ocupada underline decoration-dotted"
        >
          Borrar cita
        </button>
      )}
    </div>
  )
}

function mensajeConfirmacion(c, { config, barbero, cortes }) {
  return [
    `Hola ${c.nombre.split(' ')[0]} 👋, tu cita en *${config.nombre}* ✂ está *confirmada*:`,
    `📅 ${formatearDia(c.fecha)} a las ${hora12(c.hora)}${barbero ? ` con ${barbero.nombre}` : ''}${cortes.length ? ` (${cortes.map((x) => x.nombre).join(' + ')})` : ''}`,
    `⌛ Te esperamos hasta ${tolerancia(config)} minutos (${esperaHasta(c, config)}); después la hora queda libre.`,
    '¡Te esperamos! 💈',
  ].join('\n')
}

// Aceptar una cita: en qué silla (si pidió barbero, la de ese barbero) y
// avisarle por WhatsApp. Desde ahí la silla sale "Reservada" a esa hora.
function AceptarCita({ cita, sillas, barberos, servicios, config, onListo }) {
  const sugerida = (cita.sillaId && sillas.find((s) => s.id === cita.sillaId)) || sillas.find((s) => cita.barberoId && s.barberoFijoId === cita.barberoId) || sillas[0]
  const [sillaId, setSillaId] = useState(sugerida?.id || null)
  const barbero = barberos.find((b) => b.id === cita.barberoId)
  const cortes = servicios.filter((s) => cita.servicioIds?.includes(s.id))
  const wa = linkWhatsapp(cita.telefono, mensajeConfirmacion(cita, { config, barbero, cortes }))

  function aceptar() {
    aceptarCita(cita.id, sillaId)
    onListo()
  }

  return (
    <div className="space-y-4">
      {barbero && <p className="text-sm">✂ Pidió a <span className="font-bold">{barbero.nombre}</span></p>}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">¿En qué silla? (sale "Reservada" a esa hora)</p>
        <div className="grid grid-cols-2 gap-2">
          {sillas.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSillaId(s.id)}
              aria-pressed={sillaId === s.id}
              className={`rounded-2xl border-2 px-3 py-3 text-left ${sillaId === s.id ? 'border-laton bg-laton-suave' : 'border-linea'}`}
            >
              <span className="block font-bold">{s.nombre}</span>
              <span className="block truncate text-xs text-tinta-suave">{barberos.find((b) => b.id === s.barberoFijoId)?.nombre || 'Sin barbero fijo'}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-tinta-suave">Se le espera hasta {tolerancia(config)} min después de su hora (se cambia en Más → Ajustes).</p>
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" onClick={aceptar} className="block w-full rounded-2xl bg-libre py-4 text-center text-base font-extrabold text-white">
          ✓ Aceptar y avisarle por WhatsApp
        </a>
      ) : null}
      <button type="button" onClick={aceptar} className={`w-full rounded-2xl py-3.5 font-extrabold ${wa ? 'border border-linea text-tinta-suave' : 'bg-libre text-white'}`}>
        ✓ Aceptar{wa ? ' sin avisar' : ''}
      </button>
    </div>
  )
}
