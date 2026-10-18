import { useState } from 'react'
import { useEstado } from '../data/store'
import { claveDia } from '../domain/hora'
import { formatearMonto } from '../domain/dinero'
import { cuentasCaja } from '../domain/caja'

// Resumen de la semana o el mes: cuánto entró, la ganancia, los días y
// horas más llenos, los cortes más pedidos y cómo le fue a cada barbero.

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

function rango(periodo, desplazamiento) {
  const hoy = new Date()
  if (periodo === 'semana') {
    // lunes a domingo
    const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7) + desplazamiento * 7)
    const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6)
    return { desde: lunes, hasta: domingo }
  }
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() + desplazamiento, 1)
  return { desde: inicio, hasta: new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0) }
}

function titulo(periodo, desde, hasta) {
  if (periodo === 'mes') return desde.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })
  const f = (d) => d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
  return `${f(desde)} al ${f(hasta)}`
}

export default function Resumen() {
  const estado = useEstado()
  const [periodo, setPeriodo] = useState('semana')
  const [desplazamiento, setDesplazamiento] = useState(0)
  const { desde, hasta } = rango(periodo, desplazamiento)
  const c = cuentasCaja(estado, claveDia(desde), claveDia(hasta))

  // Ingresos por día del periodo
  const dias = []
  for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) dias.push(claveDia(d))
  const porDia = new Map(dias.map((d) => [d, 0]))
  for (const h of c.cobradas) porDia.set(claveDia(h.fin), (porDia.get(claveDia(h.fin)) || 0) + h.cobro.monto)
  for (const v of c.ventas) porDia.set(claveDia(v.fecha), (porDia.get(claveDia(v.fecha)) || 0) + v.monto)
  const barrasDias = dias.map((d) => {
    const fecha = new Date(`${d}T12:00:00`)
    return {
      clave: d,
      etiqueta: periodo === 'semana' ? DIAS_CORTOS[fecha.getDay()] : String(fecha.getDate()),
      valor: porDia.get(d),
      detalle: `${fecha.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'short' })}: ${formatearMonto(porDia.get(d))}`,
    }
  })

  // Atenciones por hora del día (cuándo llega más gente)
  const porHora = new Map()
  for (const h of c.atenciones) {
    const hora = new Date(h.inicio).getHours()
    porHora.set(hora, (porHora.get(hora) || 0) + 1)
  }
  const horas = [...porHora.keys()]
  const barrasHoras = []
  if (horas.length) {
    for (let h = Math.min(...horas); h <= Math.max(...horas); h++) {
      const n = porHora.get(h) || 0
      const etiqueta = `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`
      barrasHoras.push({ clave: h, etiqueta, valor: n, detalle: `${h % 12 || 12}:00 ${h < 12 ? 'a. m.' : 'p. m.'}: ${n} ${n === 1 ? 'atención' : 'atenciones'}` })
    }
  }

  // Cortes más pedidos
  const porCorte = new Map()
  for (const h of c.cobradas) for (const s of h.cobro.servicios || []) porCorte.set(s.nombre, (porCorte.get(s.nombre) || 0) + 1)
  const cortes = [...porCorte.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  const ticket = c.cobradas.length ? c.ingresos / c.cobradas.length : 0
  const mejorDia = barrasDias.reduce((m, b) => (b.valor > (m?.valor ?? 0) ? b : m), null)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-linea bg-panel p-1">
        {[
          ['semana', 'Semana'],
          ['mes', 'Mes'],
        ].map(([id, texto]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setPeriodo(id)
              setDesplazamiento(0)
            }}
            aria-pressed={periodo === id}
            className={`rounded-lg py-2 text-sm font-bold ${periodo === id ? 'bg-laton text-fondo' : 'text-tinta-suave'}`}
          >
            {texto}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-linea bg-panel p-2">
        <button type="button" onClick={() => setDesplazamiento((d) => d - 1)} className="rounded-lg border border-linea px-3 py-2 text-tinta-suave" aria-label="Anterior">
          ‹
        </button>
        <p className="flex-1 text-center font-bold first-letter:uppercase">{titulo(periodo, desde, hasta)}</p>
        <button
          type="button"
          onClick={() => setDesplazamiento((d) => d + 1)}
          disabled={desplazamiento >= 0}
          className="rounded-lg border border-linea px-3 py-2 text-tinta-suave disabled:opacity-30"
          aria-label="Siguiente"
        >
          ›
        </button>
      </div>

      {/* Números grandes */}
      <div className="grid grid-cols-2 gap-2">
        <Tile titulo="Entró" valor={formatearMonto(c.ingresos)} destacado />
        <Tile titulo="Ganancia del local" valor={formatearMonto(c.ganancia)} nota={`después de comisiones ${formatearMonto(c.comisiones)} y gastos ${formatearMonto(c.totalGastos)}`} />
        <Tile titulo="Atenciones" valor={c.atenciones.length} />
        <Tile titulo="Ticket promedio" valor={formatearMonto(ticket)} nota="lo que paga cada cliente" />
      </div>

      <Grafico titulo="Lo que entró por día" barras={barrasDias} formato={formatearMonto} nota={mejorDia ? `Mejor día: ${mejorDia.detalle}` : null} />
      {barrasHoras.length > 0 && <Grafico titulo="¿A qué hora llega más gente?" barras={barrasHoras} formato={(n) => `${n}`} />}

      {cortes.length > 0 && (
        <Ranking titulo="Cortes más pedidos" filas={cortes.map(([nombre, n]) => ({ nombre, valor: n, texto: `${n}` }))} />
      )}
      {c.porBarbero.length > 0 && (
        <Ranking
          titulo="Barberos"
          filas={c.porBarbero.map((b) => ({ nombre: b.nombre, valor: b.servicios, texto: formatearMonto(b.servicios), nota: `${b.atenciones} atenciones · comisión ${formatearMonto(b.comision)}` }))}
        />
      )}
    </div>
  )
}

function Tile({ titulo, valor, nota, destacado }) {
  return (
    <div className={`rounded-2xl border p-4 ${destacado ? 'border-laton/40 bg-laton-suave' : 'border-linea bg-panel'}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-tinta-suave">{titulo}</p>
      <p className="cifra text-2xl font-extrabold">{valor}</p>
      {nota && <p className="text-[11px] leading-tight text-tinta-suave">{nota}</p>}
    </div>
  )
}

// Barras verticales de una sola serie. Tocar (o pasar el mouse por)
// una barra muestra su valor; hay una vista de tabla debajo.
function Grafico({ titulo, barras, formato, nota }) {
  const [activa, setActiva] = useState(null)
  const max = Math.max(...barras.map((b) => b.valor), 0)
  const muchas = barras.length > 12
  const sel = barras.find((b) => b.clave === activa)

  return (
    <div className="rounded-2xl border border-linea bg-panel p-4">
      <p className="font-extrabold">{titulo}</p>
      <p className="h-5 text-sm text-tinta-suave" aria-live="polite">
        {sel ? sel.detalle : nota || (max === 0 ? 'Sin datos en este periodo.' : 'Toca una barra para ver el detalle.')}
      </p>
      <div className="mt-2 flex h-36 items-end gap-0.5 border-b border-linea" onMouseLeave={() => setActiva(null)}>
        {barras.map((b) => (
          <button
            key={b.clave}
            type="button"
            onMouseEnter={() => setActiva(b.clave)}
            onFocus={() => setActiva(b.clave)}
            onClick={() => setActiva(b.clave)}
            aria-label={b.detalle}
            className="flex h-full min-w-0 flex-1 flex-col justify-end px-px"
          >
            <span
              className={`block w-full rounded-t ${activa === b.clave ? 'bg-tinta' : 'bg-laton'}`}
              style={{ height: max ? `${Math.max(b.valor ? 2 : 0, (b.valor / max) * 100)}%` : 0 }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5">
        {barras.map((b, i) => (
          <span key={b.clave} className="min-w-0 flex-1 text-center text-[10px] text-tinta-suave">
            {!muchas || i % 5 === 0 || i === barras.length - 1 ? b.etiqueta : ''}
          </span>
        ))}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs text-tinta-suave">Ver como tabla</summary>
        <table className="mt-2 w-full text-left">
          <tbody>
            {barras
              .filter((b) => b.valor)
              .map((b) => (
                <tr key={b.clave} className="border-t border-linea">
                  <td className="py-1 text-tinta-suave first-letter:uppercase">{b.detalle.split(':')[0]}</td>
                  <td className="cifra py-1 text-right font-bold">{formato(b.valor)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

function Ranking({ titulo, filas }) {
  const max = Math.max(...filas.map((f) => f.valor), 1)
  return (
    <div className="rounded-2xl border border-linea bg-panel p-4">
      <p className="mb-3 font-extrabold">{titulo}</p>
      <ul className="space-y-3">
        {filas.map((f) => (
          <li key={f.nombre}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-bold">{f.nombre}</span>
              <span className="cifra shrink-0 font-bold">{f.texto}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-panel-2">
              <div className="h-full rounded-full bg-laton" style={{ width: `${(f.valor / max) * 100}%` }} />
            </div>
            {f.nota && <p className="mt-0.5 text-xs text-tinta-suave">{f.nota}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
