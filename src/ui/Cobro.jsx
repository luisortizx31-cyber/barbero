import { useState } from 'react'
import { formatearMonto, METODOS } from '../domain/dinero'
import { formatearHora, formatearDuracion } from '../domain/hora'

// Los cortes del local como botones para marcar (se puede elegir más
// de uno, por ejemplo corte + cejas).
export function ElegirCortes({ servicios, elegidos, onCambiar }) {
  function alternar(id) {
    onCambiar(elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id])
  }
  if (servicios.length === 0) return <p className="text-sm text-tinta-suave">Todavía no hay cortes. Agrégalos en la pestaña Cortes.</p>
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
            className={`rounded-2xl border-2 px-3 py-3 text-left transition active:scale-[0.98] ${marcado ? 'border-laton bg-laton-suave' : 'border-linea bg-fondo'}`}
          >
            <span className="block text-sm font-bold leading-tight">
              {marcado ? '✓ ' : ''}
              {x.nombre}
            </span>
            <span className="cifra mt-1 block text-base font-extrabold text-laton">{formatearMonto(x.precio)}</span>
          </button>
        )
      })}
    </div>
  )
}

// Al ocupar: qué corte se va a hacer (o "después").
export function HojaOcupar({ silla, servicios, onOcupar }) {
  const [elegidos, setElegidos] = useState([])
  return (
    <div className="space-y-4">
      <p className="text-sm text-tinta-suave">¿Qué corte se va a hacer? Lo puedes cambiar al cobrar.</p>
      <ElegirCortes servicios={servicios} elegidos={elegidos} onCambiar={setElegidos} />
      <button type="button" onClick={() => onOcupar(elegidos)} className="w-full rounded-2xl bg-ocupada py-4 text-base font-extrabold text-white active:scale-[0.98]">
        Ocupar {silla.nombre}
        {elegidos.length > 0 ? ` · ${formatearMonto(servicios.filter((x) => elegidos.includes(x.id)).reduce((t, x) => t + x.precio, 0))}` : ''}
      </button>
      {elegidos.length === 0 && <p className="text-center text-xs text-tinta-suave">Si no eliges ninguno, el corte se elige al cobrar.</p>}
    </div>
  )
}

// Al liberar: cobrar lo que se hizo y cómo pagó.
export function HojaCobrar({ silla, servicios, ahora, onCobrar, onSinCobrar }) {
  const [elegidos, setElegidos] = useState(() => (silla.servicioIds || []).filter((id) => servicios.some((x) => x.id === id)))
  const suma = servicios.filter((x) => elegidos.includes(x.id)).reduce((t, x) => t + x.precio, 0)
  const [montoManual, setMontoManual] = useState(null) // null = la suma de los cortes
  const [metodo, setMetodo] = useState('efectivo')
  const monto = montoManual ?? suma

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-fondo px-3 py-2 text-sm text-tinta-suave">
        Ocupada desde <span className="cifra font-bold text-tinta">{formatearHora(silla.ocupadaDesde)}</span> · lleva{' '}
        <span className="cifra font-bold text-tinta">{formatearDuracion(ahora - new Date(silla.ocupadaDesde))}</span>
        {silla.barbero ? ` · ✂ ${silla.barbero}` : ''}
      </p>

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
          Los cortes suman {formatearMonto(suma)}.{' '}
          <button type="button" onClick={() => setMontoManual(null)} className="underline decoration-dotted">
            Usar ese
          </button>
        </p>
      )}

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

      <button
        type="button"
        disabled={!(monto > 0)}
        onClick={() =>
          onCobrar({
            servicios: servicios.filter((x) => elegidos.includes(x.id)).map((x) => ({ nombre: x.nombre, precio: x.precio })),
            monto: Number(monto),
            metodo,
          })
        }
        className="w-full rounded-2xl bg-libre py-4 text-lg font-extrabold text-white active:scale-[0.98] disabled:opacity-40"
      >
        ✓ Cobrar {formatearMonto(monto)} y liberar
      </button>
      <button type="button" onClick={onSinCobrar} className="w-full text-center text-sm text-tinta-suave underline decoration-dotted">
        Liberar sin cobrar
      </button>
    </div>
  )
}
