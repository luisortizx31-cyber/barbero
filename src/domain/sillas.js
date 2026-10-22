// Cada silla tiene dos barberos distintos (bug real, 2026-10-18: al
// cobrar, el barbero "se quedaba" en la silla):
//   barberoFijoId  el que trabaja normalmente en esa silla (se elige en
//                  Más → Sillas); sirve de sugerencia al ocuparla
//   barberoId      el que está cortando AHORA; se borra al liberar
// El de la silla para mostrar y para emparejar con la cola/citas: el que
// corta si está ocupada, el fijo si está libre.
export function barberoDeSilla(silla) {
  return silla.ocupadaDesde ? silla.barberoId || null : silla.barberoFijoId || null
}

// Para comparar nombres de clientes: sin tildes, mayúsculas ni espacios
// de más ("Luis  Ortíz" = "luis ortiz").
export const mismoNombre = (a, b) => {
  const n = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
  return Boolean(n(a)) && n(a) === n(b)
}

// La otra silla ocupada (que no sea `menosId`) donde ya está este cliente:
// por su ficha o, si no la tiene, por el mismo nombre. Una persona no se
// corta en dos sillas a la vez (pedido del usuario, 2026-10-20 y -22).
export function sillaDelCliente(sillas, { clienteId = null, nombre = '' }, menosId = null) {
  return (
    sillas.find(
      (s) => s.id !== menosId && s.ocupadaDesde && ((clienteId && s.clienteId === clienteId) || mismoNombre(s.cliente, nombre))
    ) || null
  )
}
