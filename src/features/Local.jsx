import { useState } from 'react'
import { useEstado, useSesion, reservarCitaWeb, anotarEnEspera, quitarDeEspera } from '../data/store'
import { useAhora, formatearDuracion, formatearHora, claveDia, formatearDia } from '../domain/hora'
import { esperaEstimada } from '../domain/espera'
import { linkWhatsapp } from '../domain/clientes'
import { formatearMonto } from '../domain/dinero'
import { estadoAtencion, proximosDiasAbiertos, horasLibres, duracionDeCortes, duracionDe, hora12 } from '../domain/horario'
import { FotoBarbero } from '../ui/FotoBarbero'
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
  const { config, sillas, barberos, espera, historial, servicios, agenda, telefonoBarberia } = useEstado()
  const { barberiaId } = useSesion()
  const ahora = useAhora(15000)
  const [hoja, setHoja] = useState(null) // 'cita' | 'espera'
  const [miTurno, setMiTurno] = useRecuerdo(`barberia:miturno:${barberiaId}`)
  const [miCita, setMiCita] = useRecuerdo(`barberia:micita:${barberiaId}`)

  const atencion = estadoAtencion(config.horario, ahora)
  const libres = sillas.filter((s) => !s.ocupadaDesde)
  const esperas = esperaEstimada(sillas, [...espera, { id: 'yo' }], historial, ahora, servicios)
  const miEspera = esperas.at(-1)
  const barberoDe = (s) => barberos.find((b) => b.id === s.barberoId) || (s.barbero ? { nombre: s.barbero } : null)
  const wa = linkWhatsapp(telefonoBarberia, `Hola ${config.nombre} 👋, quisiera un corte. ¿Tienen sitio?`)

  // Mi lugar en la cola (si me anoté desde este celular y sigo ahí).
  const posicion = miTurno ? espera.findIndex((x) => x.id === miTurno.id) : -1
  const esperasCola = esperaEstimada(sillas, espera, historial, ahora, servicios)
  const citaVigente = miCita && miCita.fecha >= claveDia() ? miCita : null

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
        <button type="button" onClick={() => setHoja('cita')} className="rounded-2xl bg-laton py-3.5 font-extrabold text-fondo">
          📅 Reservar cita
        </button>
        {atencion.abierto && posicion < 0 && (
          <button type="button" onClick={() => setHoja('espera')} className="rounded-2xl border-2 border-laton py-3.5 font-extrabold text-laton">
            ⏳ Anótame
          </button>
        )}
      </div>

      <ul className="space-y-3">
        {sillas.map((s) => {
          const ocupada = Boolean(s.ocupadaDesde)
          const b = barberoDe(s)
          return (
            <li key={s.id} className={`flex items-center gap-4 rounded-2xl border-2 bg-panel p-4 ${ocupada ? 'border-ocupada' : 'border-libre'}`}>
              {b ? <FotoBarbero barbero={b} tam="h-16 w-16" texto="text-xl" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-panel-2 text-3xl">💈</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-extrabold">{s.nombre}</p>
                {b && <p className="truncate text-sm">✂ {b.nombre}</p>}
                <p className={`text-sm font-bold ${ocupada ? 'text-ocupada' : 'text-libre'}`}>
                  {ocupada ? `Cortando · hace ${formatearDuracion(ahora - new Date(s.ocupadaDesde))}` : s.liberadaEn ? `Libre desde ${formatearHora(s.liberadaEn)}` : 'Libre'}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold uppercase ${ocupada ? 'bg-ocupada text-white' : 'bg-libre text-white'}`}>{ocupada ? 'Ocupada' : 'Libre'}</span>
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
              <li key={x.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <span>
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
      <p className="text-center text-xs text-tinta-suave">Se actualiza solo. El tiempo es aproximado.</p>

      {hoja === 'cita' && (
        <Hoja titulo="Reservar cita" onCerrar={() => setHoja(null)}>
          <ReservarCita
            estado={{ config, servicios, barberos, agenda, sillas, telefonoBarberia }}
            onReservada={(cita) => setMiCita(cita)}
            onCerrar={() => setHoja(null)}
          />
        </Hoja>
      )}
      {hoja === 'espera' && (
        <Hoja titulo="Anotarme en la espera" onCerrar={() => setHoja(null)}>
          <Anotarme
            servicios={servicios}
            barberos={barberos}
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

function ReservarCita({ estado, onReservada, onCerrar }) {
  const { config, servicios, barberos, agenda, sillas, telefonoBarberia } = estado
  const [barberoId, setBarberoId] = useState(null)
  const [cortes, setCortes] = useState([])
  const dias = proximosDiasAbiertos(config.horario, 7)
  const [dia, setDia] = useState(dias[0]?.clave ?? null)
  const [hora, setHora] = useState(null)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [hecha, setHecha] = useState(null)

  const duracion = duracionDeCortes(servicios, cortes) ?? 30
  const horas = dia ? horasLibres({ clave: dia, duracion, barberoId, agenda, horario: config.horario, capacidad: sillas.length }) : []
  const barbero = barberos.find((b) => b.id === barberoId)
  const telOk = String(telefono).replace(/\D/g, '').length >= 9

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
        <p className="text-sm text-tinta-suave">Te esperamos. Si no puedes venir, avísale a la barbería.</p>
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
          <p className="rounded-xl bg-fondo px-3 py-3 text-center text-sm text-tinta-suave">Ese día ya no hay horas libres{barbero ? ` con ${barbero.nombre.split(' ')[0]}` : ''}. Prueba otro día{barbero ? ' u otro barbero' : ''}.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {horas.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHora(h)}
                aria-pressed={hora === h}
                className={`cifra rounded-xl border-2 py-2 text-sm font-bold ${hora === h ? 'border-laton bg-laton text-fondo' : 'border-linea'}`}
              >
                {hora12(h)}
              </button>
            ))}
          </div>
        )}
      </Paso>

      <Paso n="5" titulo="Tus datos">
        <div className="space-y-2">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" className={CLASE_INPUT} />
          <input type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Tu celular" className={`${CLASE_INPUT} cifra`} />
        </div>
      </Paso>

      <button
        type="button"
        disabled={!hora || !nombre.trim() || !telOk}
        onClick={() => {
          const cita = reservarCitaWeb({ fecha: dia, hora, duracion, barberoId, servicioIds: cortes, nombre, telefono })
          const recuerdo = { fecha: cita.fecha, hora: cita.hora, nombre: cita.nombre, barberoNombre: barbero?.nombre || '' }
          onReservada(recuerdo)
          setHecha(recuerdo)
        }}
        className="w-full rounded-2xl bg-laton py-4 text-base font-extrabold text-fondo disabled:opacity-40"
      >
        {hora ? `✓ Reservar ${hora12(hora)}` : 'Elige una hora'}
      </button>
    </div>
  )
}

function Anotarme({ servicios, barberos, onAnotar }) {
  const [nombre, setNombre] = useState('')
  const [barberoId, setBarberoId] = useState(null)
  const [cortes, setCortes] = useState([])
  return (
    <div className="space-y-5">
      <p className="text-sm text-tinta-suave">Te anotamos en la cola de hoy. Desde esta página ves tu turno y cuánto te falta.</p>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" className={CLASE_INPUT} />
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
        disabled={!nombre.trim()}
        onClick={() => onAnotar({ nombre, barberoId, servicioIds: cortes })}
        className="w-full rounded-2xl bg-laton py-4 text-base font-extrabold text-fondo disabled:opacity-40"
      >
        ⏳ Anotarme
      </button>
    </div>
  )
}
