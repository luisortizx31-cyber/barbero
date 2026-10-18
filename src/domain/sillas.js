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
