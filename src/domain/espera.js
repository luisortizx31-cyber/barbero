// Cuánto le falta a cada uno de la cola para sentarse, aproximado.
//
// Se toma lo que dura una atención en promedio (las últimas 30; 30 min
// si todavía no hay datos). Cada silla ocupada se libera cuando cumpla
// ese promedio; cada silla libre, ya. La cola se reparte en orden: cada
// uno toma la silla que se libere primero, y esa silla vuelve a estar
// libre un promedio después.

export const DURACION_POR_DEFECTO = 30 * 60000

export function duracionPromedio(historial) {
  const ultimas = historial.slice(-30)
  if (ultimas.length === 0) return DURACION_POR_DEFECTO
  const total = ultimas.reduce((t, h) => t + (new Date(h.fin) - new Date(h.inicio)), 0)
  // entre 10 min y 2 h, por si hay datos raros (una silla olvidada ocupada)
  return Math.min(120 * 60000, Math.max(10 * 60000, total / ultimas.length))
}

// Devuelve los ms de espera de cada uno de la cola, en orden.
export function esperaEstimada(sillas, espera, historial, ahora) {
  if (sillas.length === 0) return espera.map(() => null)
  const prom = duracionPromedio(historial)
  const libresEn = sillas.map((s) => (s.ocupadaDesde ? Math.max(0, new Date(s.ocupadaDesde).getTime() + prom - ahora) : 0))
  return espera.map(() => {
    let i = 0
    for (let k = 1; k < libresEn.length; k++) if (libresEn[k] < libresEn[i]) i = k
    const espera = libresEn[i]
    libresEn[i] += prom
    return espera
  })
}
