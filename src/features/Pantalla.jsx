import { useEffect, useRef, useState } from 'react'
import { useEstado, ocuparSilla, liberarSilla, obtenerEstado, restaurar } from '../data/store'
import { formatearHora, formatearDuracion, useAhora } from '../domain/hora'
import { SillaImagen } from '../ui/SillaDibujo'
import { Hoja } from '../ui/Hoja'
import { HojaOcupar, HojaCobrar } from '../ui/Cobro'
import { formatearMonto } from '../domain/dinero'

// La pantalla del local: todas las sillas, cuáles están ocupadas (desde
// qué hora y cuánto llevan) y cuáles están libres (desde qué hora se
// liberaron). Al ocupar se elige el corte; al liberar se cobra (corte,
// total y si pagó en efectivo, Yape o Plin). Pensada
// también para un televisor o tablet en la pared: botón de pantalla
// completa, letras grandes y colores que se ven de lejos.
export default function Pantalla({ pantallaCompleta, onPantallaCompleta }) {
  const { config, sillas, servicios } = useEstado()
  const ahora = useAhora(1000)
  const [deshacer, setDeshacer] = useState(null) // { texto, anterior }
  const [hoja, setHoja] = useState(null) // { tipo: 'ocupar' | 'cobrar', sillaId }
  const sillaHoja = hoja && sillas.find((s) => s.id === hoja.sillaId)
  const temporizador = useRef(null)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  function accion(texto, fn) {
    const anterior = obtenerEstado()
    fn()
    setDeshacer({ texto, anterior })
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setDeshacer(null), 7000)
  }

  const libres = sillas.filter((s) => !s.ocupadaDesde).length
  const ocupadas = sillas.length - libres
  const reloj = new Date(ahora).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true })

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
            <span className="font-bold text-libre">{libres} {libres === 1 ? 'libre' : 'libres'}</span>
            {' · '}
            <span className="font-bold text-ocupada">{ocupadas} {ocupadas === 1 ? 'ocupada' : 'ocupadas'}</span>
          </p>
        </div>
      </div>

      {sillas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linea p-8 text-center text-tinta-suave">Todavía no hay sillas. Agrégalas en la pestaña Sillas.</p>
      ) : (
        <div className={`grid gap-4 ${sillas.length === 1 ? '' : 'sm:grid-cols-2'} ${sillas.length >= 3 ? 'lg:grid-cols-3' : ''} ${sillas.length >= 4 ? 'xl:grid-cols-4' : ''}`}>
          {sillas.map((s) => (
            <TarjetaSilla
              key={s.id}
              silla={s}
              ahora={ahora}
              grande={pantallaCompleta}
              servicios={servicios}
              onOcupar={() => setHoja({ tipo: 'ocupar', sillaId: s.id })}
              onLiberar={() => setHoja({ tipo: 'cobrar', sillaId: s.id })}
            />
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={onPantallaCompleta}
          className="rounded-xl border border-linea bg-panel px-4 py-2.5 text-sm font-semibold text-tinta-suave"
        >
          {pantallaCompleta ? '✕ Salir de pantalla completa' : '⛶ Pantalla completa (para el televisor)'}
        </button>
      </div>

      {sillaHoja && hoja.tipo === 'ocupar' && !sillaHoja.ocupadaDesde && (
        <Hoja titulo={`Ocupar ${sillaHoja.nombre}`} subtitulo={sillaHoja.barbero ? `✂ ${sillaHoja.barbero}` : null} onCerrar={() => setHoja(null)}>
          <HojaOcupar
            silla={sillaHoja}
            servicios={servicios}
            onOcupar={(ids) => {
              accion(`${sillaHoja.nombre} ocupada`, () => ocuparSilla(sillaHoja.id, ids))
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
            ahora={ahora}
            onCobrar={(cobro) => {
              accion(`Cobrado ${formatearMonto(cobro.monto)} · ${sillaHoja.nombre} libre`, () => liberarSilla(sillaHoja.id, cobro))
              setHoja(null)
            }}
            onSinCobrar={() => {
              accion(`${sillaHoja.nombre} liberada sin cobrar`, () => liberarSilla(sillaHoja.id))
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
            className="rounded-lg bg-fondo px-3 py-1.5 text-sm font-bold text-tinta"
          >
            Deshacer
          </button>
        </div>
      )}
    </div>
  )
}

function TarjetaSilla({ silla, ahora, grande, servicios, onOcupar, onLiberar }) {
  const ocupada = Boolean(silla.ocupadaDesde)
  const cortes = servicios.filter((x) => (silla.servicioIds || []).includes(x.id))

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-3xl border-2 bg-panel ${ocupada ? 'latido border-ocupada' : 'border-libre'}`}
    >
      {/* Estado bien grande arriba */}
      <div className={`flex items-center justify-between gap-2 px-4 py-2.5 ${ocupada ? 'bg-ocupada' : 'bg-libre'} text-white`}>
        <span className={`font-extrabold uppercase tracking-[0.15em] ${grande ? 'text-xl' : 'text-base'}`}>{ocupada ? '● Ocupada' : '● Disponible'}</span>
        {ocupada && <span className={`cifra font-extrabold ${grande ? 'text-2xl' : 'text-lg'}`}>{formatearDuracion(ahora - new Date(silla.ocupadaDesde))}</span>}
      </div>

      <div className="flex flex-1 items-center gap-4 p-4">
        <div className={`relative shrink-0 overflow-hidden rounded-2xl bg-panel-2 ${grande ? 'h-40 w-40' : 'h-28 w-28'}`}>
          <SillaImagen silla={silla} className={`h-full w-full p-1 ${ocupada ? '' : 'opacity-95'}`} />
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
            {ocupada && cortes.length > 0 && (
              <p className="text-laton">
                ✂ {cortes.map((x) => x.nombre).join(' + ')} · <span className="cifra font-bold">{formatearMonto(cortes.reduce((t, x) => t + x.precio, 0))}</span>
              </p>
            )}
            {ocupada && silla.liberadaEn && (
              <p className="text-xs text-tinta-suave">Se había liberado a las {formatearHora(silla.liberadaEn)}</p>
            )}
          </div>
        </div>
      </div>

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
          <button
            type="button"
            onClick={onOcupar}
            className={`w-full rounded-2xl bg-laton font-extrabold text-fondo active:scale-[0.98] ${grande ? 'py-4 text-xl' : 'py-3 text-base'}`}
          >
            Ocupar silla
          </button>
        )}
      </div>
    </div>
  )
}
