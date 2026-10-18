import { useState } from 'react'
import { useEstado, venderProductos, anularVenta, agregarGasto, eliminarGasto, cerrarCaja, reabrirCaja } from '../data/store'
import { claveDia, formatearDia, formatearHora, formatearDuracion } from '../domain/hora'
import { formatearMonto, METODOS, textoMetodo } from '../domain/dinero'
import { cuentasCaja } from '../domain/caja'
import { Hoja } from '../ui/Hoja'
import { HojaVender } from '../ui/Cobro'

// La caja del día: cuánto entró (cortes y productos, en efectivo, Yape
// y Plin), cuánto le toca a cada barbero por su comisión, los gastos,
// la ganancia del local y el cierre de caja del efectivo. Abajo cada
// atención, venta y gasto.
export default function Caja() {
  const estado = useEstado()
  const { sillas, config, productos, cierres } = estado
  const [dia, setDia] = useState(claveDia())
  const [hoja, setHoja] = useState(null) // 'vender' | 'gasto' | 'cierre'
  const c = cuentasCaja(estado, dia, dia)
  const cierre = cierres.find((x) => x.dia === dia)
  const nombreDe = (id) => sillas.find((s) => s.id === id)?.nombre || 'Silla quitada'
  const esHoy = dia === claveDia()

  function moverDia(delta) {
    const [a, m, d] = dia.split('-').map(Number)
    setDia(claveDia(new Date(a, m - 1, d + delta)))
  }

  // Todo lo del día en una sola lista, lo último primero.
  const movimientos = [
    ...c.atenciones.map((h) => ({ tipo: 'atencion', fecha: h.fin, h })),
    ...c.ventas.map((v) => ({ tipo: 'venta', fecha: v.fecha, v })),
    ...c.gastos.map((g) => ({ tipo: 'gasto', fecha: g.fecha, g })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha))

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
          disabled={esHoy}
          className="rounded-lg border border-linea px-3 py-2 text-tinta-suave disabled:opacity-30"
          aria-label="Día siguiente"
        >
          ›
        </button>
      </div>

      {/* Total del día */}
      <div className="rounded-3xl border border-laton/40 bg-gradient-to-br from-laton-suave to-panel p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-laton">Cobrado en el día</p>
        <p className="cifra mt-1 text-4xl font-extrabold">{formatearMonto(c.ingresos)}</p>
        <p className="text-sm text-tinta-suave">
          ✂ Cortes {formatearMonto(c.servicios)} · 🧴 Productos {formatearMonto(c.productos)}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {METODOS.map((m) => (
            <div key={m.id} className="rounded-2xl bg-fondo/70 px-2 py-2.5 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-tinta-suave">
                {m.icono} {m.texto}
              </p>
              <p className="cifra text-base font-extrabold">{formatearMonto(c.porMetodo[m.id])}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Ganancia del local */}
      <div className="overflow-hidden rounded-2xl border border-linea bg-panel">
        <Fila texto="Cobrado" valor={c.ingresos} />
        <Fila texto={`Comisión de barberos (${config.comisionPct}% de los cortes)`} valor={-c.comisiones} />
        <Fila texto="Gastos" valor={-c.totalGastos} />
        <div className="flex items-center justify-between border-t-2 border-laton/50 px-4 py-3">
          <span className="font-extrabold">Ganancia del local</span>
          <span className={`cifra text-xl font-extrabold ${c.ganancia >= 0 ? 'text-libre' : 'text-ocupada'}`}>{formatearMonto(c.ganancia)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setHoja('vender')} className="rounded-2xl border border-linea bg-panel py-3 text-sm font-bold">
          🧴 Vender producto
        </button>
        <button type="button" onClick={() => setHoja('gasto')} className="rounded-2xl border border-linea bg-panel py-3 text-sm font-bold">
          🧾 Anotar gasto
        </button>
      </div>

      {/* Por barbero, con su comisión */}
      {c.porBarbero.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-linea bg-panel">
          <p className="border-b border-linea px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-tinta-suave">Por barbero · lo que se le paga</p>
          <ul className="divide-y divide-linea">
            {c.porBarbero.map((b) => (
              <li key={b.nombre} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">✂ {b.nombre}</p>
                  <p className="text-xs text-tinta-suave">
                    {b.atenciones} {b.atenciones === 1 ? 'atención' : 'atenciones'} · cortes {formatearMonto(b.servicios)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="cifra text-lg font-extrabold text-laton">{formatearMonto(b.comision)}</p>
                  <p className="text-[11px] text-tinta-suave">su comisión</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cierre de caja */}
      <div className={`rounded-2xl border p-4 ${cierre ? (Math.abs(cierre.contado - cierre.esperado) < 0.01 ? 'border-libre/50 bg-libre-suave' : 'border-ocupada/50 bg-ocupada-suave') : 'border-linea bg-panel'}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-extrabold">🔒 Cierre de caja</p>
            <p className="text-sm text-tinta-suave">
              Efectivo que debería haber: <span className="cifra font-bold text-tinta">{formatearMonto(c.efectivoEsperado)}</span>
            </p>
          </div>
          {!cierre && (
            <button type="button" onClick={() => setHoja('cierre')} className="shrink-0 rounded-xl bg-laton px-3 py-2 text-sm font-bold text-fondo">
              Cerrar caja
            </button>
          )}
        </div>
        {cierre && <ResultadoCierre cierre={cierre} onReabrir={() => confirm('¿Reabrir la caja de este día?') && reabrirCaja(dia)} />}
      </div>

      {/* Movimientos del día */}
      {movimientos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linea p-6 text-center text-tinta-suave">Ese día no hubo movimientos.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-linea bg-panel">
          <p className="border-b border-linea px-4 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-tinta-suave">Movimientos ({movimientos.length})</p>
          <ul className="divide-y divide-linea">
            {movimientos.map((m) =>
              m.tipo === 'atencion' ? (
                <li key={m.h.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {nombreDe(m.h.sillaId)}
                      {m.h.barbero ? <span className="font-normal text-tinta-suave"> · {m.h.barbero}</span> : ''}
                    </p>
                    {m.h.cliente && <p className="truncate text-sm">👤 {m.h.cliente}</p>}
                    <p className="text-sm text-tinta-suave">
                      <span className="cifra text-ocupada">{formatearHora(m.h.inicio)}</span> → <span className="cifra text-libre">{formatearHora(m.h.fin)}</span> ·{' '}
                      {formatearDuracion(new Date(m.h.fin) - new Date(m.h.inicio))}
                    </p>
                    {m.h.cobro?.servicios?.length > 0 && (
                      <p className="truncate text-xs text-laton">
                        ✂ {m.h.cobro.servicios.map((x) => x.nombre).join(' + ')}
                        {m.h.cobro.gratis ? ' · 🎁 gratis (fidelidad)' : ''}
                      </p>
                    )}
                    {m.h.cobro?.productos?.length > 0 && (
                      <p className="truncate text-xs text-laton">🧴 {m.h.cobro.productos.map((x) => `${x.cantidad} ${x.nombre}`).join(', ')}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {m.h.cobro ? (
                      <>
                        <p className="cifra font-extrabold">{m.h.cobro.gratis && !m.h.cobro.monto ? '🎁 Gratis' : formatearMonto(m.h.cobro.monto)}</p>
                        <p className="text-xs text-tinta-suave">{m.h.cobro.monto ? textoMetodo(m.h.cobro.metodo) : 'fidelidad'}</p>
                      </>
                    ) : (
                      <p className="text-xs text-tinta-suave">Sin cobrar</p>
                    )}
                  </div>
                </li>
              ) : m.tipo === 'venta' ? (
                <li key={m.v.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-bold">🧴 Venta</p>
                    <p className="truncate text-sm text-tinta-suave">{m.v.items.map((x) => `${x.cantidad} ${x.nombre}`).join(', ')}</p>
                    <p className="cifra text-xs text-tinta-suave">{formatearHora(m.v.fecha)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="cifra font-extrabold">{formatearMonto(m.v.monto)}</p>
                    <p className="text-xs text-tinta-suave">{textoMetodo(m.v.metodo)}</p>
                    <button type="button" onClick={() => confirm('¿Anular esta venta? El stock vuelve.') && anularVenta(m.v.id)} className="text-[11px] text-ocupada underline decoration-dotted">
                      Anular
                    </button>
                  </div>
                </li>
              ) : (
                <li key={m.g.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-bold">🧾 Gasto</p>
                    <p className="truncate text-sm text-tinta-suave">{m.g.concepto}</p>
                    <p className="cifra text-xs text-tinta-suave">{formatearHora(m.g.fecha)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="cifra font-extrabold text-ocupada">−{formatearMonto(m.g.monto)}</p>
                    <p className="text-xs text-tinta-suave">{textoMetodo(m.g.metodo)}</p>
                    <button type="button" onClick={() => confirm('¿Borrar este gasto?') && eliminarGasto(m.g.id)} className="text-[11px] text-ocupada underline decoration-dotted">
                      Borrar
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        </div>
      )}

      {hoja === 'vender' && (
        <Hoja titulo="Vender producto" onCerrar={() => setHoja(null)}>
          <HojaVender
            productos={productos}
            onVender={(items, metodo) => {
              venderProductos(items, metodo)
              setHoja(null)
            }}
          />
        </Hoja>
      )}
      {hoja === 'gasto' && (
        <Hoja titulo="Anotar gasto" onCerrar={() => setHoja(null)}>
          <NuevoGasto
            dia={dia}
            onGuardar={(g) => {
              agregarGasto(g)
              setHoja(null)
            }}
          />
        </Hoja>
      )}
      {hoja === 'cierre' && (
        <Hoja titulo="Cerrar caja" subtitulo={formatearDia(dia)} onCerrar={() => setHoja(null)}>
          <NuevoCierre
            esperado={c.efectivoEsperado}
            onCerrar={(contado, nota) => {
              cerrarCaja({ dia, esperado: c.efectivoEsperado, contado, nota })
              setHoja(null)
            }}
          />
        </Hoja>
      )}
    </div>
  )
}

function Fila({ texto, valor }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-linea px-4 py-2.5 last:border-b-0">
      <span className="text-sm text-tinta-suave">{texto}</span>
      <span className={`cifra font-bold ${valor < 0 ? 'text-ocupada' : ''}`}>
        {valor < 0 ? '−' : ''}
        {formatearMonto(Math.abs(valor))}
      </span>
    </div>
  )
}

function ResultadoCierre({ cierre, onReabrir }) {
  const diferencia = cierre.contado - cierre.esperado
  return (
    <div className="mt-3 space-y-1 text-sm">
      <p>
        Contado: <span className="cifra font-bold">{formatearMonto(cierre.contado)}</span> · cerrado a las {formatearHora(cierre.hora)}
      </p>
      <p className={`text-base font-extrabold ${Math.abs(diferencia) < 0.01 ? 'text-libre' : 'text-ocupada'}`}>
        {Math.abs(diferencia) < 0.01 ? '✓ La caja cuadra' : diferencia < 0 ? `Falta ${formatearMonto(-diferencia)}` : `Sobra ${formatearMonto(diferencia)}`}
      </p>
      {cierre.nota && <p className="text-tinta-suave">📝 {cierre.nota}</p>}
      <button type="button" onClick={onReabrir} className="text-xs text-tinta-suave underline decoration-dotted">
        Reabrir caja
      </button>
    </div>
  )
}

function NuevoCierre({ esperado, onCerrar }) {
  const [contado, setContado] = useState('')
  const [nota, setNota] = useState('')
  const diferencia = contado === '' ? null : Number(contado) - esperado
  return (
    <div className="space-y-4">
      <p className="text-sm text-tinta-suave">
        Cuenta el efectivo que hay en la caja. Debería haber <span className="cifra font-bold text-tinta">{formatearMonto(esperado)}</span> (lo cobrado en efectivo menos los gastos pagados en efectivo).
      </p>
      <label className="flex items-center gap-2 rounded-2xl border border-linea bg-fondo px-4 py-3">
        <span className="text-sm font-bold text-tinta-suave">Contado S/</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.1"
          value={contado}
          onChange={(e) => setContado(e.target.value)}
          autoFocus
          className="cifra w-full bg-transparent text-right text-3xl font-extrabold text-laton outline-none"
        />
      </label>
      {diferencia != null && (
        <p className={`text-center text-lg font-extrabold ${Math.abs(diferencia) < 0.01 ? 'text-libre' : 'text-ocupada'}`}>
          {Math.abs(diferencia) < 0.01 ? '✓ Cuadra' : diferencia < 0 ? `Falta ${formatearMonto(-diferencia)}` : `Sobra ${formatearMonto(diferencia)}`}
        </p>
      )}
      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Nota (opcional): por qué falta o sobra"
        className="w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton"
      />
      <button type="button" disabled={contado === ''} onClick={() => onCerrar(contado, nota)} className="w-full rounded-2xl bg-laton py-4 text-base font-extrabold text-fondo disabled:opacity-40">
        🔒 Cerrar caja
      </button>
    </div>
  )
}

const CONCEPTOS_RAPIDOS = ['Navajas', 'Gel / cera', 'Talco / colonia', 'Limpieza', 'Luz', 'Agua', 'Alquiler', 'Almuerzo']

function NuevoGasto({ dia, onGuardar }) {
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState('efectivo')
  // Un gasto de otro día queda a mediodía de ese día.
  const fecha = dia === claveDia() ? new Date().toISOString() : new Date(`${dia}T12:00:00`).toISOString()
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CONCEPTOS_RAPIDOS.map((x) => (
          <button key={x} type="button" onClick={() => setConcepto(x)} className={`rounded-full border px-3 py-1 text-sm ${concepto === x ? 'border-laton bg-laton-suave' : 'border-linea text-tinta-suave'}`}>
            {x}
          </button>
        ))}
      </div>
      <input
        value={concepto}
        onChange={(e) => setConcepto(e.target.value)}
        placeholder="¿En qué se gastó?"
        className="w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton"
      />
      <label className="flex items-center gap-2 rounded-2xl border border-linea bg-fondo px-4 py-3">
        <span className="text-sm font-bold text-tinta-suave">S/</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.5"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0"
          className="cifra w-full bg-transparent text-right text-3xl font-extrabold text-ocupada outline-none"
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        {METODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMetodo(m.id)}
            aria-pressed={metodo === m.id}
            className={`rounded-2xl border-2 py-2.5 text-sm font-bold ${metodo === m.id ? 'border-laton bg-laton-suave' : 'border-linea bg-fondo text-tinta-suave'}`}
          >
            {m.icono} {m.texto}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={!concepto.trim() || !(Number(monto) > 0)}
        onClick={() => onGuardar({ concepto, monto, metodo, fecha })}
        className="w-full rounded-2xl bg-laton py-4 text-base font-extrabold text-fondo disabled:opacity-40"
      >
        Guardar gasto
      </button>
    </div>
  )
}
