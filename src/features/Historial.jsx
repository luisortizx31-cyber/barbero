import { useState } from 'react'
import { useEstado, borrarHistorial } from '../data/store'
import { claveDia, formatearDia, formatearHora, formatearDuracion } from '../domain/hora'

// Cada vez que una silla se ocupó y se liberó: a qué hora entró, a qué
// hora se liberó y cuánto duró. Por día, con cuántas atenciones tuvo
// cada silla.
export default function Historial() {
  const { sillas, historial } = useEstado()
  const [dia, setDia] = useState(claveDia())
  const nombreDe = (id) => sillas.find((s) => s.id === id)?.nombre || 'Silla quitada'

  const delDia = historial.filter((h) => claveDia(h.inicio) === dia).sort((a, b) => b.inicio.localeCompare(a.inicio))
  const porSilla = new Map()
  for (const h of delDia) porSilla.set(h.sillaId, (porSilla.get(h.sillaId) || 0) + 1)
  const promedio = delDia.length ? delDia.reduce((t, h) => t + (new Date(h.fin) - new Date(h.inicio)), 0) / delDia.length : 0

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

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-linea bg-panel p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave">Atenciones</p>
          <p className="cifra text-3xl font-extrabold text-laton">{delDia.length}</p>
        </div>
        <div className="rounded-2xl border border-linea bg-panel p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave">Tiempo promedio</p>
          <p className="cifra text-3xl font-extrabold">{delDia.length ? formatearDuracion(promedio) : '—'}</p>
        </div>
      </div>

      {porSilla.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...porSilla.entries()].map(([id, n]) => (
            <span key={id} className="rounded-full bg-panel-2 px-3 py-1 text-sm">
              {nombreDe(id)}: <span className="font-bold text-laton">{n}</span>
            </span>
          ))}
        </div>
      )}

      {delDia.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linea p-6 text-center text-tinta-suave">Ese día no se liberó ninguna silla.</p>
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-panel">
          {delDia.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-bold">{nombreDe(h.sillaId)}</p>
                <p className="text-sm text-tinta-suave">
                  <span className="cifra text-ocupada">{formatearHora(h.inicio)}</span> → <span className="cifra text-libre">{formatearHora(h.fin)}</span>
                </p>
              </div>
              <span className="cifra shrink-0 font-bold">{formatearDuracion(new Date(h.fin) - new Date(h.inicio))}</span>
            </li>
          ))}
        </ul>
      )}

      {historial.length > 0 && (
        <button
          type="button"
          onClick={() => confirm('¿Borrar todo el historial? Las sillas no se tocan.') && borrarHistorial()}
          className="text-xs text-tinta-suave underline decoration-dotted"
        >
          Borrar todo el historial
        </button>
      )}
    </div>
  )
}
