import { hora12 } from './horario'

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
