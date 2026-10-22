import { useState } from 'react'
import { useEstado, guardarCita, cambiarEstadoCita, cancelarCita, eliminarCita, guardarCliente, aceptarCita, ocuparSilla } from '../data/store'
import { claveDia, formatearDia, formatearHora } from '../domain/hora'
import { linkWhatsapp } from '../domain/clientes'
import { formatearMonto } from '../domain/dinero'
import { Hoja } from '../ui/Hoja'
import { ElegirCliente, ElegirCortes, HojaOcupar } from '../ui/Cobro'
import { ElegirBarbero } from '../ui/ElegirBarbero'
import { FotoBarbero } from '../ui/FotoBarbero'
import { FotoCorte } from '../ui/FotoCorte'
import { duracionDeCortes, revisarHora } from '../domain/horario'
import { ESTADOS_ACTIVOS, momentoCita, esperaHasta, tolerancia, citaEnSilla, sillaParaCita } from '../domain/citas'
import { useAhora } from '../domain/hora'

// Citas (rehecho a pedido del usuario, 2026-10-22: "arréglame todo lo
// que tenga que ver con las citas, de manera profesional"). Cómo va una
// cita:
//   1. Por aceptar: la pidió el cliente desde su celular. Se ACEPTA
//      (eligiendo su silla y avisándole por WhatsApp) o se RECHAZA.
//      Las que hace el dueño desde aquí ya nacen aceptadas.
//   2. Aceptada: su silla sale "Reservada" en la pantalla desde 30 min
//      antes. Cuando el cliente llega se toca "✂ Llegó": se sienta en su
//      silla con su barbero y sus cortes (o en otra libre). Lo mismo se
//      puede hacer desde la pantalla de Sillas, también los barberos.
//   3. Atendida: está cortándose; al cobrar la silla, la cita muestra lo
//      que se cobró.
//   Si pasa la tolerancia y no llegó: "No llegó" libera su hora. Cancelar
//   deja anotado el motivo y se le puede avisar por WhatsApp.

function hora12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return formatearHora(d.toISOString())
}

const ESTADOS = {
  pendiente: { texto: '⏳ Por aceptar', clase: 'bg-laton-suave text-laton' },
  confirmada: { texto: '✓ Aceptada', clase: 'bg-libre text-white' },
  atendida: { texto: '✂ Atendida', clase: 'bg-libre-suave text-libre' },
  cancelada: { texto: 'Cancelada', clase: 'bg-ocupada-suave text-ocupada' },
  'no-llego': { texto: 'No llegó', clase: 'bg-ocupada-suave text-ocupada' },
}

export default function Citas() {
  const estado = useEstado()
  const { citas, sillas, servicios, clientes, config, barberos } = estado
  const [dia, setDia] = useState(claveDia())
  const [editando, setEditando] = useState(null) // cita | 'nueva'
  const [aceptando, setAceptando] = useState(null) // cita
  const [cancelando, setCancelando] = useState(null) // cita
  const [sentando, setSentando] = useState(null) // cita que llegó
  const [aviso, setAviso] = useState(null)
  const ahora = useAhora(30000)
  const hoy = claveDia()
  // Las citas web de un cliente frecuente no traen celular: es el suyo.
  const conCelular = (c) => (c.telefono || !c.clienteId ? c : { ...c, telefono: clientes.find((x) => x.id === c.clienteId)?.telefono || '' })
  const delDia = citas
    .filter((c) => c.fecha === dia)
    .sort((a, b) => a.hora.localeCompare(b.hora))
    .map(conCelular)
  // Todas las que esperan respuesta (de hoy en adelante), arriba de todo.
  const porAceptar = citas
    .filter((c) => c.estado === 'pendiente' && c.fecha >= hoy)
    .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`))
    .map(conCelular)
  const delDiaSinPorAceptar = delDia.filter((c) => !(c.estado === 'pendiente' && c.fecha >= hoy))

  function moverDia(delta) {
    const [a, m, d] = dia.split('-').map(Number)
    setDia(claveDia(new Date(a, m - 1, d + delta)))
  }

  const fila = (c, conFecha = false) => (
    <FilaCita
      key={c.id}
      cita={c}
      conFecha={conFecha}
      estado={estado}
      ahora={ahora}
      onEditar={() => setEditando(c)}
      onAceptar={() => setAceptando(c)}
      onCancelar={() => setCancelando(c)}
      onLlego={() => {
        if (!sillaParaCita(c, sillas)) return alert('No hay ninguna silla libre ahora. Cobra o libera una y vuelve a tocar «Llegó».')
        setSentando(c)
      }}
      onNoLlego={() => cambiarEstadoCita(c.id, 'no-llego')}
    />
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">📅 Citas</h2>
        <button type="button" onClick={() => setEditando('nueva')} className="rounded-xl bg-laton px-4 py-2.5 text-sm font-bold text-fondo">
          + Nueva cita
        </button>
      </div>

      {aviso && (
        <p role="status" className="rounded-2xl border border-libre/50 bg-libre-suave px-4 py-3 text-sm font-semibold">
          {aviso}
          <button type="button" onClick={() => setAviso(null)} className="ml-2 text-xs text-tinta-suave underline decoration-dotted">
            Ok
          </button>
        </p>
      )}

      {/* Las que esperan respuesta, de cualquier día */}
      {porAceptar.length > 0 && (
        <section className="space-y-2 rounded-3xl border-2 border-laton/60 bg-laton-suave/40 p-3">
          <p className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-laton">📥 Por aceptar ({porAceptar.length})</p>
          <ul className="space-y-2">{porAceptar.map((c) => fila(c, true))}</ul>
        </section>
      )}

      <div className="flex items-center gap-2 rounded-2xl border border-linea bg-panel p-2">
        <button type="button" onClick={() => moverDia(-1)} className="rounded-lg border border-linea px-3 py-2 text-tinta-suave" aria-label="Día anterior">
          ‹
        </button>
        <label className="flex-1 text-center">
          <span className="block font-bold first-letter:uppercase">{dia === hoy ? 'Hoy, ' : ''}{formatearDia(dia)}</span>
          <input type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} className="bg-transparent text-center text-xs text-tinta-suave outline-none" />
        </label>
        <button type="button" onClick={() => moverDia(1)} className="rounded-lg border border-linea px-3 py-2 text-tinta-suave" aria-label="Día siguiente">
          ›
        </button>
      </div>

      {delDiaSinPorAceptar.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linea p-6 text-center text-tinta-suave">
          {delDia.length ? 'Las de este día están arriba, por aceptar.' : 'No hay citas ese día.'}
        </p>
      ) : (
        <ul className="space-y-2">{delDiaSinPorAceptar.map((c) => fila(c))}</ul>
      )}

      {aceptando && (
        <Hoja titulo={`Aceptar la cita de ${aceptando.nombre}`} subtitulo={`${formatearDia(aceptando.fecha)} · ${hora12(aceptando.hora)}`} onCerrar={() => setAceptando(null)}>
          <AceptarCita cita={aceptando} citas={citas} sillas={sillas} barberos={barberos} servicios={servicios} config={config} onListo={() => setAceptando(null)} />
        </Hoja>
      )}

      {cancelando && (
        <Hoja
          titulo={cancelando.estado === 'pendiente' ? `Rechazar la cita de ${cancelando.nombre}` : `Cancelar la cita de ${cancelando.nombre}`}
          subtitulo={`${formatearDia(cancelando.fecha)} · ${hora12(cancelando.hora)}`}
          onCerrar={() => setCancelando(null)}
        >
          <CancelarCita cita={cancelando} config={config} onListo={() => setCancelando(null)} />
        </Hoja>
      )}

      {sentando && (
        <Hoja titulo={`Llegó ${sentando.nombre}`} subtitulo={`Cita de las ${hora12(sentando.hora)}`} onCerrar={() => setSentando(null)}>
          <SentarCita
            cita={sentando}
            estado={estado}
            onListo={(silla, nombre) => {
              setSentando(null)
              setAviso(`✂ ${nombre} ya está en ${silla.nombre}. Cuando termine, cóbrale desde Sillas.`)
            }}
          />
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

// Una cita, con lo que se puede hacer según cómo está.
function FilaCita({ cita: c, conFecha, estado, ahora, onEditar, onAceptar, onCancelar, onLlego, onNoLlego }) {
  const { sillas, servicios, clientes, config, barberos, historial } = estado
  const silla = sillas.find((s) => s.id === c.sillaId)
  const barbero = barberos.find((b) => b.id === c.barberoId)
  const cortes = servicios.filter((s) => c.servicioIds?.includes(s.id))
  const wa = linkWhatsapp(c.telefono, mensajeConfirmacion(c, { config, barbero, cortes }))
  const activa = ESTADOS_ACTIVOS.includes(c.estado)
  const momento = activa ? momentoCita(c, config, ahora) : null
  const vencida = momento === 'vencida'
  const esHoy = c.fecha === claveDia(ahora)
  const fotoCliente = c.clienteId && clientes.find((x) => x.id === c.clienteId)?.fotoCorte
  // Atendida: dónde está o qué se cobró.
  const cortandose = c.estado === 'atendida' && sillas.find((s) => s.ocupadaDesde && s.citaId === c.id)
  const cobrada = c.estado === 'atendida' && historial.find((h) => h.citaId === c.id)
  const info = ESTADOS[c.estado] || ESTADOS.pendiente

  return (
    <li className={`overflow-hidden rounded-2xl border bg-panel ${vencida ? 'border-ocupada' : c.estado === 'confirmada' ? 'border-libre' : activa ? 'border-laton/60' : 'border-linea'} ${['cancelada', 'no-llego'].includes(c.estado) ? 'opacity-60' : ''}`}>
      <button type="button" onClick={onEditar} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="shrink-0 text-center">
          <span className="cifra block text-xl font-extrabold leading-tight text-laton">{hora12(c.hora)}</span>
          {conFecha && <span className="block text-[10px] font-bold uppercase text-tinta-suave">{c.fecha === claveDia(ahora) ? 'hoy' : formatearDia(c.fecha).split(',')[0]}</span>}
        </span>
        {barbero && <FotoBarbero barbero={barbero} tam="h-10 w-10" texto="text-sm" />}
        {fotoCliente && <FotoCorte servicio={{ foto: fotoCliente, nombre: `Corte de ${c.nombre}` }} tam="h-10 w-10" ampliable />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{c.nombre}</span>
          <span className="block truncate text-xs text-tinta-suave">
            {barbero ? `✂ ${barbero.nombre}` : 'Cualquier barbero'}
            {silla ? ` · ${silla.nombre}` : ''}
            {cortes.length ? ` · ${cortes.map((x) => x.nombre).join(' + ')} · ${formatearMonto(cortes.reduce((t, x) => t + x.precio, 0))}` : ''}
          </span>
          {conFecha && <span className="block text-[11px] text-tinta-suave first-letter:uppercase">{formatearDia(c.fecha)}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${info.clase}`}>{info.texto}</span>
          {c.origen === 'web' && <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-bold text-tinta-suave">📱 web{c.clienteId ? ' · frecuente' : ''}</span>}
        </span>
      </button>

      {/* Qué pasó con ella */}
      {c.estado === 'atendida' && (
        <p className="border-t border-linea bg-libre-suave/50 px-4 py-2 text-xs font-semibold text-libre">
          {cortandose
            ? `✂ Cortándose ahora en ${cortandose.nombre}${cortandose.barbero ? ` con ${cortandose.barbero}` : ''}`
            : cobrada
              ? `✓ Cobrado ${cobrada.cobro ? (cobrada.cobro.gratis ? '(corte gratis 🎁)' : formatearMonto(cobrada.cobro.monto)) : '(sin cobrar)'} · ${formatearHora(cobrada.fin)}${cobrada.barbero ? ` · ${cobrada.barbero}` : ''}`
              : `✓ Atendida${c.atendidaEn ? ` a las ${formatearHora(c.atendidaEn)}` : ''}${silla ? ` en ${silla.nombre}` : ''}`}
        </p>
      )}
      {c.estado === 'cancelada' && c.motivo && <p className="border-t border-linea px-4 py-2 text-xs text-ocupada">Motivo: {c.motivo}</p>}

      {/* Se pasó la tolerancia */}
      {vencida && (
        <div className="grid grid-cols-2 divide-x divide-ocupada/30 border-t border-ocupada/40 bg-ocupada-suave text-xs font-bold">
          <button type="button" onClick={onLlego} className="py-2.5 text-libre">
            ✂ Llegó tarde · sentarlo
          </button>
          <button type="button" onClick={onNoLlego} className="py-2.5 text-ocupada">
            ⌛ No llegó · liberar hora
          </button>
        </div>
      )}

      {/* Por aceptar */}
      {c.estado === 'pendiente' && !vencida && (
        <div className="grid grid-cols-2 divide-x divide-linea border-t border-linea text-sm font-bold">
          <button type="button" onClick={onAceptar} className="py-3 text-libre">
            ✓ Aceptar
          </button>
          <button type="button" onClick={onCancelar} className="py-3 text-ocupada">
            ✕ Rechazar
          </button>
        </div>
      )}

      {/* Aceptada */}
      {c.estado === 'confirmada' && !vencida && (
        <>
          <div className={`grid ${esHoy ? 'grid-cols-3' : 'grid-cols-2'} divide-x divide-linea border-t border-linea text-xs font-bold`}>
            {esHoy && (
              <button type="button" onClick={onLlego} className="bg-libre py-2.5 text-white">
                ✂ Llegó
              </button>
            )}
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="py-2.5 text-center text-libre">
                💬 Recordarle
              </a>
            ) : (
              <span className="py-2.5 text-center text-tinta-suave/50">Sin celular</span>
            )}
            <button type="button" onClick={onCancelar} className="py-2.5 text-ocupada">
              ✕ Cancelar
            </button>
          </div>
          <p className="border-t border-linea px-4 py-1.5 text-[11px] text-tinta-suave">
            {momento === 'ahora' ? `● Su silla está reservada. ` : ''}Se le espera hasta las {esperaHasta(c, config)}.
          </p>
        </>
      )}
    </li>
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

  // A esa hora ya están reservadas todas las sillas, o el barbero ya
  // tiene otra cita (pedido del usuario, 2026-10-20).
  const { agenda, bloqueos, citas } = useEstado()
  const duracion = duracionDeCortes(servicios, cortes) ?? 30
  const barbero = barberos.find((b) => b.id === barberoId)
  const revision = fecha && hora ? revisarHora({ clave: fecha, hora, duracion, barberoId, barberoNombre: barbero?.nombre, agenda, bloqueos, capacidad: sillas.length, citaId: cita?.id, soloCupo: true }) : null
  const enSilla = sillaId ? citaEnSilla(citas, sillaId, { fecha, hora, duracion, id: cita?.id }) : null
  const choque = revision && !revision.ok ? revision.motivo : enSilla ? `${enSilla.nombre} ya tiene esa silla a las ${hora12(enSilla.hora)}. Elige otra silla.` : null

  function guardar() {
    let { clienteId } = cliente
    if (!clienteId && guardarFrecuente) clienteId = guardarCliente(null, { nombre: cliente.nombre, telefono, servicioIds: cortes }).id
    guardarCita(cita?.id ?? null, {
      fecha,
      hora,
      sillaId: sillaId || null,
      barberoId: barberoId || null,
      duracion,
      clienteId,
      nombre: cliente.nombre.trim() || 'Cliente',
      telefono,
      servicioIds: cortes,
      // La que hace la barbería ya está aceptada (no hay que aceptarla).
      ...(cita ? {} : { estado: 'confirmada', origen: 'panel' }),
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
      {choque && <p className="rounded-xl bg-ocupada-suave px-3 py-2 text-sm text-ocupada">{choque}</p>}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">¿Qué corte? (opcional)</p>
        <ElegirCortes servicios={servicios} elegidos={cortes} onCambiar={setCortes} />
      </div>
      <button type="button" onClick={guardar} disabled={!cliente.nombre.trim() || !fecha || !hora || Boolean(choque)} className="w-full rounded-2xl bg-laton py-4 text-base font-extrabold text-fondo disabled:opacity-40">
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

// Aceptar una cita: en qué silla (si pidió barbero, la de ese barbero;
// no se puede una silla que ya tiene otra cita aceptada a esa hora) y
// avisarle por WhatsApp. Desde ahí la silla sale "Reservada" a esa hora.
function AceptarCita({ cita, citas, sillas, barberos, servicios, config, onListo }) {
  const ocupadaPor = (s) => citaEnSilla(citas, s.id, cita)
  const sugerida =
    [sillas.find((s) => s.id === cita.sillaId), sillas.find((s) => cita.barberoId && s.barberoFijoId === cita.barberoId), ...sillas].find((s) => s && !ocupadaPor(s)) || null
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
      {barbero && (
        <p className="text-sm">
          ✂ Pidió a <span className="font-bold">{barbero.nombre}</span>
        </p>
      )}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">¿En qué silla? (sale "Reservada" a esa hora)</p>
        <div className="grid grid-cols-2 gap-2">
          {sillas.map((s) => {
            const otra = ocupadaPor(s)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSillaId(s.id)}
                disabled={Boolean(otra)}
                aria-pressed={sillaId === s.id}
                className={`rounded-2xl border-2 px-3 py-3 text-left disabled:opacity-40 ${sillaId === s.id ? 'border-laton bg-laton-suave' : 'border-linea'}`}
              >
                <span className="block font-bold">{s.nombre}</span>
                <span className="block truncate text-xs text-tinta-suave">
                  {otra ? `Tomada: ${otra.nombre} ${hora12(otra.hora)}` : barberos.find((b) => b.id === s.barberoFijoId)?.nombre || 'Sin barbero fijo'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {!sillaId && <p className="rounded-xl bg-ocupada-suave px-3 py-2 text-sm text-ocupada">A esa hora todas las sillas ya tienen una cita aceptada.</p>}
      <p className="text-xs text-tinta-suave">Se le espera hasta {tolerancia(config)} min después de su hora (se cambia en Más → Ajustes).</p>
      {wa && sillaId ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" onClick={aceptar} className="block w-full rounded-2xl bg-libre py-4 text-center text-base font-extrabold text-white">
          ✓ Aceptar y avisarle por WhatsApp
        </a>
      ) : null}
      <button type="button" onClick={aceptar} disabled={!sillaId} className={`w-full rounded-2xl py-3.5 font-extrabold disabled:opacity-40 ${wa ? 'border border-linea text-tinta-suave' : 'bg-libre text-white'}`}>
        ✓ Aceptar{wa ? ' sin avisar' : ''}
      </button>
    </div>
  )
}

// Cancelar (o rechazar) una cita: con el motivo y avisándole al cliente.
function CancelarCita({ cita, config, onListo }) {
  const rechazo = cita.estado === 'pendiente'
  const [motivo, setMotivo] = useState('')
  const texto = [
    `Hola ${cita.nombre.split(' ')[0]} 👋, te escribimos de *${config.nombre}* ✂`,
    rechazo
      ? `Lo sentimos, no podemos atenderte el ${formatearDia(cita.fecha)} a las ${hora12(cita.hora)}.`
      : `Tu cita del ${formatearDia(cita.fecha)} a las ${hora12(cita.hora)} quedó *cancelada*.`,
    motivo.trim() ? `Motivo: ${motivo.trim()}` : '',
    'Puedes reservar otra hora desde nuestra página o escribirnos por aquí. ¡Disculpa las molestias! 🙏',
  ]
    .filter(Boolean)
    .join('\n')
  const wa = linkWhatsapp(cita.telefono, texto)

  function cancelar() {
    cancelarCita(cita.id, motivo)
    onListo()
  }

  return (
    <div className="space-y-4">
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={2}
        placeholder={rechazo ? 'Motivo (opcional), ej. ese día no hay barbero' : 'Motivo (opcional), ej. el cliente avisó que no viene'}
        className="w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 text-sm text-tinta outline-none focus-visible:border-laton"
      />
      <p className="text-xs text-tinta-suave">Su hora queda libre para que otro la pueda reservar.</p>
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" onClick={cancelar} className="block w-full rounded-2xl bg-libre py-4 text-center text-base font-extrabold text-white">
          {rechazo ? '✕ Rechazar y avisarle por WhatsApp' : '✕ Cancelar y avisarle por WhatsApp'}
        </a>
      )}
      <button type="button" onClick={cancelar} className={`w-full rounded-2xl py-3.5 font-extrabold ${wa ? 'border border-linea text-tinta-suave' : 'bg-ocupada text-white'}`}>
        {rechazo ? '✕ Rechazar' : '✕ Cancelar la cita'}
        {wa ? ' sin avisar' : ''}
      </button>
    </div>
  )
}

// Llegó el cliente de la cita: se elige la silla (de entrada la suya, o
// la de su barbero, o una libre) y se ocupa con su cita, su barbero y sus
// cortes ya puestos. Desde ahí se cobra en Sillas como siempre.
function SentarCita({ cita, estado, onListo }) {
  const { sillas, servicios, clientes, espera, barberos } = estado
  const libres = sillas.filter((s) => !s.ocupadaDesde)
  const [sillaId, setSillaId] = useState(sillaParaCita(cita, sillas)?.id || null)
  const silla = libres.find((s) => s.id === sillaId)

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">¿En qué silla se sienta?</p>
        <div className="grid grid-cols-2 gap-2">
          {libres.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSillaId(s.id)}
              aria-pressed={sillaId === s.id}
              className={`rounded-2xl border-2 px-3 py-3 text-left ${sillaId === s.id ? 'border-laton bg-laton-suave' : 'border-linea'}`}
            >
              <span className="block font-bold">{s.nombre}</span>
              <span className="block truncate text-xs text-tinta-suave">
                {s.id === cita.sillaId ? '★ La de su cita' : barberos.find((b) => b.id === s.barberoFijoId)?.nombre || 'Libre'}
              </span>
            </button>
          ))}
        </div>
      </div>
      {silla && (
        <HojaOcupar
          key={silla.id}
          silla={silla}
          sillas={sillas}
          servicios={servicios}
          clientes={clientes}
          espera={espera}
          citas={[cita]}
          barberos={barberos}
          citaInicial={cita.id}
          barberoInicial={cita.barberoId || silla.barberoFijoId || null}
          onOcupar={(datos) => {
            if (ocuparSilla(silla.id, datos) === false) return
            onListo(silla, datos.nombre || cita.nombre)
          }}
        />
      )}
    </div>
  )
}
