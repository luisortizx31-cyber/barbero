import { claveDia } from './hora'
import { METODOS } from './dinero'

// Las cuentas de la caja para un rango de días [desde, hasta] (claves
// "YYYY-MM-DD", ambos incluidos). La usan la Caja del día y el Resumen.
//
// Comisión: el barbero se lleva su % de los SERVICIOS (cortes) que
// cobró; los productos son todos del local.

function enRango(iso, desde, hasta) {
  const d = claveDia(iso)
  return d >= desde && d <= hasta
}

export function totalProductos(items = []) {
  return items.reduce((t, x) => t + x.precio * x.cantidad, 0)
}

export function cuentasCaja(estado, desde, hasta) {
  const atenciones = estado.historial.filter((h) => enRango(h.fin, desde, hasta))
  const cobradas = atenciones.filter((h) => h.cobro)
  const ventas = estado.ventas.filter((v) => enRango(v.fecha, desde, hasta))
  const gastos = estado.gastos.filter((g) => enRango(g.fecha, desde, hasta))

  const porMetodo = Object.fromEntries(METODOS.map((m) => [m.id, 0]))
  let servicios = 0
  let productos = 0
  const porBarbero = new Map()
  const nombreSilla = (id) => estado.sillas.find((s) => s.id === id)?.nombre || 'Silla quitada'

  for (const h of atenciones) {
    const quien = h.barbero || nombreSilla(h.sillaId)
    const b = porBarbero.get(quien) || { atenciones: 0, servicios: 0, comision: 0 }
    b.atenciones += 1
    if (h.cobro) {
      const prod = totalProductos(h.cobro.productos)
      const serv = Math.max(0, h.cobro.monto - prod)
      servicios += serv
      productos += prod
      porMetodo[h.cobro.metodo] = (porMetodo[h.cobro.metodo] || 0) + h.cobro.monto
      b.servicios += serv
      b.comision += (serv * (h.cobro.comisionPct ?? estado.config.comisionPct ?? 0)) / 100
    }
    porBarbero.set(quien, b)
  }
  for (const v of ventas) {
    productos += v.monto
    porMetodo[v.metodo] = (porMetodo[v.metodo] || 0) + v.monto
  }

  const totalGastos = gastos.reduce((t, g) => t + g.monto, 0)
  const gastosEfectivo = gastos.filter((g) => g.metodo === 'efectivo').reduce((t, g) => t + g.monto, 0)
  const ingresos = servicios + productos
  const comisiones = [...porBarbero.values()].reduce((t, b) => t + b.comision, 0)

  return {
    atenciones,
    cobradas,
    ventas,
    gastos,
    ingresos,
    servicios,
    productos,
    porMetodo,
    totalGastos,
    comisiones,
    // Lo que le queda al local: lo cobrado - comisiones de barberos - gastos.
    ganancia: ingresos - comisiones - totalGastos,
    // El efectivo que debería haber en la caja (para el cierre).
    efectivoEsperado: (porMetodo.efectivo || 0) - gastosEfectivo,
    porBarbero: [...porBarbero.entries()].map(([nombre, b]) => ({ nombre, ...b })).sort((a, b) => b.servicios - a.servicios),
  }
}
