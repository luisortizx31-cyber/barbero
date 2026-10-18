import { useState } from 'react'
import { useEstado, borrarHistorial } from '../data/store'
import { claveDia, formatearDia, formatearHora, formatearDuracion } from '../domain/hora'
import { formatearMonto, METODOS, textoMetodo } from '../domain/dinero'

// La caja del día: cuánto se cobró (en efectivo, Yape y Plin), cuánto
// hizo cada barbero y cada atención - a qué hora entró, a qué hora se
// liberó la silla, qué corte y cuánto pagó.
export default function Historial() {
  const { sillas, historial } = useEstado()
  const [dia, setDia] = useState(claveDia())
  const nombreDe = (id) => sillas.find((s) => s.id === id)?.nombre || 'Silla quitada'

  const delDia = historial.filter((h) => claveDia(h.fin) === dia).sort((a, b) => b.fin.localeCompare(a.fin))
  const cobradas = delDia.filter((h) => h.cobro)
  const total = cobradas.reduce((t, h) => t + h.cobro.monto, 0)
  const porMetodo = Object.fromEntries(METODOS.map((m) => [m.id, 0]))
  for (const h of cobradas) porMetodo[h.cobro.metodo] = (porMetodo[h.cobro.metodo] || 0) + h.cobro.monto

  // Por barbero (o por silla si no tiene barbero)
  const porBarbero = new Map()
  for (const h of delDia) {
    const quien = h.barbero || nombreDe(h.sillaId)
    const a = porBarbero.get(quien) || { atenciones: 0, total: 0 }
    a.atenciones += 1
    a.total += h.cobro?.monto || 0
    porBarbero.set(quien, a)
  }
  const barberos = [...porBarbero.entries()].sort((a, b) => b[1].total - a[1].total)

  function moverDia(delta) {
    const [a, m, d] = dia.split('-').map(Number)
    setDia(claveDia(new Date(a, m - 1, d + delta)))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-2xl border border-linea bg-panel p-2">
        <button type="button" onClick={() => moverDia(-1)} className="rounded-lg border border-linea px-3 py-2 text-tinta-suave" aria-label="Día anterior">
          ‹
        </button>
        <p className="flex-1 text-center font-bold first-letter:uppercase">{formatearDia(dia)}</p>
        <button
          type="button"
          onClick={() => moverDia(1)}
          disabled={dia >= claveDia()}
          className="rounded-lg border border-linea px-3 py-2 text-tinta-suave disabled:opacity-30"
          aria-label="Día siguiente"
        >
          ›
        </button>
      </div>

      {/* Total del día */}
      <div className="rounded-3xl border border-laton/40 bg-gradient-to-br from-laton-suave to-panel p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-laton">Cobrado en el día</p>
        <p className="cifra mt-1 text-4xl font-extrabold">{formatearMonto(total)}</p>
        <p className="text-sm text-tinta-suave">
          {delDia.length} {delDia.length === 1 ? 'atención' : 'atenciones'}
          {delDia.length > cobradas.length ? ` · ${delDia.length - cobradas.length} sin cobrar` : ''}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {METODOS.map((m) => (
            <div key={m.id} className="rounded-2xl bg-fondo/70 px-2 py-2.5 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-tinta-suave">
                {m.icono} {m.texto}
              </p>
              <p className="cifra text-base font-extrabold">{formatearMonto(porMetodo[m.id])}</p>
            </div>
          ))}
        </div>
      </div>

      {barberos.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-linea bg-panel">
          <p className="border-b border-linea px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-tinta-suave">Por barbero</p>
          <ul className="divide-y divide-linea">
            {barberos.map(([quien, a]) => (
              <li key={quien} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-bold">✂ {quien}</p>
                  <p className="text-xs text-tinta-suave">
                    {a.atenciones} {a.atenciones === 1 ? 'atención' : 'atenciones'}
                  </p>
                </div>
                <span className="cifra text-lg font-extrabold text-laton">{formatearMonto(a.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {delDia.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linea p-6 text-center text-tinta-suave">Ese día no se liberó ninguna silla.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-linea bg-panel">
          <p className="border-b border-linea px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-tinta-suave">Atenciones</p>
          <ul className="divide-y divide-linea">
            {delDia.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-bold">
                    {nombreDe(h.sillaId)}
                    {h.barbero ? <span className="font-normal text-tinta-suave"> · {h.barbero}</span> : ''}
                  </p>
                  <p className="text-sm text-tinta-suave">
                    <span className="cifra text-ocupada">{formatearHora(h.inicio)}</span> → <span className="cifra text-libre">{formatearHora(h.fin)}</span> ·{' '}
                    {formatearDuracion(new Date(h.fin) - new Date(h.inicio))}
                  </p>
                  {h.cobro?.servicios?.length > 0 && <p className="truncate text-xs text-laton">✂ {h.cobro.servicios.map((x) => x.nombre).join(' + ')}</p>}
                </div>
                <div className="shrink-0 text-right">
                  {h.cobro ? (
                    <>
                      <p className="cifra font-extrabold">{formatearMonto(h.cobro.monto)}</p>
                      <p className="text-xs text-tinta-suave">{textoMetodo(h.cobro.metodo)}</p>
                    </>
                  ) : (
                    <p className="text-xs text-tinta-suave">Sin cobrar</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {historial.length > 0 && (
        <button
          type="button"
          onClick={() => confirm('¿Borrar todo el historial y la caja? Las sillas y los cortes no se tocan.') && borrarHistorial()}
          className="text-xs text-tinta-suave underline decoration-dotted"
        >
          Borrar todo el historial
        </button>
      )}
    </div>
  )
}
