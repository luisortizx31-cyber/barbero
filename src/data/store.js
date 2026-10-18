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
//   sillas:    [{ id, nombre, barbero, color, estilo, foto, ocupadaDesde, liberadaEn, cliente }]
//              foto: imagen (data URL) de la silla real del local, o null
//              ocupadaDesde: ISO si está ocupada, null si está libre
//              liberadaEn: ISO de la última vez que se liberó
//   historial: [{ id, sillaId, inicio, fin, cliente }]  cada atención terminada
// }

const CLAVE = 'barberia:v1'

export const COLORES = ['#8b1e2d', '#1d1d1f', '#6b3e1f', '#1f4e79', '#2f5d3a', '#c9a227', '#f2ede4']

function nuevoId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function sillaNueva(n) {
  return { id: nuevoId(), nombre: `Silla ${n}`, barbero: '', color: COLORES[(n - 1) % 3], foto: null, ocupadaDesde: null, liberadaEn: null, cliente: '' }
}

function inicial() {
  return { config: { nombre: 'Mi Barbería' }, sillas: [1, 2, 3].map(sillaNueva), historial: [] }
}

function leer() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE))
    if (guardado?.sillas) return guardado
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

export function ocuparSilla(id, cliente = '') {
  cambiarSilla(id, { ocupadaDesde: new Date().toISOString(), cliente: cliente.trim() })
}

export function liberarSilla(id) {
  const silla = estado.sillas.find((s) => s.id === id)
  if (!silla?.ocupadaDesde) return
  const fin = new Date().toISOString()
  fijar({
    ...estado,
    sillas: estado.sillas.map((s) => (s.id === id ? { ...s, ocupadaDesde: null, liberadaEn: fin, cliente: '' } : s)),
    historial: [...estado.historial, { id: nuevoId(), sillaId: id, inicio: silla.ocupadaDesde, fin, cliente: silla.cliente || '' }].slice(-2000),
  })
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
