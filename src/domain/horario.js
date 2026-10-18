import { claveDia, formatearHora } from './hora'

// Horario de atención (pedido del usuario, 2026-10-18): por día de la
// semana (0 = domingo), abierto o no y de qué hora a qué hora. Sirve
// para el "Abierto · cierra 9:00 p. m." de la página de clientes y para
// que las citas solo se reserven en horas de atención.
export const HORARIO_INICIAL = {
  0: { abierto: true, desde: '09:00', hasta: '14:00' },
  1: { abierto: true, desde: '09:00', hasta: '21:00' },
  2: { abierto: true, desde: '09:00', hasta: '21:00' },
  3: { abierto: true, desde: '09:00', hasta: '21:00' },
  4: { abierto: true, desde: '09:00', hasta: '21:00' },
  5: { abierto: true, desde: '09:00', hasta: '21:00' },
  6: { abierto: true, desde: '09:00', hasta: '21:00' },
}

export const NOMBRES_DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// Lo que dura un corte (minutos). Los cortes de antes no la tenían: 30.
export const DURACION_CORTE = 30
export const duracionDe = (servicio) => Number(servicio?.duracion) || DURACION_CORTE

export function duracionDeCortes(servicios, ids) {
  const elegidos = servicios.filter((s) => ids?.includes(s.id))
  return elegidos.length ? elegidos.reduce((t, s) => t + duracionDe(s), 0) : null
}

const aMinutos = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number)
  return h * 60 + (m || 0)
}
const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export function hora12(hhmm) {
  const d = new Date()
  const m = aMinutos(hhmm)
  d.setHours(Math.floor(m / 60), m % 60, 0, 0)
  return formatearHora(d.toISOString())
}

function diaDe(horario, fecha) {
  return (horario || HORARIO_INICIAL)[new Date(fecha).getDay()] || { abierto: false }
}

// "Abierto · cierra 9:00 p. m." / "Cerrado · abre mañana 9:00 a. m."
export function estadoAtencion(horario, ahora = Date.now()) {
  const d = new Date(ahora)
  const hoy = diaDe(horario, d)
  const min = d.getHours() * 60 + d.getMinutes()
  if (hoy.abierto && min >= aMinutos(hoy.desde) && min < aMinutos(hoy.hasta)) {
    return { abierto: true, texto: `Abierto · cierra ${hora12(hoy.hasta)}` }
  }
  if (hoy.abierto && min < aMinutos(hoy.desde)) return { abierto: false, texto: `Cerrado · abre hoy ${hora12(hoy.desde)}` }
  for (let i = 1; i <= 7; i++) {
    const otro = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)
    const h = diaDe(horario, otro)
    if (h.abierto) return { abierto: false, texto: `Cerrado · abre ${i === 1 ? 'mañana' : NOMBRES_DIAS[otro.getDay()].toLowerCase()} ${hora12(h.desde)}` }
  }
  return { abierto: false, texto: 'Cerrado' }
}

// Los próximos `n` días en que se atiende: [{ clave, fecha }]
export function proximosDiasAbiertos(horario, n = 7, ahora = Date.now()) {
  const d = new Date(ahora)
  const dias = []
  for (let i = 0; dias.length < n && i < 30; i++) {
    const f = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)
    if (diaDe(horario, f).abierto) dias.push({ clave: claveDia(f), fecha: f })
  }
  return dias
}

// Horas en que se puede reservar una cita de `duracion` minutos el día
// `clave`, cada 30 minutos dentro del horario, que no choquen con otras
// citas (`agenda`, sin datos personales). Con barbero elegido, no debe
// chocar con las suyas; con "cualquiera", basta con que no estén todos
// ocupados a la vez. Hoy, solo horas que todavía no pasaron (+15 min).
export function horasLibres({ clave, duracion, barberoId, agenda, horario, capacidad, ahora = Date.now() }) {
  const [a, m, dd] = clave.split('-').map(Number)
  const fecha = new Date(a, m - 1, dd)
  const dia = diaDe(horario, fecha)
  if (!dia.abierto) return []
  const inicio = aMinutos(dia.desde)
  const fin = aMinutos(dia.hasta)
  const esHoy = clave === claveDia(ahora)
  const minAhora = esHoy ? new Date(ahora).getHours() * 60 + new Date(ahora).getMinutes() + 15 : -1
  const delDia = agenda.filter((x) => x.fecha === clave)
  const libres = []
  for (let t = inicio; t + duracion <= fin; t += 30) {
    if (t < minAhora) continue
    const choques = delDia.filter((x) => {
      const xi = aMinutos(x.hora)
      return xi < t + duracion && t < xi + (Number(x.duracion) || DURACION_CORTE)
    })
    const ocupado = barberoId ? choques.some((x) => x.barberoId === barberoId) : choques.length >= Math.max(1, capacidad)
    if (!ocupado) libres.push(aHora(t))
  }
  return libres
}
