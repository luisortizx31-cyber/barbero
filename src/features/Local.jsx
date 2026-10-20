import { useState } from 'react'
import { useEstado, useSesion, reservarCitaWeb, anotarEnEspera, quitarDeEspera, registrarClienteWeb } from '../data/store'
import { useAhora, formatearDuracion, formatearHora, claveDia, formatearDia } from '../domain/hora'
import { esperaEstimada } from '../domain/espera'
import { linkWhatsapp, huellaCelular, digitosCelular } from '../domain/clientes'
import { formatearMonto } from '../domain/dinero'
import { estadoAtencion, proximosDiasAbiertos, horasLibres, duracionDeCortes, duracionDe, hora12 } from '../domain/horario'
import { FotoBarbero } from '../ui/FotoBarbero'
import { barberoDeSilla } from '../domain/sillas'
import { momentoCita, tolerancia } from '../domain/citas'
import { FotoCorte } from '../ui/FotoCorte'
import { ElegirBarbero } from '../ui/ElegirBarbero'
import { ElegirCortes } from '../ui/Cobro'
import { Hoja } from '../ui/Hoja'

// Página para los clientes (#/local/{id}), desde su celular y sin
// cuenta: si está abierto, si hay sitio, qué barbero está cortando en
// cada silla (con su foto), los precios, y dos cosas que puede hacer:
// reservar una cita con su barbero de preferencia, o anotarse en la cola
// de hoy (pedido del usuario, 2026-10-18). No muestra nombres de nadie.

// Lo que el cliente hizo desde este celular (su turno, su cita), para
// mostrárselo al volver a la página.
function useRecuerdo(clave) {
  const [valor, setValor] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(clave))
    } catch {
      return null
    }
  })
  function guardar(v) {
    setValor(v)
    try {
      if (v) localStorage.setItem(clave, JSON.stringify(v))
      else localStorage.removeItem(clave)
    } catch {
      // sin localStorage, solo no se recuerda
    }
  }
  return [valor, guardar]
}

export default function Local() {
  const { config, sillas, barberos, espera, historial, servicios, agenda, fichas, telefonoBarberia } = useEstado()
  const { barberiaId } = useSesion()
  const ahora = useAhora(15000)
  const [hoja, setHoja] = useState(null) // 'cita' | 'espera'
  const [citaCon, setCitaCon] = useState(null) // barbero elegido desde "Nuestros barberos"
  const [miTurno, setMiTurno] = useRecuerdo(`barberia:miturno:${barberiaId}`)
  const [miCita, setMiCita] = useRecuerdo(`barberia:micita:${barberiaId}`)
  // Quién es el cliente de este celular (si ya entró a su cuenta). Se lee
  // en cada vuelta; `yoVersion` obliga a volver a mirar al entrar o salir.
  const [yoVersion, setYoVersion] = useState(0)
  const yoId = quienRecordado(barberiaId, fichas, yoVersion).clienteId
  const yo = yoId ? fichas.find((f) => f.id === yoId) : null

  const atencion = estadoAtencion(config.horario, ahora)
  const libres = sillas.filter((s) => !s.ocupadaDesde)
  const esperas = esperaEstimada(sillas, [...espera, { id: 'yo' }], historial, ahora, servicios)
  const miEspera = esperas.at(-1)
  const barberoDe = (s) => barberos.find((b) => b.id === barberoDeSilla(s)) || (s.barbero ? { nombre: s.barbero } : null)
  const wa = linkWhatsapp(telefonoBarberia, `Hola ${config.nombre} 👋, quisiera un corte. ¿Tienen sitio?`)

  // Mi lugar en la cola (si me anoté desde este celular y sigo ahí).
  const posicion = miTurno ? espera.findIndex((x) => x.id === miTurno.id) : -1
  const esperasCola = esperaEstimada(sillas, espera, historial, ahora, servicios)
  // Solo si sigue en la agenda: si la barbería la canceló (o ya se
  // atendió, o no llegó), deja de salir. Las reservas de antes no
  // guardaban el id: se buscan por día y hora.
  const enAgenda = miCita && agenda.find((a) => (miCita.id ? a.id === miCita.id : a.fecha === miCita.fecha && a.hora === miCita.hora))
  const citaVigente = miCita && miCita.fecha >= claveDia() && enAgenda ? { ...miCita, confirmada: enAgenda.confirmada } : null
  // Silla reservada ahora para una cita aceptada (de la agenda pública).
  const reservaDe = (s) => agenda.find((a) => a.confirmada && a.sillaId === s.id && a.fecha === claveDia() && momentoCita(a, config, ahora) === 'ahora')
  const cortandoEn = (b) => sillas.find((s) => s.ocupadaDesde && s.barberoId === b.id)

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-laton">✂ Barbería</p>
        <h1 className="text-3xl font-extrabold">{config.nombre}</h1>
        <p className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold ${atencion.abierto ? 'bg-libre-suave text-libre' : 'bg-ocupada-suave text-ocupada'}`}>
          {atencion.abierto ? '● ' : '○ '}
          {atencion.texto}
        </p>
      </div>

      {/* Mi turno en la cola */}
      {posicion >= 0 && (
        <div className="rounded-3xl border-2 border-laton bg-laton-suave p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-laton">Tu turno, {miTurno.nombre}</p>
          <p className="text-4xl font-extrabold">{posicion === 0 ? '¡Eres el siguiente!' : `Eres el ${posicion + 1}º`}</p>
          <p className="text-sm">
            {esperasCola[posicion] < 60000 ? 'Ya te pueden atender: acércate.' : `Te atienden en ~${formatearDuracion(esperasCola[posicion])}`}
            {miTurno.barberoNombre ? ` · con ${miTurno.barberoNombre}` : ''}
          </p>
          <button
            type="button"
            onClick={() => {
              if (!confirm('¿Salir de la espera?')) return
              quitarDeEspera(miTurno.id)
              setMiTurno(null)
            }}
            className="mt-2 text-xs text-tinta-suave underline decoration-dotted"
          >
            Ya no voy, sacarme de la espera
          </button>
        </div>
      )}

      {/* Mi cita */}
      {citaVigente && (
        <div className="rounded-3xl border-2 border-libre bg-libre-suave p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-libre">Tu cita</p>
          <p className="text-xl font-extrabold first-letter:uppercase">
            {formatearDia(citaVigente.fecha)} · {hora12(citaVigente.hora)}
          </p>
          {citaVigente.barberoNombre && <p className="text-sm">✂ con {citaVigente.barberoNombre}</p>}
          <p className="mt-1 text-sm font-bold">{citaVigente.confirmada ? '✓ Confirmada por la barbería' : '⏳ Esperando que la barbería la confirme'}</p>
          <p className="mt-1 text-xs font-semibold">⌛ Llega a tiempo: te esperamos máximo {tolerancia(config)} minutos.</p>
          <p className="mt-1 text-xs text-tinta-suave">Para cambiarla o cancelarla, escríbele a la barbería.</p>
        </div>
      )}

      {/* ¿Hay sitio? */}
      {posicion < 0 && (
        <div className={`rounded-3xl p-5 text-center ${!atencion.abierto ? 'bg-panel-2' : libres.length && !espera.length ? 'bg-libre text-white' : 'bg-laton text-fondo'}`}>
          {!atencion.abierto ? (
            <>
              <p className="text-2xl font-extrabold">Ahora estamos cerrados</p>
              <p className="text-sm text-tinta-suave">Reserva tu cita para cuando abramos 👇</p>
            </>
          ) : libres.length && !espera.length ? (
            <>
              <p className="text-3xl font-extrabold">¡Hay sitio!</p>
              <p className="text-sm font-semibold">
                {libres.length} {libres.length === 1 ? 'silla libre' : 'sillas libres'} ahora. Te atienden al llegar.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold uppercase tracking-wide">Si vienes ahora esperas</p>
              <p className="cifra text-4xl font-extrabold">~{formatearDuracion(Math.max(miEspera ?? 0, 5 * 60000))}</p>
              <p className="text-sm font-semibold">
                {espera.length} {espera.length === 1 ? 'persona esperando' : 'personas esperando'}
              </p>
            </>
          )}
        </div>
      )}

      <div className={`grid gap-2 ${atencion.abierto && posicion < 0 ? 'grid-cols-2' : ''}`}>
        <button
          type="button"
          onClick={() => {
            setCitaCon(null)
            setHoja('cita')
          }}
          className="rounded-2xl bg-laton py-3.5 font-extrabold text-fondo"
        >
          📅 Reservar cita
        </button>
        {atencion.abierto && posicion < 0 && (
          <button type="button" onClick={() => setHoja('espera')} className="rounded-2xl border-2 border-laton py-3.5 font-extrabold text-laton">
            ⏳ Anótame
          </button>
        )}
      </div>
      {(yo ? (
          <button type="button" onClick={() => setHoja('tarjeta')} className="flex w-full items-center gap-3 rounded-2xl border-2 border-libre bg-libre-suave px-4 py-3 text-left">
            <span className="text-2xl">👋</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold">¡Bienvenido, {yo.nombre.split(' ')[0]}!</span>
              <span className="block text-xs text-tinta-suave">
                {yo.tarjeta ? (yo.tarjeta.tocaGratis ? '🎁 ¡Tu próximo corte es gratis!' : `🎁 Llevas ${yo.tarjeta.sellos} de ${yo.tarjeta.meta} en tu tarjeta`) : 'Tu tarjeta y tus cortes'}
              </span>
            </span>
            <span className="shrink-0 text-sm font-bold text-libre">Mi cuenta ›</span>
          </button>
        ) : (
          <button type="button" onClick={() => setHoja('tarjeta')} className="w-full rounded-2xl border border-linea bg-panel py-3 font-bold">
            👤 Entrar a mi cuenta · o registrarme si soy nuevo
          </button>
        ))}

      {/* Nuestros barberos: el cliente ve a cada uno (su foto en grande al
          tocarla) y reserva con el que prefiere. */}
      {barberos.length > 0 && (
        <div className="rounded-2xl border border-linea bg-panel p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-tinta-suave">Nuestros barberos</p>
          <ul className="grid grid-cols-2 gap-3">
            {barberos.map((b) => {
              const silla = cortandoEn(b)
              return (
                <li key={b.id} className="flex flex-col items-center gap-1.5 rounded-2xl bg-fondo p-3 text-center">
                  <FotoBarbero barbero={b} tam="h-20 w-20" texto="text-2xl" ampliable />
                  <p className="w-full truncate font-extrabold">{b.nombre}</p>
                  <p className={`text-xs font-bold ${silla ? 'text-ocupada' : 'text-libre'}`}>{silla ? `Cortando en ${silla.nombre}` : 'Disponible'}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCitaCon(b.id)
                      setHoja('cita')
                    }}
                    className="mt-1 w-full rounded-xl border border-laton/60 py-1.5 text-xs font-bold text-laton"
                  >
                    📅 Reservar con {b.nombre.split(' ')[0]}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <ul className="space-y-3">
        {sillas.map((s) => {
          const ocupada = Boolean(s.ocupadaDesde)
          const b = barberoDe(s)
          const reserva = !ocupada && reservaDe(s)
          return (
            <li key={s.id} className={`flex items-center gap-4 rounded-2xl border-2 bg-panel p-4 ${ocupada ? 'border-ocupada' : reserva ? 'border-laton' : 'border-libre'}`}>
              {b && ocupada ? <FotoBarbero barbero={b} tam="h-16 w-16" texto="text-xl" ampliable /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-panel-2 text-3xl">💈</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-extrabold">{s.nombre}</p>
                {b && (ocupada ? <p className="truncate text-sm">✂ {b.nombre} cortando</p> : <p className="truncate text-xs text-tinta-suave">Silla de {b.nombre}</p>)}
                <p className={`text-sm font-bold ${ocupada ? 'text-ocupada' : reserva ? 'text-laton' : 'text-libre'}`}>
                  {ocupada
                    ? `Cortando · hace ${formatearDuracion(ahora - new Date(s.ocupadaDesde))}`
                    : reserva
                      ? `Reservada para las ${hora12(reserva.hora)}`
                      : s.liberadaEn
                        ? `Libre desde ${formatearHora(s.liberadaEn)}`
                        : 'Libre'}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold uppercase ${ocupada ? 'bg-ocupada text-white' : reserva ? 'bg-laton text-fondo' : 'bg-libre text-white'}`}>
                {ocupada ? 'Ocupada' : reserva ? 'Reservada' : 'Libre'}
              </span>
            </li>
          )
        })}
      </ul>

      {/* Precios */}
      {servicios.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-linea bg-panel">
          <p className="border-b border-linea px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-tinta-suave">Precios</p>
          <ul className="divide-y divide-linea">
            {servicios.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <FotoCorte servicio={x} tam="h-14 w-14" ampliable />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{x.nombre}</span>
                  <span className="text-xs text-tinta-suave">⏱ {duracionDe(x)} min</span>
                </span>
                <span className="cifra font-extrabold text-laton">{formatearMonto(x.precio)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="block w-full rounded-2xl bg-libre py-3.5 text-center font-extrabold text-white">
          💬 Escribir a la barbería
        </a>
      )}
      <p className="text-center text-xs text-tinta-suave">Toca la foto de un barbero para verla en grande. Se actualiza solo; el tiempo es aproximado.</p>

      {hoja === 'cita' && (
        <Hoja titulo="Reservar cita" onCerrar={() => setHoja(null)}>
          <ReservarCita
            barberoInicial={citaCon}
            estado={{ config, servicios, barberos, agenda, fichas, telefonoBarberia }}
            onReservada={(cita) => setMiCita(cita)}
            onCerrar={() => setHoja(null)}
          />
        </Hoja>
      )}
      {hoja === 'tarjeta' && (
        <Hoja titulo="Mi cuenta" onCerrar={() => setHoja(null)}>
          <MiCuenta
            fichas={fichas}
            onCambio={() => setYoVersion((n) => n + 1)}
            onReservar={() => {
              setCitaCon(null)
              setHoja('cita')
            }}
          />
        </Hoja>
      )}
      {hoja === 'espera' && (
        <Hoja titulo="Anotarme en la espera" onCerrar={() => setHoja(null)}>
          <Anotarme
            servicios={servicios}
            barberos={barberos}
            fichas={fichas}
            onAnotar={(datos) => {
              const nuevo = anotarEnEspera({ ...datos, web: true })
              setMiTurno({ id: nuevo.id, nombre: datos.nombre, barberoNombre: barberos.find((b) => b.id === datos.barberoId)?.nombre || '' })
              setHoja(null)
            }}
          />
        </Hoja>
      )}
    </div>
  )
}

const CLASE_INPUT = 'w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton'

function Paso({ n, titulo, children }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">
        <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-laton text-[11px] text-fondo">{n}</span>
        {titulo}
      </p>
      {children}
    </div>
  )
}

// ¿Quién eres? (pedido del usuario, 2026-10-20): el cliente frecuente se
// busca por su nombre o su celular y se elige; así la cita o el turno
// quedan a su nombre (el dueño ya tiene su celular). Si no aparece, pone
// sus datos como cliente nuevo. Se recuerda quién es en este celular.
// valor: { clienteId, nombre, telefono }
const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

function claveYo(barberiaId) {
  return `barberia:yocliente:${barberiaId}`
}

function quienRecordado(barberiaId, fichas) {
  try {
    const f = fichas.find((x) => x.id === localStorage.getItem(claveYo(barberiaId)))
    if (f) return { clienteId: f.id, nombre: f.nombre, telefono: '' }
  } catch {
    // sin localStorage, solo no se recuerda
  }
  return { clienteId: null, nombre: '', telefono: '' }
}

function recordarQuien(barberiaId, id) {
  try {
    if (id) localStorage.setItem(claveYo(barberiaId), id)
    else localStorage.removeItem(claveYo(barberiaId))
  } catch {
    // sin localStorage, solo no se recuerda
  }
}

// Lo que el cliente ve de sí mismo al elegirse (pedido del usuario,
// 2026-10-20): sus datos, cuántas veces vino, su último corte y su
// tarjeta; con `completa` ("Mi cuenta"), además sus próximas citas, sus
// últimos cortes (con la foto del corte si la tiene) y su corte de siempre.
function MiFicha({ ficha, onNoSoyYo, completa = false }) {
  const { servicios } = useEstado()
  const t = ficha.tarjeta
  const ultimos = (ficha.ultimos || []).slice(0, completa ? 5 : 1)
  const fotoDe = (cortes) => servicios.find((x) => x.foto && cortes?.includes(x.nombre)) || null
  const deSiempre = servicios.filter((x) => ficha.servicioIds?.includes(x.id))
  return (
    <div className="space-y-3 rounded-2xl border-2 border-libre bg-libre-suave p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">👋</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-extrabold">¡Bienvenido, {ficha.nombre.split(' ')[0]}!</span>
          <span className="block truncate text-sm font-bold">{ficha.nombre}</span>
          <span className="cifra block text-xs text-tinta-suave">
            {ficha.fin ? `Celular •••${ficha.fin} · ` : ''}
            {ficha.visitas ? `${ficha.visitas} ${ficha.visitas === 1 ? 'visita' : 'visitas'}` : 'Todavía sin visitas'}
          </span>
        </span>
        <button type="button" onClick={onNoSoyYo} className="shrink-0 text-xs text-tinta-suave underline decoration-dotted">
          No soy yo
        </button>
      </div>

      {completa && ficha.citas?.length > 0 && (
        <div className="rounded-xl bg-fondo p-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-tinta-suave">📅 Tus próximas citas</p>
          <ul className="space-y-1">
            {ficha.citas.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-bold first-letter:uppercase">
                  {formatearDia(c.fecha)} · {hora12(c.hora)}
                </span>
                <span className={`shrink-0 text-xs font-bold ${c.confirmada ? 'text-libre' : 'text-laton'}`}>{c.confirmada ? '✓ Confirmada' : '⏳ Por confirmar'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ultimos.length > 0 && (
        <div className="rounded-xl bg-fondo p-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-tinta-suave">{completa ? '✂ Tus últimos cortes' : '✂ Tu último corte'}</p>
          <ul className="space-y-2">
            {ultimos.map((h, i) => (
              <li key={i} className="flex items-center gap-3">
                <FotoCorte servicio={fotoDe(h.cortes)} tam="h-12 w-12" ampliable />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">
                    {h.cortes?.length ? h.cortes.join(' + ') : 'Corte'}
                    {h.gratis ? ' 🎁' : ''}
                  </span>
                  <span className="block text-xs text-tinta-suave first-letter:uppercase">
                    {formatearDia(h.fecha)}
                    {h.barbero ? ` · con ${h.barbero}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {completa && deSiempre.length > 0 && (
        <div className="rounded-xl bg-fondo p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-tinta-suave">💈 Tu corte de siempre</p>
          <p className="font-bold">{deSiempre.map((x) => x.nombre).join(' + ')}</p>
        </div>
      )}

      {t && (
        <div className="rounded-xl bg-fondo p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-laton">🎁 Tu tarjeta</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label={`Llevas ${t.sellos} de ${t.meta}`}>
            {Array.from({ length: t.meta }, (_, i) => (
              <span key={i} className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm ${i < t.sellos ? 'border-laton bg-laton text-fondo' : 'border-linea'}`}>
                {i < t.sellos ? '✂' : ''}
              </span>
            ))}
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed text-sm ${t.tocaGratis ? 'border-libre bg-libre text-white' : 'border-laton/60'}`}>🎁</span>
          </div>
          <p className="mt-1.5 text-sm font-bold">
            {t.tocaGratis
              ? '¡Tu próximo corte es GRATIS!'
              : `Llevas ${t.sellos} ${t.sellos === 1 ? 'corte' : 'cortes'}. Te ${t.meta - t.sellos === 1 ? 'falta 1' : `faltan ${t.meta - t.sellos}`} para uno gratis.`}
          </p>
        </div>
      )}
    </div>
  )
}

// `soloBuscar`: para "Ver mi tarjeta" (sin la opción de cliente nuevo).
function QuienEres({ fichas, valor, onCambiar, onElegido, pedirCelular = true, soloBuscar = false, completa = false }) {
  const { barberiaId } = useSesion()
  const [busqueda, setBusqueda] = useState('')
  const [nuevo, setNuevo] = useState(fichas.length === 0)
  const elegido = valor.clienteId && fichas.find((f) => f.id === valor.clienteId)

  if (elegido) {
    return (
      <MiFicha
        ficha={elegido}
        completa={completa}
        onNoSoyYo={() => {
          recordarQuien(barberiaId, null)
          onCambiar({ clienteId: null, nombre: '', telefono: '' })
        }}
      />
    )
  }

  if (nuevo && !soloBuscar) {
    return (
      <div className="space-y-2">
        <input value={valor.nombre} onChange={(e) => onCambiar({ ...valor, nombre: e.target.value })} placeholder="Tu nombre" className={CLASE_INPUT} />
        {pedirCelular && (
          <input
            type="tel"
            inputMode="tel"
            value={valor.telefono}
            onChange={(e) => onCambiar({ ...valor, telefono: e.target.value })}
            placeholder="Tu celular"
            className={`${CLASE_INPUT} cifra`}
          />
        )}
        {fichas.length > 0 && (
          <button type="button" onClick={() => setNuevo(false)} className="text-xs text-laton underline decoration-dotted">
            ¿Ya viniste antes? Búscate aquí
          </button>
        )}
      </div>
    )
  }

  // Con el celular completo se encuentra por su huella; con el nombre,
  // desde 3 letras.
  const q = sinTildes(busqueda)
  const digitos = digitosCelular(busqueda)
  const huella = digitos.length === 9 ? huellaCelular(digitos, barberiaId) : null
  const encontrados = huella
    ? fichas.filter((f) => f.huella === huella)
    : /\d/.test(q) || q.length < 3
      ? []
      : fichas.filter((f) => sinTildes(f.nombre).includes(q)).slice(0, 6)

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="🔍 Busca tu nombre o tu celular"
        aria-label="Busca tu nombre o tu celular"
        className={CLASE_INPUT}
      />
      {encontrados.length > 0 && (
        <ul className="divide-y divide-linea overflow-hidden rounded-xl border border-linea">
          {encontrados.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => {
                  recordarQuien(barberiaId, f.id)
                  onCambiar({ clienteId: f.id, nombre: f.nombre, telefono: '' })
                  onElegido?.(f)
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              >
                <span className="truncate font-bold">{f.nombre}</span>
                <span className="cifra shrink-0 text-xs text-tinta-suave">{f.fin ? `cel •••${f.fin}` : ''} · Soy yo ›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {(huella || q.length >= 3) && encontrados.length === 0 && (
        <p className="text-center text-xs text-tinta-suave">{soloBuscar ? 'No te encontramos. Pídele a la barbería que te registre.' : 'No te encontramos. Si es tu primera vez, pon tus datos 👇'}</p>
      )}
      {digitos.length > 0 && digitos.length < 9 && /^[\d\s+]+$/.test(busqueda) && <p className="text-center text-xs text-tinta-suave">Escribe tu celular completo (9 números).</p>}
      {!soloBuscar && <button
        type="button"
        onClick={() => {
          setNuevo(true)
          // Lo que escribió en el buscador pasa a su nombre o su celular.
          if (digitos.length === 9) onCambiar({ ...valor, telefono: digitos })
          else if (busqueda.trim() && !/\d/.test(busqueda)) onCambiar({ ...valor, nombre: busqueda.trim() })
        }}
        className="w-full rounded-xl border border-dashed border-linea py-2.5 text-sm font-bold text-tinta-suave"
      >
        Es mi primera vez · poner mis datos
      </button>}
    </div>
  )
}

// Registro del cliente nuevo: nombre y celular (si es niño, el de su papá
// o mamá). Queda dentro de su cuenta al terminar.
function Registrarme({ onListo, onYaTengo }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const ok = nombre.trim() && digitosCelular(telefono).length === 9

  async function registrar() {
    setEnviando(true)
    setError('')
    try {
      onListo(await registrarClienteWeb({ nombre, telefono }))
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-tinta-suave">Regístrate una sola vez: después ves tu tarjeta, tus citas y tus cortes, y reservas más rápido.</p>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre y apellido" className={CLASE_INPUT} />
      <input type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Tu celular (9 números)" className={`${CLASE_INPUT} cifra`} />
      <p className="text-xs text-tinta-suave">¿Es para un niño? Pon su nombre y el celular de su papá o mamá.</p>
      {error && <p className="rounded-xl bg-ocupada-suave px-3 py-2.5 text-center text-sm font-bold text-ocupada">{error}</p>}
      <button type="button" disabled={!ok || enviando} onClick={registrar} className="w-full rounded-2xl bg-laton py-3.5 font-extrabold text-fondo disabled:opacity-40">
        {enviando ? 'Registrando…' : '✨ Registrarme'}
      </button>
      {onYaTengo && (
        <button type="button" onClick={onYaTengo} className="w-full text-center text-sm text-laton underline decoration-dotted">
          Ya estoy registrado · buscarme
        </button>
      )}
    </div>
  )
}

// "Mi cuenta": el cliente se busca una vez y queda dentro (este celular
// lo recuerda) viendo su tarjeta, sus citas y sus últimos cortes.
function MiCuenta({ fichas, onCambio, onReservar }) {
  const { barberiaId } = useSesion()
  const [quien, setQuien] = useState(() => quienRecordado(barberiaId, fichas))
  const [registrando, setRegistrando] = useState(fichas.length === 0)
  const cambiar = (v) => {
    setQuien(v)
    onCambio()
  }

  if (!quien.clienteId && registrando) {
    return (
      <Registrarme
        onListo={(ficha) => {
          recordarQuien(barberiaId, ficha.id)
          setRegistrando(false)
          cambiar({ clienteId: ficha.id, nombre: ficha.nombre, telefono: '' })
        }}
        onYaTengo={fichas.length > 0 ? () => setRegistrando(false) : null}
      />
    )
  }

  return (
    <div className="space-y-3">
      {!quien.clienteId && <p className="text-sm text-tinta-suave">Búscate por tu nombre o tu celular para entrar a tu cuenta: tu tarjeta, tus citas y tus últimos cortes.</p>}
      <QuienEres fichas={fichas} valor={quien} onCambiar={cambiar} soloBuscar completa />
      {!quien.clienteId && (
        <button type="button" onClick={() => setRegistrando(true)} className="w-full rounded-2xl border-2 border-laton py-3 font-extrabold text-laton">
          ✨ Soy nuevo · registrarme
        </button>
      )}
      {quien.clienteId && (
        <button type="button" onClick={onReservar} className="w-full rounded-2xl bg-laton py-3.5 font-extrabold text-fondo">
          📅 Reservar una cita
        </button>
      )}
    </div>
  )
}

function ReservarCita({ estado, barberoInicial = null, onReservada, onCerrar }) {
  const { config, servicios, barberos, agenda, fichas, telefonoBarberia } = estado
  const { barberiaId } = useSesion()
  const [barberoId, setBarberoId] = useState(barberoInicial)
  const [quien, setQuien] = useState(() => quienRecordado(barberiaId, fichas))
  // De entrada, el corte de siempre si ya se sabe quién es.
  const [cortes, setCortes] = useState(() => fichas.find((f) => f.id === quien.clienteId)?.servicioIds?.filter((id) => servicios.some((x) => x.id === id)) || [])
  const dias = proximosDiasAbiertos(config.horario, 7)
  const [dia, setDia] = useState(dias[0]?.clave ?? null)
  const [hora, setHora] = useState(null)
  const [hecha, setHecha] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const duracion = duracionDeCortes(servicios, cortes) ?? 30
  const horas = dia ? horasLibres({ clave: dia, duracion, agenda, horario: config.horario }) : []
  const barbero = barberos.find((b) => b.id === barberoId)
  const datosOk = quien.clienteId || (quien.nombre.trim() && digitosCelular(quien.telefono).length >= 9)

  if (hecha) {
    const texto = `Hola ${config.nombre} 👋, reservé una cita por la página: ${formatearDia(hecha.fecha)} a las ${hora12(hecha.hora)}${barbero ? ` con ${barbero.nombre}` : ''}, a nombre de ${hecha.nombre}.`
    const wa = linkWhatsapp(telefonoBarberia, texto)
    return (
      <div className="space-y-4 text-center">
        <p className="text-5xl">✅</p>
        <p className="text-xl font-extrabold">¡Cita reservada!</p>
        <p className="text-lg first-letter:uppercase">
          {formatearDia(hecha.fecha)} · <span className="font-bold">{hora12(hecha.hora)}</span>
        </p>
        {barbero && <p>✂ con {barbero.nombre}</p>}
        <p className="rounded-xl bg-laton-suave px-3 py-2 text-sm font-semibold text-laton">⌛ Te esperamos máximo {tolerancia(config)} minutos. Después tu hora queda libre.</p>
        <p className="text-sm text-tinta-suave">La barbería te confirmará la cita. Si no puedes venir, avísale.</p>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="block w-full rounded-2xl bg-libre py-3.5 font-extrabold text-white">
            💬 Avisar a la barbería por WhatsApp
          </a>
        )}
        <button type="button" onClick={onCerrar} className="w-full rounded-2xl border border-linea py-3 font-bold text-tinta-suave">
          Listo
        </button>
      </div>
    )
  }

  if (!dias.length) return <p className="text-center text-tinta-suave">Por ahora no hay días de atención para reservar.</p>

  return (
    <div className="space-y-5">
      {barberos.length > 0 && (
        <Paso n="1" titulo="¿Con quién te cortas?">
          <ElegirBarbero
            barberos={barberos}
            valor={barberoId}
            onCambiar={(id) => {
              setBarberoId(id)
              setHora(null)
            }}
          />
        </Paso>
      )}

      <Paso n="2" titulo="¿Qué te vas a hacer?">
        <ElegirCortes
          servicios={servicios}
          elegidos={cortes}
          onCambiar={(ids) => {
            setCortes(ids)
            setHora(null)
          }}
        />
      </Paso>

      <Paso n="3" titulo="¿Qué día?">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {dias.map((d) => (
            <button
              key={d.clave}
              type="button"
              onClick={() => {
                setDia(d.clave)
                setHora(null)
                setError('')
              }}
              aria-pressed={dia === d.clave}
              className={`w-16 shrink-0 rounded-2xl border-2 py-2 text-center ${dia === d.clave ? 'border-laton bg-laton-suave' : 'border-linea'}`}
            >
              <span className="block text-[11px] font-bold uppercase text-tinta-suave">{d.clave === claveDia() ? 'Hoy' : d.fecha.toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', '')}</span>
              <span className="block text-xl font-extrabold">{d.fecha.getDate()}</span>
            </button>
          ))}
        </div>
      </Paso>

      <Paso n="4" titulo={`¿A qué hora? (dura ~${duracion} min)`}>
        {horas.length === 0 ? (
          <p className="rounded-xl bg-fondo px-3 py-3 text-center text-sm text-tinta-suave">Ese día ya no hay horas libres. Prueba otro día.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {horas.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => {
                  setHora(h)
                  setError('')
                }}
                aria-pressed={hora === h}
                className={`cifra rounded-xl border-2 py-2 text-sm font-bold ${hora === h ? 'border-laton bg-laton text-fondo' : 'border-linea'}`}
              >
                {hora12(h)}
              </button>
            ))}
          </div>
        )}
      </Paso>

      <Paso n="5" titulo="¿Quién eres?">
        <QuienEres
          fichas={fichas}
          valor={quien}
          onCambiar={setQuien}
          onElegido={(f) => {
            if (!cortes.length && f.servicioIds?.length) setCortes(f.servicioIds.filter((id) => servicios.some((x) => x.id === id)))
          }}
        />
      </Paso>

      <p className="text-center text-xs text-tinta-suave">⌛ Se te espera máximo {tolerancia(config)} minutos después de tu hora.</p>
      {error && <p className="rounded-xl bg-ocupada-suave px-3 py-2.5 text-center text-sm font-bold text-ocupada">{error}</p>}
      <button
        type="button"
        disabled={!hora || !datosOk || enviando}
        onClick={async () => {
          setEnviando(true)
          setError('')
          try {
            const cita = await reservarCitaWeb({ fecha: dia, hora, duracion, barberoId, servicioIds: cortes, nombre: quien.nombre, telefono: quien.telefono, clienteId: quien.clienteId })
            const recuerdo = { id: cita.id, fecha: cita.fecha, hora: cita.hora, nombre: cita.nombre, barberoNombre: barbero?.nombre || '' }
            onReservada(recuerdo)
            setHecha(recuerdo)
          } catch (err) {
            setError(err.message)
            setHora(null)
          } finally {
            setEnviando(false)
          }
        }}
        className="w-full rounded-2xl bg-laton py-4 text-base font-extrabold text-fondo disabled:opacity-40"
      >
        {enviando ? 'Reservando…' : hora ? `✓ Reservar ${hora12(hora)}` : 'Elige una hora'}
      </button>
    </div>
  )
}

function Anotarme({ servicios, barberos, fichas, onAnotar }) {
  const { barberiaId } = useSesion()
  const [quien, setQuien] = useState(() => quienRecordado(barberiaId, fichas))
  const [barberoId, setBarberoId] = useState(null)
  const [cortes, setCortes] = useState(() => fichas.find((f) => f.id === quien.clienteId)?.servicioIds?.filter((id) => servicios.some((x) => x.id === id)) || [])
  return (
    <div className="space-y-5">
      <p className="text-sm text-tinta-suave">Te anotamos en la cola de hoy. Desde esta página ves tu turno y cuánto te falta.</p>
      <QuienEres
        fichas={fichas}
        valor={quien}
        onCambiar={setQuien}
        pedirCelular={false}
        onElegido={(f) => {
          if (!cortes.length && f.servicioIds?.length) setCortes(f.servicioIds.filter((id) => servicios.some((x) => x.id === id)))
        }}
      />
      {barberos.length > 0 && (
        <Paso n="✂" titulo="¿Con quién te quieres cortar?">
          <ElegirBarbero barberos={barberos} valor={barberoId} onCambiar={setBarberoId} />
        </Paso>
      )}
      <Paso n="?" titulo="¿Qué te vas a hacer? (opcional)">
        <ElegirCortes servicios={servicios} elegidos={cortes} onCambiar={setCortes} />
      </Paso>
      <button
        type="button"
        disabled={!quien.nombre.trim()}
        onClick={() => onAnotar({ clienteId: quien.clienteId, nombre: quien.nombre, barberoId, servicioIds: cortes })}
        className="w-full rounded-2xl bg-laton py-4 text-base font-extrabold text-fondo disabled:opacity-40"
      >
        ⏳ Anotarme
      </button>
    </div>
  )
}
