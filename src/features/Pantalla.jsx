import { useEffect, useRef, useState } from 'react'
import { useEstado, ocuparSilla, liberarSilla, anotarEnEspera, quitarDeEspera, moverEnEspera, guardarCliente, obtenerEstado, restaurar } from '../data/store'
import { formatearHora, formatearDuracion, useAhora, claveDia } from '../domain/hora'
import { formatearMonto } from '../domain/dinero'
import { esperaEstimada } from '../domain/espera'
import { SillaImagen } from '../ui/SillaDibujo'
import { Hoja } from '../ui/Hoja'
import { HojaOcupar, HojaCobrar, ElegirCliente, ElegirCortes } from '../ui/Cobro'

// La pantalla del local: todas las sillas, cuáles están ocupadas (desde
// qué hora y cuánto llevan) y cuáles están libres (desde qué hora se
// liberaron), la cola de espera con su tiempo aproximado y las citas
// que se vienen. Al ocupar se elige quién y qué corte; al liberar se
// cobra. Pensada también para un televisor o tablet en la pared: botón
// de pantalla completa, letras grandes y colores que se ven de lejos.

// "16:30" de hoy -> ms
function msDeHora(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

function hora12(hhmm) {
  return formatearHora(new Date(msDeHora(hhmm)).toISOString())
}

// `soloVer`: el televisor (sin botones). `conCitas`: los barberos y el
// televisor entran sin cuenta y no ven las citas (tienen celulares).
// `enCompleta`: si de verdad está en pantalla completa (el televisor se
// ve en grande aunque no lo esté).
export default function Pantalla({ pantallaCompleta, onPantallaCompleta, soloVer = false, conCitas = true, enCompleta = pantallaCompleta }) {
  const estado = useEstado()
  const { config, sillas, servicios, clientes, espera, historial, productos } = estado
  const ahora = useAhora(1000)
  const [deshacer, setDeshacer] = useState(null) // { texto, anterior }
  const [hoja, setHoja] = useState(null) // { tipo: 'ocupar' | 'cobrar' | 'espera', sillaId }
  const sillaHoja = hoja?.sillaId && sillas.find((s) => s.id === hoja.sillaId)
  const temporizador = useRef(null)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  function accion(texto, fn) {
    const anterior = obtenerEstado()
    fn()
    setDeshacer({ texto, anterior })
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setDeshacer(null), 7000)
  }

  const libres = sillas.filter((s) => !s.ocupadaDesde)
  const reloj = new Date(ahora).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true })
  const esperas = esperaEstimada(sillas, espera, historial, ahora)

  // Citas de hoy que todavía no llegan (las de hace más de 1 h ya no).
  const hoy = claveDia()
  const citasHoy = estado.citas
    .filter((c) => c.fecha === hoy && c.estado === 'pendiente' && msDeHora(c.hora) > ahora - 60 * 60000)
    .sort((a, b) => a.hora.localeCompare(b.hora))
  // La próxima cita de una silla (en las próximas 2 horas).
  const citaDeSilla = (id) => citasHoy.find((c) => c.sillaId === id && msDeHora(c.hora) < ahora + 120 * 60000)
  const citasParaOcupar = (id) => citasHoy.filter((c) => !c.sillaId || c.sillaId === id)

  return (
    <div>
      {/* Encabezado: local, reloj y resumen */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-laton">✂ Barbería</p>
          <h1 className={`font-extrabold leading-tight ${pantallaCompleta ? 'text-4xl' : 'text-2xl'}`}>{config.nombre}</h1>
        </div>
        <div className="text-right">
          <p className={`cifra font-bold ${pantallaCompleta ? 'text-5xl' : 'text-3xl'}`}>{reloj}</p>
          <p className="text-sm text-tinta-suave">
            <span className="font-bold text-libre">
              {libres.length} {libres.length === 1 ? 'libre' : 'libres'}
            </span>
            {' · '}
            <span className="font-bold text-ocupada">
              {sillas.length - libres.length} {sillas.length - libres.length === 1 ? 'ocupada' : 'ocupadas'}
            </span>
            {espera.length > 0 && (
              <>
                {' · '}
                <span className="font-bold text-laton">{espera.length} en espera</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Hay silla libre y gente esperando: ¡que pase el siguiente! */}
      {libres.length > 0 && espera.length > 0 && (
        <button
          type="button"
          disabled={soloVer}
          onClick={() => setHoja({ tipo: 'ocupar', sillaId: libres[0].id })}
          className="mb-4 flex w-full items-center justify-between gap-3 rounded-2xl bg-laton px-4 py-3 text-left text-fondo"
        >
          <span>
            <span className="block text-xs font-bold uppercase tracking-wide">Siguiente</span>
            <span className={`block font-extrabold ${pantallaCompleta ? 'text-3xl' : 'text-xl'}`}>
              {espera[0].nombre} → {libres[0].nombre}
            </span>
          </span>
          {!soloVer && <span className="shrink-0 text-sm font-bold">Sentar ›</span>}
        </button>
      )}

      {sillas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linea p-8 text-center text-tinta-suave">Todavía no hay sillas. Agrégalas en Más → Sillas.</p>
      ) : (
        <div className={`grid gap-4 ${sillas.length === 1 ? '' : 'sm:grid-cols-2'} ${sillas.length >= 3 ? 'lg:grid-cols-3' : ''} ${sillas.length >= 4 ? 'xl:grid-cols-4' : ''}`}>
          {sillas.map((s) => (
            <TarjetaSilla
              key={s.id}
              silla={s}
              ahora={ahora}
              grande={pantallaCompleta}
              servicios={servicios}
              cita={citaDeSilla(s.id)}
              soloVer={soloVer}
              onOcupar={() => setHoja({ tipo: 'ocupar', sillaId: s.id })}
              onLiberar={() => setHoja({ tipo: 'cobrar', sillaId: s.id })}
            />
          ))}
        </div>
      )}

      {/* Cola de espera y citas de hoy */}
      <div className={`mt-5 grid gap-4 ${conCitas ? 'md:grid-cols-2' : ''}`}>
        <div className="overflow-hidden rounded-3xl border border-linea bg-panel">
          <div className="flex items-center justify-between gap-2 border-b border-linea px-4 py-3">
            <p className={`font-extrabold ${pantallaCompleta ? 'text-2xl' : 'text-base'}`}>⏳ En espera ({espera.length})</p>
            {!soloVer && (
              <button type="button" onClick={() => setHoja({ tipo: 'espera' })} className="rounded-xl bg-laton px-3 py-2 text-sm font-bold text-fondo">
                + Anotar
              </button>
            )}
          </div>
          {espera.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-tinta-suave">Nadie esperando.</p>
          ) : (
            <ol className="divide-y divide-linea">
              {espera.map((x, i) => (
                <li key={x.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`flex shrink-0 items-center justify-center rounded-full font-extrabold ${i === 0 ? 'bg-laton text-fondo' : 'bg-panel-2'} ${pantallaCompleta ? 'h-12 w-12 text-xl' : 'h-9 w-9'}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-bold ${pantallaCompleta ? 'text-2xl' : ''}`}>{x.nombre}</p>
                    <p className="text-xs text-tinta-suave">
                      Llegó {formatearHora(x.llegada)}
                      {x.servicioIds?.length ? ` · ${servicios.filter((s) => x.servicioIds.includes(s.id)).map((s) => s.nombre).join(' + ')}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`cifra font-extrabold text-laton ${pantallaCompleta ? 'text-2xl' : ''}`}>{esperas[i] < 60000 ? 'Ya' : `~${formatearDuracion(esperas[i])}`}</p>
                    {!pantallaCompleta && !soloVer && (
                      <div className="mt-1 flex justify-end gap-1 text-xs">
                        <button type="button" onClick={() => moverEnEspera(x.id, -1)} disabled={i === 0} className="rounded border border-linea px-1.5 disabled:opacity-30" aria-label="Subir">
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => accion(`${x.nombre} salió de la espera`, () => quitarDeEspera(x.id))}
                          className="rounded border border-linea px-1.5 text-ocupada"
                          aria-label={`Quitar a ${x.nombre}`}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {conCitas && (
        <div className="overflow-hidden rounded-3xl border border-linea bg-panel">
          <p className={`border-b border-linea px-4 py-3 font-extrabold ${pantallaCompleta ? 'text-2xl' : 'text-base'}`}>📅 Citas de hoy ({citasHoy.length})</p>
          {citasHoy.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-tinta-suave">No hay citas pendientes hoy.</p>
          ) : (
            <ul className="divide-y divide-linea">
              {citasHoy.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`cifra shrink-0 font-extrabold text-laton ${pantallaCompleta ? 'text-2xl' : ''}`}>{hora12(c.hora)}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-bold ${pantallaCompleta ? 'text-2xl' : ''}`}>{c.nombre}</span>
                    <span className="block truncate text-xs text-tinta-suave">
                      {c.sillaId ? sillas.find((s) => s.id === c.sillaId)?.nombre || '' : 'Cualquier silla'}
                      {c.servicioIds?.length ? ` · ${servicios.filter((s) => c.servicioIds.includes(s.id)).map((s) => s.nombre).join(' + ')}` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        )}
      </div>

      <div className="mt-5 flex justify-center">
        <button type="button" onClick={onPantallaCompleta} className="rounded-xl border border-linea bg-panel px-4 py-2.5 text-sm font-semibold text-tinta-suave">
          {enCompleta ? '✕ Salir de pantalla completa' : '⛶ Pantalla completa (para el televisor)'}
        </button>
      </div>

      {sillaHoja && hoja.tipo === 'ocupar' && !sillaHoja.ocupadaDesde && (
        <Hoja titulo={`Ocupar ${sillaHoja.nombre}`} subtitulo={sillaHoja.barbero ? `✂ ${sillaHoja.barbero}` : null} onCerrar={() => setHoja(null)}>
          <HojaOcupar
            silla={sillaHoja}
            servicios={servicios}
            clientes={clientes}
            espera={espera}
            citas={citasParaOcupar(sillaHoja.id)}
            onOcupar={(datos) => {
              accion(`${sillaHoja.nombre} ocupada${datos.nombre ? ` · ${datos.nombre}` : ''}`, () => ocuparSilla(sillaHoja.id, datos))
              setHoja(null)
            }}
          />
        </Hoja>
      )}

      {sillaHoja && hoja.tipo === 'cobrar' && sillaHoja.ocupadaDesde && (
        <Hoja titulo={`Cobrar ${sillaHoja.nombre}`} onCerrar={() => setHoja(null)}>
          <HojaCobrar
            silla={sillaHoja}
            servicios={servicios}
            productos={productos}
            historial={historial}
            config={config}
            ahora={ahora}
            onCobrar={(cobro) => {
              accion(`${cobro.monto > 0 ? `Cobrado ${formatearMonto(cobro.monto)}` : 'Corte gratis'} · ${sillaHoja.nombre} libre`, () => liberarSilla(sillaHoja.id, cobro))
              setHoja(null)
            }}
            onSinCobrar={() => {
              accion(`${sillaHoja.nombre} liberada sin cobrar`, () => liberarSilla(sillaHoja.id))
              setHoja(null)
            }}
          />
        </Hoja>
      )}

      {hoja?.tipo === 'espera' && (
        <Hoja titulo="Anotar en la espera" onCerrar={() => setHoja(null)}>
          <AnotarEspera
            clientes={clientes}
            servicios={servicios}
            onAnotar={(datos) => {
              accion(`${datos.nombre || 'Cliente'} anotado en la espera`, () => anotarEnEspera(datos))
              setHoja(null)
            }}
          />
        </Hoja>
      )}

      {deshacer && !hoja && (
        <div role="status" className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[calc(100%-2rem)] max-w-sm items-center justify-between gap-3 rounded-2xl bg-tinta px-4 py-3 text-fondo shadow-2xl">
          <span className="text-sm font-semibold">✓ {deshacer.texto}</span>
          <button
            type="button"
            onClick={() => {
              restaurar(deshacer.anterior)
              setDeshacer(null)
            }}
            className="shrink-0 rounded-lg bg-fondo px-3 py-1.5 text-sm font-bold text-tinta"
          >
            Deshacer
          </button>
        </div>
      )}
    </div>
  )
}

function AnotarEspera({ clientes, servicios, onAnotar }) {
  const [cliente, setCliente] = useState({ clienteId: null, nombre: '' })
  const [cortes, setCortes] = useState([])
  const [telefono, setTelefono] = useState('')
  const [guardar, setGuardar] = useState(false)

  function anotar() {
    let { clienteId } = cliente
    // Si se pidió, queda como cliente frecuente.
    if (!clienteId && guardar && cliente.nombre.trim()) clienteId = guardarCliente(null, { nombre: cliente.nombre, telefono, servicioIds: cortes }).id
    onAnotar({ clienteId, nombre: cliente.nombre, servicioIds: cortes })
  }

  return (
    <div className="space-y-4">
      <ElegirCliente
        clientes={clientes}
        valor={cliente}
        placeholder="Nombre del cliente"
        onCambiar={(v) => {
          setCliente(v)
          const c = v.clienteId && clientes.find((x) => x.id === v.clienteId)
          if (c?.servicioIds?.length) setCortes(c.servicioIds)
        }}
      />
      {!cliente.clienteId && cliente.nombre.trim() && (
        <div className="rounded-xl bg-fondo p-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={guardar} onChange={(e) => setGuardar(e.target.checked)} className="h-4 w-4" />
            Guardarlo como cliente frecuente
          </label>
          {guardar && (
            <input
              type="tel"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Celular (para avisarle por WhatsApp)"
              className="mt-2 w-full rounded-xl border border-linea bg-panel px-3 py-2.5 text-tinta outline-none focus-visible:border-laton"
            />
          )}
        </div>
      )}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">¿Qué corte? (opcional)</p>
        <ElegirCortes servicios={servicios} elegidos={cortes} onCambiar={setCortes} />
      </div>
      <button type="button" onClick={anotar} className="w-full rounded-2xl bg-laton py-4 text-base font-extrabold text-fondo">
        ⏳ Anotar en la espera
      </button>
    </div>
  )
}

function TarjetaSilla({ silla, ahora, grande, servicios, cita, soloVer, onOcupar, onLiberar }) {
  const ocupada = Boolean(silla.ocupadaDesde)
  const cortes = servicios.filter((x) => (silla.servicioIds || []).includes(x.id))

  return (
    <div className={`flex flex-col overflow-hidden rounded-3xl border-2 bg-panel ${ocupada ? 'latido border-ocupada' : 'border-libre'}`}>
      {/* Estado bien grande arriba */}
      <div className={`flex items-center justify-between gap-2 px-4 py-2.5 ${ocupada ? 'bg-ocupada' : 'bg-libre'} text-white`}>
        <span className={`font-extrabold uppercase tracking-[0.15em] ${grande ? 'text-xl' : 'text-base'}`}>{ocupada ? '● Ocupada' : '● Disponible'}</span>
        {ocupada && <span className={`cifra font-extrabold ${grande ? 'text-2xl' : 'text-lg'}`}>{formatearDuracion(ahora - new Date(silla.ocupadaDesde))}</span>}
      </div>

      <div className="flex flex-1 items-center gap-4 p-4">
        <div className={`relative shrink-0 overflow-hidden rounded-2xl bg-panel-2 ${grande ? 'h-40 w-40' : 'h-28 w-28'}`}>
          <SillaImagen silla={silla} className="h-full w-full p-1" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate font-extrabold ${grande ? 'text-3xl' : 'text-xl'}`}>{silla.nombre}</p>
          {silla.barbero && <p className={`truncate text-tinta-suave ${grande ? 'text-lg' : 'text-sm'}`}>✂ {silla.barbero}</p>}
          <div className={`mt-2 space-y-0.5 ${grande ? 'text-lg' : 'text-sm'}`}>
            {ocupada ? (
              <p>
                <span className="text-tinta-suave">Ocupada desde </span>
                <span className="cifra font-bold text-ocupada">{formatearHora(silla.ocupadaDesde)}</span>
              </p>
            ) : silla.liberadaEn ? (
              <p>
                <span className="text-tinta-suave">Libre desde </span>
                <span className="cifra font-bold text-libre">{formatearHora(silla.liberadaEn)}</span>
              </p>
            ) : (
              <p className="text-tinta-suave">Lista para atender</p>
            )}
            {ocupada && silla.cliente && <p className="truncate font-bold">👤 {silla.cliente}</p>}
            {ocupada && cortes.length > 0 && (
              <p className="text-laton">
                ✂ {cortes.map((x) => x.nombre).join(' + ')} · <span className="cifra font-bold">{formatearMonto(cortes.reduce((t, x) => t + x.precio, 0))}</span>
              </p>
            )}
            {cita && (
              <p className="mt-1 inline-block rounded-lg bg-laton-suave px-2 py-0.5 text-xs font-bold text-laton">
                📅 Reservada {hora12(cita.hora)} · {cita.nombre}
              </p>
            )}
          </div>
        </div>
      </div>

      {!soloVer && (
      <div className="p-3 pt-0">
        {ocupada ? (
          <button
            type="button"
            onClick={onLiberar}
            className={`w-full rounded-2xl border-2 border-libre bg-libre-suave font-extrabold text-libre active:scale-[0.98] ${grande ? 'py-4 text-xl' : 'py-3 text-base'}`}
          >
            💰 Cobrar y liberar
          </button>
        ) : (
          <button type="button" onClick={onOcupar} className={`w-full rounded-2xl bg-laton font-extrabold text-fondo active:scale-[0.98] ${grande ? 'py-4 text-xl' : 'py-3 text-base'}`}>
            Ocupar silla
          </button>
        )}
      </div>
      )}
    </div>
  )
}
