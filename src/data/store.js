import { useSyncExternalStore } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth'
import { auth } from './firebase'
import { escucharBarberia, guardarCambios } from './nube'
import { SUPER_UID, obtenerPerfil } from './plataforma'

// Todo lo de la barbería: el estado y las acciones que lo cambian.
// Al principio vivía solo en este equipo (localStorage); desde el
// 2026-10-18 se guarda en Firebase (ver más abajo y nube.js) para que
// varios celulares y el televisor vean lo mismo.
//
// estado = {
//   config:    { nombre, comisionPct, fidelidadCada, diasRecordatorio }
//              comisionPct: % de cada servicio que se lleva el barbero
//              fidelidadCada: cada cuántos cortes uno sale gratis (0 = sin tarjeta)
//              diasRecordatorio: a los cuántos días sin venir se le recuerda
//   servicios: [{ id, nombre, precio }]  los cortes y sus precios
//   sillas:    [{ id, nombre, barbero, color, foto, ocupadaDesde, liberadaEn, clienteId, cliente, servicioIds }]
//              foto: imagen (data URL) de la silla real del local, o null
//              ocupadaDesde: ISO si está ocupada, null si está libre
//              liberadaEn: ISO de la última vez que se liberó
//              servicioIds: los cortes elegidos al ocuparla (se pueden cambiar al cobrar)
//   historial: [{ id, sillaId, barbero, inicio, fin, clienteId, cliente, cobro }]  cada atención terminada
//              cobro: null (se liberó sin cobrar) |
//                     { servicios: [{ nombre, precio }], productos: [{ id, nombre, precio, cantidad }],
//                       monto, metodo, comisionPct, gratis }
//              metodo: 'efectivo' | 'yape' | 'plin'; gratis: corte de la tarjeta de fidelidad
//   clientes:  [{ id, nombre, telefono, servicioIds, notas, creadoEn }]
//   espera:    [{ id, clienteId, nombre, servicioIds, llegada }]  la cola, en orden
//   citas:     [{ id, fecha, hora, sillaId, clienteId, nombre, telefono, servicioIds, estado }]
//              estado: 'pendiente' | 'atendida' | 'cancelada'
//   productos: [{ id, nombre, precio, stock }]
//   ventas:    [{ id, fecha, items: [{ id, nombre, precio, cantidad }], monto, metodo }]  productos vendidos sueltos
//   gastos:    [{ id, fecha, concepto, monto, metodo }]
//   cierres:   [{ dia, esperado, contado, nota, hora }]  cierre de caja del efectivo
// }

const CLAVE = 'barberia:v1'

export const COLORES = ['#8b1e2d', '#1d1d1f', '#6b3e1f', '#1f4e79', '#2f5d3a', '#c9a227', '#f2ede4']

const CONFIG_INICIAL = { nombre: 'Mi Barbería', comisionPct: 50, fidelidadCada: 6, diasRecordatorio: 21 }

function nuevoId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function sillaNueva(n) {
  return {
    id: nuevoId(),
    nombre: `Silla ${n}`,
    barbero: '',
    color: COLORES[(n - 1) % 3],
    foto: null,
    ocupadaDesde: null,
    liberadaEn: null,
    clienteId: null,
    cliente: '',
    servicioIds: [],
  }
}

// Cortes de partida (pedido del usuario, 2026-10-17: "elegir un
// corte" y cobrar la silla); se cambian en Cortes.
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

const COLECCIONES = ['historial', 'clientes', 'espera', 'citas', 'productos', 'ventas', 'gastos', 'cierres']

// Completa lo que le falte a un estado guardado por una versión anterior.
// Lo que ya está completo se deja tal cual (mismo objeto): así al guardar
// no se reescribe en la nube lo que no cambió.
function completar(e) {
  const config = e.config && Object.keys(CONFIG_INICIAL).every((k) => k in e.config) ? e.config : { ...CONFIG_INICIAL, ...e.config }
  const completo = { ...e, config, servicios: e.servicios ?? serviciosIniciales() }
  for (const c of COLECCIONES) if (!completo[c]) completo[c] = []
  return completo
}

function inicial(nombre) {
  return completar({ config: { ...CONFIG_INICIAL, nombre: nombre || CONFIG_INICIAL.nombre }, servicios: serviciosIniciales(), sillas: [1, 2, 3].map(sillaNueva) })
}

// Lo que había guardado en ESTE equipo antes de la nube (la versión
// sin cuenta): se sube solo la primera vez que el dueño abre su
// barbería, para no perder nada.
function leerLocal() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE))
    if (guardado?.sillas) return completar(guardado)
  } catch (err) {
    console.error('[store] leer local', err)
  }
  return null
}

// --- Sesión y nube --------------------------------------------------------
// Desde el 2026-10-18 todo vive en Firebase (proyecto "barberia"), con
// varias barberías (multitenant, copiado de las líneas de
// control-de-autos). El enlace (lo que va después del #) dice cómo se
// entra:
//   #/                con cuenta: Luis (la plataforma, crea las
//                     barberías) o el dueño de una barbería (su panel)
//   #/barbero/{id}    sin cuenta: los barberos ocupan y cobran sillas
//   #/pantalla/{id}   sin cuenta: el televisor del local, solo para ver
// `estado` es null mientras no llegó la barbería.

export function leerRuta() {
  const partes = (typeof location !== 'undefined' ? location.hash : '').replace(/^#\/?/, '').split('/').filter(Boolean)
  if ((partes[0] === 'barbero' || partes[0] === 'pantalla') && partes[1]) return { modo: partes[0], id: decodeURIComponent(partes[1]) }
  return { modo: 'panel', id: null }
}

const RUTA = leerRuta()
let estado = null
// rol: 'super' (Luis) | 'dueno' | 'barbero' | 'pantalla'
let sesion = { modo: RUTA.modo, cargando: true, usuario: null, rol: null, barberiaId: RUTA.id, listo: false, error: null, migrado: false }
let barberiaId = null
let dejarDeEscuchar = null
const oyentes = new Set()
const avisar = () => oyentes.forEach((fn) => fn())

function fijar(nuevo) {
  const antes = estado
  estado = nuevo
  avisar()
  if (!barberiaId) return
  guardarCambios(barberiaId, antes, nuevo).catch((err) => {
    console.error('[store] guardar en la nube', err)
    alert(`No se pudo guardar: ${err.message}`)
  })
}

// Se conecta a una barbería. `completa`: el dueño ve todo (clientes,
// caja...); los barberos y el televisor, solo las sillas y la espera.
// `inicializar`: si la barbería todavía no tiene sus datos (recién
// creada por la plataforma), el dueño la arranca con 3 sillas y los
// cortes de ejemplo, o con lo que tenía en este equipo.
function conectar(id, { completa, inicializar }) {
  barberiaId = id
  let armado = {}
  dejarDeEscuchar = escucharBarberia(
    id,
    (parcial) => {
      if (!sesion.listo) {
        armado = { ...armado, ...parcial }
        return
      }
      estado = completar({ ...estado, ...parcial })
      avisar()
    },
    (existe) => {
      if (existe && armado.sillas) {
        sesion = { ...sesion, cargando: false, listo: true }
        estado = completar(armado)
        avisar()
      } else if (inicializar) {
        const local = leerLocal()
        sesion = { ...sesion, cargando: false, listo: true, migrado: Boolean(local) }
        const nombre = armado.nombreBarberia
        fijar(local ? { ...local, config: { ...local.config, nombre: nombre || local.config.nombre } } : inicial(nombre))
      } else {
        sesion = { ...sesion, cargando: false, error: 'Esta barbería no existe, o su dueño todavía no la abrió.' }
        avisar()
      }
    },
    (err) => {
      console.error('[store] escuchar', err)
      sesion = { ...sesion, cargando: false, error: err.code === 'permission-denied' ? 'No tienes permiso para ver esta barbería.' : err.message }
      avisar()
    },
    completa ? undefined : []
  )
}

if (RUTA.modo !== 'panel') {
  // Barberos y televisor: sin cuenta, directo a la barbería del enlace.
  sesion = { ...sesion, rol: RUTA.modo }
  conectar(RUTA.id, { completa: false, inicializar: false })
} else {
  onAuthStateChanged(auth, async (usuario) => {
    dejarDeEscuchar?.()
    dejarDeEscuchar = null
    estado = null
    barberiaId = null
    sesion = { ...sesion, cargando: Boolean(usuario), usuario, rol: null, barberiaId: null, listo: false, error: null, migrado: false }
    avisar()
    if (!usuario) return
    if (usuario.uid === SUPER_UID) {
      sesion = { ...sesion, cargando: false, rol: 'super', listo: true }
      avisar()
      return
    }
    try {
      const perfil = await obtenerPerfil(usuario.uid)
      if (perfil?.role !== 'barberia' || !perfil.barberiaId) throw new Error('Esta cuenta no tiene una barbería. Pídele a quien te dio el acceso que la revise.')
      sesion = { ...sesion, rol: 'dueno', barberiaId: perfil.barberiaId }
      conectar(perfil.barberiaId, { completa: true, inicializar: true })
    } catch (err) {
      sesion = { ...sesion, cargando: false, error: err.message }
      avisar()
    }
  })
}

function suscribir(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

export function useEstado() {
  return useSyncExternalStore(suscribir, () => estado)
}

export function useSesion() {
  return useSyncExternalStore(suscribir, () => sesion)
}

const MENSAJES_AUTH = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'Ese correo no es válido.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Entra con tu contraseña.',
  'auth/weak-password': 'La contraseña tiene que tener al menos 6 letras o números.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento y vuelve a probar.',
  'auth/network-request-failed': 'Sin internet. Revisa la conexión.',
  'auth/configuration-not-found': 'Falta activar el inicio de sesión con correo en Firebase.',
  'auth/operation-not-allowed': 'Falta activar el inicio de sesión con correo en Firebase.',
}

function traducir(err) {
  return new Error(MENSAJES_AUTH[err.code] || err.message)
}

export async function entrar(correo, clave) {
  try {
    await signInWithEmailAndPassword(auth, correo.trim(), clave)
  } catch (err) {
    throw traducir(err)
  }
}

export async function recuperarClave(correo) {
  try {
    await sendPasswordResetEmail(auth, correo.trim())
  } catch (err) {
    throw traducir(err)
  }
}

export function salir() {
  return signOut(auth)
}

function cambiarSilla(id, cambios) {
  fijar({ ...estado, sillas: estado.sillas.map((s) => (s.id === id ? { ...s, ...cambios } : s)) })
}

// Agregar, cambiar y quitar en una colección (clientes, citas, gastos...).
function agregarEn(coleccion, item) {
  const nuevo = { id: nuevoId(), ...item }
  fijar({ ...estado, [coleccion]: [...estado[coleccion], nuevo] })
  return nuevo
}

function cambiarEn(coleccion, id, cambios) {
  fijar({ ...estado, [coleccion]: estado[coleccion].map((x) => (x.id === id ? { ...x, ...cambios } : x)) })
}

function quitarDe(coleccion, id) {
  fijar({ ...estado, [coleccion]: estado[coleccion].filter((x) => x.id !== id) })
}

// --- Ocupar y liberar ------------------------------------------------------

// `quien`: { clienteId, nombre } del que se sienta (o vacío).
// `esperaId`: si venía de la cola, sale de la cola.
// `citaId`: si tenía cita, la cita queda atendida.
export function ocuparSilla(id, { servicioIds = [], clienteId = null, nombre = '', esperaId = null, citaId = null } = {}) {
  fijar({
    ...estado,
    sillas: estado.sillas.map((s) =>
      s.id === id ? { ...s, ocupadaDesde: new Date().toISOString(), clienteId, cliente: nombre.trim(), servicioIds } : s
    ),
    espera: esperaId ? estado.espera.filter((x) => x.id !== esperaId) : estado.espera,
    citas: citaId ? estado.citas.map((c) => (c.id === citaId ? { ...c, estado: 'atendida' } : c)) : estado.citas,
  })
}

// `cobro`: ver arriba, o null para liberarla sin cobrar. Queda en el
// historial con el barbero y el % de comisión de ese momento. Los
// productos vendidos en el cobro bajan del stock.
export function liberarSilla(id, cobro = null) {
  const silla = estado.sillas.find((s) => s.id === id)
  if (!silla?.ocupadaDesde) return
  const fin = new Date().toISOString()
  const cobroFinal = cobro ? { productos: [], ...cobro, comisionPct: Number(estado.config.comisionPct) || 0 } : null
  fijar({
    ...estado,
    sillas: estado.sillas.map((s) =>
      s.id === id ? { ...s, ocupadaDesde: null, liberadaEn: fin, clienteId: null, cliente: '', servicioIds: [] } : s
    ),
    productos: descontarStock(estado.productos, cobroFinal?.productos),
    historial: [
      ...estado.historial,
      {
        id: nuevoId(),
        sillaId: id,
        barbero: silla.barbero || '',
        inicio: silla.ocupadaDesde,
        fin,
        clienteId: silla.clienteId || null,
        cliente: silla.cliente || '',
        cobro: cobroFinal,
      },
    ].slice(-5000),
  })
}

function descontarStock(productos, vendidos = []) {
  if (!vendidos?.length) return productos
  return productos.map((p) => {
    const v = vendidos.find((x) => x.id === p.id)
    return v && p.stock != null ? { ...p, stock: Math.max(0, p.stock - v.cantidad) } : p
  })
}

// --- Cola de espera --------------------------------------------------------

export function anotarEnEspera({ clienteId = null, nombre = '', servicioIds = [] }) {
  agregarEn('espera', { clienteId, nombre: nombre.trim() || 'Cliente', servicioIds, llegada: new Date().toISOString() })
}

export function quitarDeEspera(id) {
  quitarDe('espera', id)
}

export function moverEnEspera(id, delta) {
  const i = estado.espera.findIndex((x) => x.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= estado.espera.length) return
  const espera = [...estado.espera]
  ;[espera[i], espera[j]] = [espera[j], espera[i]]
  fijar({ ...estado, espera })
}

// --- Clientes ---------------------------------------------------------------

export function guardarCliente(id, datos) {
  const limpio = { ...datos, nombre: (datos.nombre || '').trim(), telefono: String(datos.telefono || '').replace(/[^\d+]/g, '') }
  if (id) {
    cambiarEn('clientes', id, limpio)
    return estado.clientes.find((c) => c.id === id)
  }
  return agregarEn('clientes', { servicioIds: [], notas: '', ...limpio, creadoEn: new Date().toISOString() })
}

export function eliminarCliente(id) {
  quitarDe('clientes', id)
}

// --- Citas --------------------------------------------------------------------

export function guardarCita(id, datos) {
  if (id) cambiarEn('citas', id, datos)
  else agregarEn('citas', { estado: 'pendiente', ...datos })
}

export function cambiarEstadoCita(id, nuevoEstado) {
  cambiarEn('citas', id, { estado: nuevoEstado })
}

export function eliminarCita(id) {
  quitarDe('citas', id)
}

// --- Cortes y precios -------------------------------------------------------

export function agregarServicio(nombre, precio) {
  agregarEn('servicios', { nombre: nombre.trim(), precio: Number(precio) || 0 })
}

export function guardarServicio(id, datos) {
  cambiarEn('servicios', id, datos)
}

export function eliminarServicio(id) {
  quitarDe('servicios', id)
}

// --- Productos y ventas -----------------------------------------------------

export function guardarProducto(id, datos) {
  const limpio = { ...datos, precio: Number(datos.precio) || 0, stock: datos.stock === '' || datos.stock == null ? null : Math.max(0, Number(datos.stock) || 0) }
  if (id) cambiarEn('productos', id, limpio)
  else agregarEn('productos', limpio)
}

export function eliminarProducto(id) {
  quitarDe('productos', id)
}

// Venta suelta de productos (sin silla).
export function venderProductos(items, metodo) {
  const monto = items.reduce((t, x) => t + x.precio * x.cantidad, 0)
  fijar({
    ...estado,
    productos: descontarStock(estado.productos, items),
    ventas: [...estado.ventas, { id: nuevoId(), fecha: new Date().toISOString(), items, monto, metodo }],
  })
}

export function anularVenta(id) {
  const venta = estado.ventas.find((v) => v.id === id)
  if (!venta) return
  fijar({
    ...estado,
    // el stock vuelve
    productos: estado.productos.map((p) => {
      const v = venta.items.find((x) => x.id === p.id)
      return v && p.stock != null ? { ...p, stock: p.stock + v.cantidad } : p
    }),
    ventas: estado.ventas.filter((v) => v.id !== id),
  })
}

// --- Gastos y cierre de caja --------------------------------------------------

export function agregarGasto({ concepto, monto, metodo, fecha }) {
  agregarEn('gastos', { concepto: concepto.trim(), monto: Number(monto) || 0, metodo, fecha: fecha || new Date().toISOString() })
}

export function eliminarGasto(id) {
  quitarDe('gastos', id)
}

export function cerrarCaja({ dia, esperado, contado, nota }) {
  fijar({
    ...estado,
    cierres: [...estado.cierres.filter((c) => c.dia !== dia), { dia, esperado, contado: Number(contado) || 0, nota: (nota || '').trim(), hora: new Date().toISOString() }],
  })
}

export function reabrirCaja(dia) {
  fijar({ ...estado, cierres: estado.cierres.filter((c) => c.dia !== dia) })
}

// --- Sillas del local -------------------------------------------------------

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
  fijar({ ...estado, historial: [], ventas: [], gastos: [], cierres: [] })
}

// --- Copia de seguridad -------------------------------------------------------

export function exportarCopia() {
  return JSON.stringify({ app: 'barberia', version: 1, exportadoEn: new Date().toISOString(), datos: estado }, null, 2)
}

export function importarCopia(texto) {
  const copia = JSON.parse(texto)
  if (copia?.app !== 'barberia' || !copia.datos?.sillas) throw new Error('Ese archivo no es una copia de esta app.')
  fijar(completar(copia.datos))
}

export function pesoGuardado() {
  return estado ? JSON.stringify(estado).length : 0
}

// --- Deshacer -----------------------------------------------------------------
// La pantalla ofrece "Deshacer" unos segundos después de ocupar o
// liberar, por si se tocó la silla equivocada.
export function obtenerEstado() {
  return estado
}

export function restaurar(anterior) {
  fijar(anterior)
}
