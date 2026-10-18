import { useEstado } from '../data/store'
import { useAhora, formatearDuracion, formatearHora } from '../domain/hora'
import { esperaEstimada } from '../domain/espera'
import { linkWhatsapp } from '../domain/clientes'
import { FotoBarbero } from '../ui/FotoBarbero'

// Página para los clientes (#/local/{id}), desde su celular y sin
// cuenta: si hay sillas libres, qué barbero está cortando en cada una
// (con su foto), cuánta gente espera y cuánto demoraría si va ahora.
// No muestra nombres de clientes.
export default function Local() {
  const { config, sillas, barberos, espera, historial, telefonoBarberia } = useEstado()
  const ahora = useAhora(15000)
  const libres = sillas.filter((s) => !s.ocupadaDesde)
  // Si llegara ahora, sería el último de la cola.
  const esperas = esperaEstimada(sillas, [...espera, { id: 'yo' }], historial, ahora)
  const miEspera = esperas.at(-1)
  const barberoDe = (s) => barberos.find((b) => b.id === s.barberoId) || (s.barbero ? { nombre: s.barbero } : null)
  const wa = linkWhatsapp(telefonoBarberia, `Hola ${config.nombre} 👋, quisiera un corte. ¿Tienen sitio?`)

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-laton">✂ Barbería</p>
        <h1 className="text-3xl font-extrabold">{config.nombre}</h1>
      </div>

      {/* Lo que importa: ¿hay sitio? */}
      <div className={`rounded-3xl p-5 text-center ${libres.length && !espera.length ? 'bg-libre text-white' : 'bg-laton text-fondo'}`}>
        {libres.length && !espera.length ? (
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

      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="block w-full rounded-2xl bg-libre py-3.5 text-center font-extrabold text-white">
          💬 Escribir a la barbería
        </a>
      )}
      <p className="text-center text-xs text-tinta-suave">Se actualiza solo. El tiempo es aproximado.</p>
    </div>
  )
}
