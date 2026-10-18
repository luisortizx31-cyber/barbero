import { duracionDeCortes } from './horario'

// Cuánto le falta a cada uno de la cola para sentarse, aproximado.
//
// Cada silla ocupada se libera cuando termine su corte: lo que dura el
// corte elegido (ver duración en Cortes), o lo que dura una atención en
// promedio (las últimas 30; 30 min si todavía no hay datos). Cada silla
// libre, ya. La cola se reparte en orden: cada uno toma la silla que se
// libere primero - si pidió un barbero, solo las sillas de ese barbero
// (pedido del usuario, 2026-10-18: "los clientes quieren a su barbero de
// preferencia") - y esa silla vuelve a estar libre cuando termine su corte.

export const DURACION_POR_DEFECTO = 30 * 60000

export function duracionPromedio(historial) {
  const ultimas = historial.slice(-30)
  if (ultimas.length === 0) return DURACION_POR_DEFECTO
  const total = ultimas.reduce((t, h) => t + (new Date(h.fin) - new Date(h.inicio)), 0)
  // entre 10 min y 2 h, por si hay datos raros (una silla olvidada ocupada)
  return Math.min(120 * 60000, Math.max(10 * 60000, total / ultimas.length))
}

// Devuelve los ms de espera de cada uno de la cola, en orden.
export function esperaEstimada(sillas, espera, historial, ahora, servicios = []) {
  if (sillas.length === 0) return espera.map(() => null)
  const prom = duracionPromedio(historial)
  const durDe = (ids) => {
    const min = duracionDeCortes(servicios, ids)
    return min ? min * 60000 : prom
  }
  const libresEn = sillas.map((s) => (s.ocupadaDesde ? Math.max(0, new Date(s.ocupadaDesde).getTime() + durDe(s.servicioIds) - ahora) : 0))
  return espera.map((x) => {
    const suyas = x.barberoId ? sillas.map((s, k) => (s.barberoId === x.barberoId ? k : -1)).filter((k) => k >= 0) : []
    const candidatas = suyas.length ? suyas : sillas.map((_, k) => k)
    let i = candidatas[0]
    for (const k of candidatas) if (libresEn[k] < libresEn[i]) i = k
    const espera = libresEn[i]
    libresEn[i] += durDe(x.servicioIds)
    return espera
  })
}
