import { useSyncExternalStore } from 'react'

// Todo lo de la barbería se guarda en ESTE equipo (localStorage), sin
// cuentas ni servidor - igual que servicio-electrico. Toda la
// persistencia está acá: para que varios celulares vean las mismas
// sillas (los barberos marcan desde su celular y la pantalla del local
// se actualiza sola) basta con cambiar este archivo por una base en la
// nube.
//
// estado = {
//   config:    { nombre }
//   servicios: [{ id, nombre, precio }]  los cortes y sus precios
//   sillas:    [{ id, nombre, barbero, color, foto, ocupadaDesde, liberadaEn, cliente, servicioIds }]
//              foto: imagen (data URL) de la silla real del local, o null
//              ocupadaDesde: ISO si está ocupada, null si está libre
//              liberadaEn: ISO de la última vez que se liberó
//              servicioIds: los cortes elegidos al ocuparla (se pueden cambiar al cobrar)
//   historial: [{ id, sillaId, barbero, inicio, fin, cliente, cobro }]  cada atención terminada
//              cobro: null (se liberó sin cobrar) | { servicios: [{ nombre, precio }], monto, metodo }
//              metodo: 'efectivo' | 'yape' | 'plin'
// }

const CLAVE = 'barberia:v1'

export const COLORES = ['#8b1e2d', '#1d1d1f', '#6b3e1f', '#1f4e79', '#2f5d3a', '#c9a227', '#f2ede4']

function nuevoId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function sillaNueva(n) {
  return { id: nuevoId(), nombre: `Silla ${n}`, barbero: '', color: COLORES[(n - 1) % 3], foto: null, ocupadaDesde: null, liberadaEn: null, cliente: '', servicioIds: [] }
}

// Cortes de partida (pedido del usuario, 2026-10-17: "elegir un
// corte" y cobrar la silla); se cambian en la pestaña Cortes.
const SERVICIOS_INICIALES = [
  ['Corte clásico', 15],
  ['Degradado (fade)', 20],
  ['Corte + barba', 25],
  ['Barba', 10],
  ['Corte de niño', 12],
]

function serviciosIniciales() {
  return SERVICIOS_INICIALES.map(([nombre, precio]) => ({ id: nuevoId(), nombre, precio }))
}

function inicial() {
  return { config: { nombre: 'Mi Barbería' }, servicios: serviciosIniciales(), sillas: [1, 2, 3].map(sillaNueva), historial: [] }
}

function leer() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE))
    if (guardado?.sillas) return { servicios: serviciosIniciales(), ...guardado }
  } catch (err) {
    console.error('[store] leer', err)
  }
  return inicial()
}

let estado = leer()
const oyentes = new Set()

function fijar(nuevo) {
  estado = nuevo
  try {
    localStorage.setItem(CLAVE, JSON.stringify(nuevo))
  } catch (err) {
    console.error('[store] guardar', err)
    alert('No se pudo guardar. Si subiste muchas fotos, prueba con una más chica.')
  }
  oyentes.forEach((fn) => fn())
}

// Si la pantalla está abierta en otra pestaña o ventana del mismo
// equipo (por ejemplo, en el televisor conectado a la compu), se
// actualiza sola cuando se marca una silla desde la otra.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== CLAVE) return
    estado = leer()
    oyentes.forEach((fn) => fn())
  })
}

function suscribir(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

export function useEstado() {
  return useSyncExternalStore(suscribir, () => estado)
}

function cambiarSilla(id, cambios) {
  fijar({ ...estado, sillas: estado.sillas.map((s) => (s.id === id ? { ...s, ...cambios } : s)) })
}

// --- Ocupar y liberar ------------------------------------------------------

// `servicioIds`: el corte (o cortes) que se va a hacer; puede ir vacío
// y elegirse al cobrar.
export function ocuparSilla(id, servicioIds = []) {
  cambiarSilla(id, { ocupadaDesde: new Date().toISOString(), cliente: '', servicioIds })
}

export function cambiarServiciosSilla(id, servicioIds) {
  cambiarSilla(id, { servicioIds })
}

// `cobro`: { servicios: [{ nombre, precio }], monto, metodo } o null
// para liberarla sin cobrar. Queda en el historial con el barbero de
// ese momento, para la caja por barbero.
export function liberarSilla(id, cobro = null) {
  const silla = estado.sillas.find((s) => s.id === id)
  if (!silla?.ocupadaDesde) return
  const fin = new Date().toISOString()
  fijar({
    ...estado,
    sillas: estado.sillas.map((s) => (s.id === id ? { ...s, ocupadaDesde: null, liberadaEn: fin, cliente: '', servicioIds: [] } : s)),
    historial: [
      ...estado.historial,
      { id: nuevoId(), sillaId: id, barbero: silla.barbero || '', inicio: silla.ocupadaDesde, fin, cliente: silla.cliente || '', cobro },
    ].slice(-5000),
  })
}

// --- Cortes y precios -----------------------------------------------------

export function agregarServicio(nombre, precio) {
  fijar({ ...estado, servicios: [...estado.servicios, { id: nuevoId(), nombre: nombre.trim(), precio: Number(precio) || 0 }] })
}

export function guardarServicio(id, datos) {
  fijar({ ...estado, servicios: estado.servicios.map((x) => (x.id === id ? { ...x, ...datos } : x)) })
}

export function eliminarServicio(id) {
  fijar({ ...estado, servicios: estado.servicios.filter((x) => x.id !== id) })
}

// --- Sillas del local -----------------------------------------------------

export function agregarSilla() {
  fijar({ ...estado, sillas: [...estado.sillas, sillaNueva(estado.sillas.length + 1)] })
}

export function guardarSilla(id, datos) {
  cambiarSilla(id, datos)
}

export function eliminarSilla(id) {
  fijar({ ...estado, sillas: estado.sillas.filter((s) => s.id !== id) })
}

export function moverSilla(id, delta) {
  const i = estado.sillas.findIndex((s) => s.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= estado.sillas.length) return
  const sillas = [...estado.sillas]
  ;[sillas[i], sillas[j]] = [sillas[j], sillas[i]]
  fijar({ ...estado, sillas })
}

export function guardarConfig(cambios) {
  fijar({ ...estado, config: { ...estado.config, ...cambios } })
}

export function borrarHistorial() {
  fijar({ ...estado, historial: [] })
}

// --- Deshacer -------------------------------------------------------------
// La pantalla ofrece "Deshacer" unos segundos después de ocupar o
// liberar, por si se tocó la silla equivocada.
export function obtenerEstado() {
  return estado
}

export function restaurar(anterior) {
  fijar(anterior)
}
