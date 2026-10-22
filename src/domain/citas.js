import { hora12, seCruzan } from './horario'

// Tiempos de una cita (pedido del usuario, 2026-10-18): al cliente se le
// espera como máximo `tolerancia` minutos (Ajustes, 15 por defecto);
// pasado eso, la cita "no llegó" y la silla deja de estar reservada.
// Una cita aceptada pone su silla en "Reservada" desde RESERVA_ANTES
// minutos antes de su hora.
export const RESERVA_ANTES = 30
export const ESTADOS_ACTIVOS = ['pendiente', 'confirmada']

export function inicioCita(c) {
  const [a, m, d] = c.fecha.split('-').map(Number)
  const [h, mi] = c.hora.split(':').map(Number)
  return new Date(a, m - 1, d, h, mi).getTime()
}

export function tolerancia(config) {
  return Math.max(0, Number(config?.toleranciaCita ?? 15))
}

// Hasta qué hora se le espera: "4:45 p. m."
export function esperaHasta(c, config) {
  const t = new Date(inicioCita(c) + tolerancia(config) * 60000)
  return hora12(`${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`)
}

// 'vencida' (pasó la tolerancia y no llegó), 'ahora' (la silla ya está
// reservada para ella), o 'luego'.
export function momentoCita(c, config, ahora = Date.now()) {
  const inicio = inicioCita(c)
  if (ahora > inicio + tolerancia(config) * 60000) return 'vencida'
  if (ahora >= inicio - RESERVA_ANTES * 60000) return 'ahora'
  return 'luego'
}

// Cómo sale el nombre del cliente en lo público (agenda, televisor,
// barberos): nombre y la inicial del apellido, "Luis O.".
export function nombreCorto(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return ''
  const primero = partes[0][0].toUpperCase() + partes[0].slice(1)
  return partes.length > 1 ? `${primero} ${partes[1][0].toUpperCase()}.` : primero
}

// Otra cita aceptada en esa silla que se cruza con esta hora (para no
// reservar dos citas en la misma silla a la vez), o null.
export function citaEnSilla(citas, sillaId, { fecha, hora, duracion, id = null }) {
  return (
    citas.find((c) => c.id !== id && c.estado === 'confirmada' && c.sillaId === sillaId && c.fecha === fecha && seCruzan(c.hora, c.duracion, hora, duracion)) || null
  )
}

// La silla donde conviene sentar a una cita que llegó: la que tiene
// asignada si está libre; si no, la de su barbero; si no, cualquiera libre.
export function sillaParaCita(cita, sillas) {
  const libres = sillas.filter((s) => !s.ocupadaDesde)
  return (
    libres.find((s) => s.id === cita.sillaId) ||
    libres.find((s) => cita.barberoId && s.barberoFijoId === cita.barberoId) ||
    libres[0] ||
    null
  )
}
