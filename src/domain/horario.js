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

// Reservar a cualquier hora, al minuto (pedido del usuario, 2026-10-20:
// "6, 6 y 1, 6 y 2", no cada media hora). Cada cita ocupa un "carril"
// (uno por silla) en bloques de BLOQUE_MIN minutos; una hora se bloquea
// cuando a esa hora ya están ocupadas TODAS las sillas.
export const BLOQUE_MIN = 5

// Si dos citas (hora "HH:MM" y duración en minutos) se pisan.
export function seCruzan(horaA, duracionA, horaB, duracionB) {
  const a = aMinutos(horaA)
  const b = aMinutos(horaB)
  return a < b + (Number(duracionB) || DURACION_CORTE) && b < a + (Number(duracionA) || DURACION_CORTE)
}

// Los bloques que ocupa una cita: "2026-10-20_18:00", "2026-10-20_18:05"...
// En la nube cada bloque de cada carril es un documento
// ("2026-10-20_18:05_2") que sin cuenta solo se puede CREAR (no pisar):
// si dos personas toman el mismo carril a la vez, la segunda no puede
// (ver bloqueos en firestore.rules).
export function bloquesDe(fecha, hora, duracion) {
  const inicio = aMinutos(hora)
  const fin = inicio + (Number(duracion) || DURACION_CORTE)
  const claves = []
  for (let t = inicio - (inicio % BLOQUE_MIN); t < fin; t += BLOQUE_MIN) claves.push(`${fecha}_${aHora(t)}`)
  return claves
}

// El primer carril (1..capacidad) libre en todos los `bloques`, o null.
// `bloqueos`: [{ id, citaId, carril }]; los de `citaId` no cuentan.
export function carrilLibre(bloques, bloqueos, capacidad, citaId = null) {
  const tomados = new Set(bloqueos.filter((x) => x.citaId !== citaId).map((x) => x.id))
  for (let k = 1; k <= Math.max(1, capacidad); k++) {
    if (bloques.every((b) => !tomados.has(`${b}_${k}`))) return k
  }
  return null
}

// De qué hora a qué hora se atiende el día `clave` ("HH:MM"), o null.
export function rangoDelDia(horario, clave) {
  const [a, m, d] = clave.split('-').map(Number)
  const dia = diaDe(horario, new Date(a, m - 1, d))
  return dia.abierto ? { desde: dia.desde, hasta: dia.hasta } : null
}

// ¿Se puede reservar a esa hora? { ok, motivo, carril }.
// `soloCupo`: el dueño, que puede anotar fuera de horario o en el pasado;
// solo se revisa que haya silla y que el barbero no tenga otra cita.
export function revisarHora({ clave, hora, duracion, barberoId = null, barberoNombre = '', agenda, bloqueos, horario, capacidad, citaId = null, soloCupo = false, ahora = Date.now() }) {
  if (!clave || !/^\d{1,2}:\d{2}$/.test(hora || '')) return { ok: false, motivo: 'Elige la hora.' }
  const t = aMinutos(hora)
  if (!soloCupo) {
    const rango = rangoDelDia(horario, clave)
    if (!rango) return { ok: false, motivo: 'Ese día no atendemos.' }
    if (t < aMinutos(rango.desde) || t >= aMinutos(rango.hasta)) return { ok: false, motivo: `Ese día atendemos de ${hora12(rango.desde)} a ${hora12(rango.hasta)}` }
    if (t + duracion > aMinutos(rango.hasta)) return { ok: false, motivo: `Tu corte dura ~${duracion} min y cerramos a las ${hora12(rango.hasta)}: elige una hora más temprano.` }
    if (clave === claveDia(ahora)) {
      const d = new Date(ahora)
      if (t < d.getHours() * 60 + d.getMinutes() + 10) return { ok: false, motivo: 'Esa hora ya pasó o es muy pronto. Elige una hora más tarde.' }
    }
  }
  if (barberoId && agenda.some((x) => x.id !== citaId && x.fecha === clave && x.barberoId === barberoId && seCruzan(x.hora, x.duracion, hora, duracion))) {
    return { ok: false, motivo: `${barberoNombre || 'Ese barbero'} ya tiene una cita a esa hora. Elige otra hora u otro barbero.` }
  }
  const carril = carrilLibre(bloquesDe(clave, hora, duracion), bloqueos, capacidad, citaId)
  if (!carril) return { ok: false, motivo: capacidad <= 1 ? 'A esa hora la silla ya está reservada. Elige otra hora.' : `A esa hora las ${capacidad} sillas ya están reservadas. Elige otra hora.` }
  return { ok: true, motivo: '', carril }
}
