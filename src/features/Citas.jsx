import { useState } from 'react'
import { useEstado, guardarCita, cambiarEstadoCita, cancelarCita, eliminarCita, guardarCliente, aceptarCita, ocuparSilla, unirCitaConSilla, cambiarHoraCita } from '../data/store'
import { claveDia, formatearDia, formatearHora } from '../domain/hora'
import { linkWhatsapp } from '../domain/clientes'
import { formatearMonto } from '../domain/dinero'
import { Hoja } from '../ui/Hoja'
import { ElegirCliente, ElegirCortes, HojaOcupar } from '../ui/Cobro'
import { ElegirBarbero } from '../ui/ElegirBarbero'
import { ElegirHora } from '../ui/ElegirHora'
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
  const [moviendo, setMoviendo] = useState(null) // cita a la que se le da otra hora
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
      onOtraHora={() => setMoviendo(c)}
      onCancelar={() => setCancelando(c)}
      onLlego={() => {
        if (!sillaParaCita(c, sillas)) return alert('No hay ninguna silla libre ahora. Cobra o libera una y vuelve a tocar «Llegó».')
        setSentando(c)
      }}
      onNoLlego={() => cambiarEstadoCita(c.id, 'no-llego')}
      onEliminar={() => {
        if (!confirm(`¿Eliminar la cita de ${c.nombre} (${hora12(c.hora)})? Se borra del todo.${ESTADOS_ACTIVOS.includes(c.estado) ? ' Su hora queda libre.' : ''}`)) return
        eliminarCita(c.id)
        setAviso(`🗑 Se eliminó la cita de ${c.nombre}`)
      }}
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

      {moviendo && (
        <Hoja titulo={`Otra hora para ${moviendo.nombre}`} subtitulo={`Pidió ${formatearDia(moviendo.fecha)} · ${hora12(moviendo.hora)}`} onCerrar={() => setMoviendo(null)}>
          <OtraHora
            cita={conCelular(moviendo)}
            estado={estado}
            onListo={(hora) => {
              setMoviendo(null)
              setAviso(`🕐 La cita de ${moviendo.nombre} quedó a las ${hora12(hora)}.`)
            }}
          />
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

      {/* Una cita activa se edita; una que ya terminó (atendida, cancelada,
          no llegó) solo se ve, con lo que pasó. */}
      {editando && (editando === 'nueva' || ESTADOS_ACTIVOS.includes(editando.estado)) && (
        <Hoja titulo={editando === 'nueva' ? 'Nueva cita' : 'Editar cita'} onCerrar={() => setEditando(null)}>
          <FormCita cita={editando === 'nueva' ? null : editando} diaInicial={dia} sillas={sillas} servicios={servicios} clientes={clientes} barberos={barberos} onListo={() => setEditando(null)} />
        </Hoja>
      )}
      {editando && editando !== 'nueva' && !ESTADOS_ACTIVOS.includes(editando.estado) && (
        <Hoja titulo={`Cita de ${editando.nombre}`} subtitulo={`${formatearDia(editando.fecha)} · ${hora12(editando.hora)}`} onCerrar={() => setEditando(null)}>
          <DetalleCita
            cita={editando}
            estado={estado}
            onEliminar={() => {
              if (!confirm(`¿Eliminar la cita de ${editando.nombre}? Se borra del todo.`)) return
              eliminarCita(editando.id)
              setEditando(null)
              setAviso(`🗑 Se eliminó la cita de ${editando.nombre}`)
            }}
          />
        </Hoja>
      )}
    </div>
  )
}

// Una cita, con lo que se puede hacer según cómo está.
function FilaCita({ cita: c, conFecha, estado, ahora, onEditar, onAceptar, onOtraHora, onCancelar, onLlego, onNoLlego, onEliminar }) {
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
  // Ya está sentado en una silla, pero sin su cita elegida.
  const sentadoSinCita = activa && esHoy && c.clienteId && sillas.find((s) => s.ocupadaDesde && s.clienteId === c.clienteId && !s.citaId)
  const info = ESTADOS[c.estado] || ESTADOS.pendiente

  return (
    <li className={`overflow-hidden rounded-2xl border bg-panel ${vencida ? 'border-ocupada' : c.estado === 'confirmada' ? 'border-libre' : activa ? 'border-laton/60' : 'border-linea'} ${['cancelada', 'no-llego'].includes(c.estado) ? 'opacity-60' : ''}`}>
      {/* La tarjeta no se abre al tocarla: para editar o ver hay botón abajo. */}
      <div className="flex w-full items-center gap-3 p-4 text-left">
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
          {c.horaPedida && (c.horaPedida !== c.hora || c.fechaPedida !== c.fecha) && (
            <span className="block text-[11px] font-semibold text-laton">🕐 Había pedido {c.fechaPedida !== c.fecha ? `${formatearDia(c.fechaPedida)} ` : ''}{hora12(c.horaPedida)}</span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${info.clase}`}>{info.texto}</span>
          {c.origen === 'web' && <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-bold text-tinta-suave">📱 web{c.clienteId ? ' · frecuente' : ''}</span>}
        </span>
      </div>

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

      {/* Ya está en una silla: unir la cita con esa silla */}
      {sentadoSinCita && (
        <div className="flex items-center justify-between gap-2 border-t border-libre/40 bg-libre-suave px-4 py-2.5 text-xs">
          <span className="font-bold text-libre">✂ Ya está en {sentadoSinCita.nombre}</span>
          <button type="button" onClick={() => unirCitaConSilla(c.id, sentadoSinCita.id)} className="rounded-lg bg-libre px-3 py-1.5 font-bold text-white">
            ✓ Es su cita · marcar atendida
          </button>
        </div>
      )}

      {/* Se pasó la tolerancia */}
      {vencida && !sentadoSinCita && (
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
      {c.estado === 'pendiente' && !vencida && !sentadoSinCita && (
        <div className="grid grid-cols-3 divide-x divide-linea border-t border-linea text-sm font-bold">
          <button type="button" onClick={onAceptar} className="py-3 text-libre">
            ✓ Aceptar
          </button>
          <button type="button" onClick={onOtraHora} className="py-3 text-laton">
            🕐 Otra hora
          </button>
          <button type="button" onClick={onCancelar} className="py-3 text-ocupada">
            ✕ Rechazar
          </button>
        </div>
      )}

      {/* Aceptada */}
      {c.estado === 'confirmada' && !vencida && !sentadoSinCita && (
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

      <div className="flex justify-end gap-1 border-t border-linea px-3 py-1">
        {c.estado === 'confirmada' && (
          <button type="button" onClick={onOtraHora} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-tinta-suave hover:text-laton">
            🕐 Cambiar hora
          </button>
        )}
        <button type="button" onClick={onEditar} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-tinta-suave hover:text-laton">
          {activa ? '✏ Editar' : '📋 Ver detalle'}
        </button>
        <button type="button" onClick={onEliminar} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-tinta-suave hover:text-ocupada">
          🗑 Eliminar
        </button>
      </div>
    </li>
  )
}

// Una cita que ya terminó: qué se pidió y qué pasó (dónde y con quién se
// atendió y cuánto se cobró, o por qué se canceló). Solo para ver.
function DetalleCita({ cita: c, estado, onEliminar }) {
  const { sillas, servicios, barberos, historial } = estado
  const info = ESTADOS[c.estado] || ESTADOS.pendiente
  const barbero = barberos.find((b) => b.id === c.barberoId)
  const silla = sillas.find((s) => s.id === c.sillaId)
  const cortes = servicios.filter((s) => c.servicioIds?.includes(s.id))
  const cortandose = c.estado === 'atendida' && sillas.find((s) => s.ocupadaDesde && s.citaId === c.id)
  const cobro = c.estado === 'atendida' && historial.find((h) => h.citaId === c.id)
  const filas = [
    ['Estado', <span key="e" className={`rounded-full px-2 py-0.5 text-xs font-bold ${info.clase}`}>{info.texto}</span>],
    ['Cliente', c.nombre],
    ['Pidió', cortes.length ? `${cortes.map((x) => x.nombre).join(' + ')} · ${formatearMonto(cortes.reduce((t, x) => t + x.precio, 0))}` : '—'],
    ['Barbero', barbero?.nombre || 'Cualquiera'],
    ['Silla', silla?.nombre || '—'],
    c.origen === 'web' ? ['Reservó', '📱 Por la página de clientes'] : null,
    c.estado === 'atendida' ? ['Llegó', c.atendidaEn ? formatearHora(c.atendidaEn) : '—'] : null,
    cortandose ? ['Ahora', `✂ Cortándose en ${cortandose.nombre}`] : null,
    cobro ? ['Cobrado', cobro.cobro ? (cobro.cobro.gratis ? 'Corte gratis 🎁' : `${formatearMonto(cobro.cobro.monto)} · ${formatearHora(cobro.fin)}`) : 'Se liberó sin cobrar'] : null,
    cobro?.barbero ? ['Lo atendió', cobro.barbero] : null,
    c.estado === 'cancelada' ? ['Motivo', c.motivo || 'Sin motivo'] : null,
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      <dl className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea">
        {filas.map(([titulo, valor]) => (
          <div key={titulo} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <dt className="text-tinta-suave">{titulo}</dt>
            <dd className="text-right font-semibold">{valor}</dd>
          </div>
        ))}
      </dl>
      {c.estado === 'atendida' && !cortandose && !cobro && <p className="text-xs text-tinta-suave">Cuando se cobre su silla, aquí sale lo cobrado.</p>}
      <button type="button" onClick={onEliminar} className="w-full text-center text-sm text-ocupada underline decoration-dotted">
        🗑 Eliminar cita
      </button>
    </div>
  )
}

function FormCita({ cita, diaInicial, sillas, servicios, clientes, barberos, onListo }) {
  const [barberoId, setBarberoId] = useState(cita?.barberoId || null)
  const [fecha, setFecha] = useState(cita?.fecha || diaInicial)
  const [hora, setHora] = useState(() => {
    if (cita?.hora) return cita.hora
    // De entrada, la próxima media hora (no una que ya pasó).
    const d = new Date(Date.now() + 30 * 60000)
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0)
    return d.toTimeString().slice(0, 5)
  })
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
  // Una cita nueva (o movida) no puede quedar en una hora que ya pasó.
  const hoy = claveDia()
  const ahoraHHMM = new Date().toTimeString().slice(0, 5)
  const movida = !cita || cita.fecha !== fecha || cita.hora !== hora
  const pasada = movida && fecha && hora && (fecha < hoy || (fecha === hoy && hora <= ahoraHHMM))
  const choque = pasada
    ? fecha < hoy
      ? 'Ese día ya pasó. Elige hoy o un día que viene.'
      : `Esa hora ya pasó (son las ${hora12(ahoraHHMM)}). Elige una hora más tarde.`
    : revision && !revision.ok
      ? revision.motivo
      : enSilla
        ? `${enSilla.nombre} ya tiene esa silla a las ${hora12(enSilla.hora)}. Elige otra silla.`
        : null

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
      <div className="space-y-2">
        <input type="date" value={fecha} min={cita ? undefined : hoy} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" className="w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton" />
        <ElegirHora value={hora} onChange={setHora} etiqueta="Hora de la cita" />
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

// Darle otra hora a una cita (pedido del usuario, 2026-10-22: "que la
// cita que pidió pueda ser cambiada por otra hora y avisarle al cliente
// que no hay para esa hora pero sí para la siguiente"). Se proponen las
// próximas horas libres ese día (o se pone otra), se elige la silla y se
// le avisa por WhatsApp. Queda aceptada a la hora nueva.
const aMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const aHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

function OtraHora({ cita, estado, onListo }) {
  const { config, sillas, barberos, servicios, agenda, bloqueos, citas } = estado
  const hoy = claveDia()
  const [fecha, setFecha] = useState(cita.fecha < hoy ? hoy : cita.fecha)
  const [hora, setHora] = useState('')
  const duracion = Number(cita.duracion) || 30
  const barbero = barberos.find((b) => b.id === cita.barberoId)
  const revisar = (h, f = fecha) =>
    revisarHora({ clave: f, hora: h, duracion, barberoId: cita.barberoId, barberoNombre: barbero?.nombre, agenda, bloqueos, horario: config.horario, capacidad: sillas.length, citaId: cita.id })

  // Las próximas 6 horas libres de ese día, cada 15 minutos, desde la que
  // pidió (o desde ahora, si es hoy y ya pasó).
  const ahoraMin = new Date().getHours() * 60 + new Date().getMinutes()
  const desde = Math.max(fecha === cita.fecha ? aMin(cita.hora) + 15 : 0, fecha === hoy ? ahoraMin + 10 : 0)
  const sugeridas = []
  for (let t = Math.ceil(desde / 15) * 15; t < 24 * 60 && sugeridas.length < 6; t += 15) {
    if (revisar(aHHMM(t)).ok) sugeridas.push(aHHMM(t))
  }
  const revision = hora ? revisar(hora) : null

  // La silla: la de su barbero o la que tenía, si a esa hora no tiene otra cita.
  const libreA = (s) => hora && !citaEnSilla(citas, s.id, { fecha, hora, duracion, id: cita.id })
  const [sillaElegida, setSillaElegida] = useState(null)
  const sugerida = [sillas.find((s) => s.id === cita.sillaId), sillas.find((s) => cita.barberoId && s.barberoFijoId === cita.barberoId), ...sillas].find((s) => s && libreA(s))
  const silla = (sillaElegida && libreA(sillas.find((s) => s.id === sillaElegida)) && sillas.find((s) => s.id === sillaElegida)) || sugerida || null

  const cortes = servicios.filter((s) => cita.servicioIds?.includes(s.id))
  const mismoDia = fecha === cita.fecha
  const mensaje = [
    `Hola ${cita.nombre.split(' ')[0]} 👋, te escribimos de *${config.nombre}* ✂`,
    `Para el ${formatearDia(cita.fecha)} a las ${hora12(cita.hora)} ya no tenemos sitio 🙏, pero te reservamos ${mismoDia ? '' : `el *${formatearDia(fecha)}* `}a las *${hora ? hora12(hora) : ''}*${barbero ? ` con ${barbero.nombre}` : ''}${cortes.length ? ` (${cortes.map((x) => x.nombre).join(' + ')})` : ''}.`,
    `⌛ Te esperamos hasta ${tolerancia(config)} minutos.`,
    'Si no te sirve esa hora, respóndenos y vemos otra. ¡Gracias! 💈',
  ].join('\n')
  const wa = linkWhatsapp(cita.telefono, mensaje)
  const listo = Boolean(hora && revision?.ok && silla)

  function cambiar() {
    cambiarHoraCita(cita.id, { fecha, hora, sillaId: silla.id })
    onListo(hora)
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">¿Qué día?</p>
        <input
          type="date"
          value={fecha}
          min={hoy}
          onChange={(e) => {
            if (!e.target.value) return
            setFecha(e.target.value)
            setHora('')
          }}
          className="w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">Horas libres {mismoDia ? 'después de la que pidió' : 'ese día'}</p>
        {sugeridas.length === 0 ? (
          <p className="rounded-xl bg-fondo px-3 py-3 text-center text-sm text-tinta-suave">Ese día ya no hay horas libres. Prueba otro día.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {sugeridas.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHora(h)}
                aria-pressed={hora === h}
                className={`cifra rounded-xl border-2 py-2.5 text-sm font-bold ${hora === h ? 'border-laton bg-laton text-fondo' : 'border-linea'}`}
              >
                {hora12(h)}
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 mb-1.5 text-xs text-tinta-suave">U otra hora:</p>
        <ElegirHora value={hora} onChange={setHora} etiqueta="Otra hora" />
        {revision && !revision.ok && <p className="mt-2 rounded-xl bg-ocupada-suave px-3 py-2 text-sm font-bold text-ocupada">✕ {revision.motivo}</p>}
      </div>

      {hora && revision?.ok && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">¿En qué silla?</p>
          <div className="grid grid-cols-2 gap-2">
            {sillas.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSillaElegida(s.id)}
                disabled={!libreA(s)}
                aria-pressed={silla?.id === s.id}
                className={`rounded-2xl border-2 px-3 py-3 text-left disabled:opacity-40 ${silla?.id === s.id ? 'border-laton bg-laton-suave' : 'border-linea'}`}
              >
                <span className="block font-bold">{s.nombre}</span>
                <span className="block truncate text-xs text-tinta-suave">{libreA(s) ? barberos.find((b) => b.id === s.barberoFijoId)?.nombre || 'Libre' : 'Tiene otra cita'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {listo && wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" onClick={cambiar} className="block w-full rounded-2xl bg-libre py-4 text-center text-base font-extrabold text-white">
          🕐 Pasarla a las {hora12(hora)} y avisarle por WhatsApp
        </a>
      )}
      <button type="button" onClick={cambiar} disabled={!listo} className={`w-full rounded-2xl py-3.5 font-extrabold disabled:opacity-40 ${listo && wa ? 'border border-linea text-tinta-suave' : 'bg-laton text-fondo'}`}>
        {listo ? `🕐 Pasarla a las ${hora12(hora)}${wa ? ' sin avisar' : ''}` : 'Elige una hora libre'}
      </button>
      {!wa && <p className="text-center text-xs text-tinta-suave">Este cliente no tiene celular: avísale tú. Él igual ve la hora nueva en su cuenta.</p>}
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
