import { useSyncExternalStore } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth'
import { auth } from './firebase'
import { escucharBarberia, guardarCambios, marcarCitaAtendida, COLECCIONES_PUBLICAS } from './nube'
import { nombreCorto } from '../domain/citas'
import { SUPER_UID, obtenerPerfil } from './plataforma'
import { HORARIO_INICIAL, bloquesDe, carrilLibre } from '../domain/horario'
import { digitosCelular, huellaCelular, fidelidad } from '../domain/clientes'
import { claveDia } from '../domain/hora'
import { sillaDelCliente } from '../domain/sillas'

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
//   clientes:  [{ id, nombre, telefono, servicioIds, notas, fotoCorte, creadoEn }]
//              fotoCorte: foto de cómo le gusta su corte (data URL), o null
//   espera:    [{ id, clienteId, nombre, servicioIds, llegada }]  la cola, en orden
//   citas:     [{ id, fecha, hora, sillaId, clienteId, nombre, telefono, servicioIds, estado }]
//              estado: 'pendiente' | 'atendida' | 'cancelada'
//   productos: [{ id, nombre, precio, stock }]
//   ventas:    [{ id, fecha, items: [{ id, nombre, precio, cantidad }], monto, metodo }]  productos vendidos sueltos
//   gastos:    [{ id, fecha, concepto, monto, metodo }]
//   cierres:   [{ dia, esperado, contado, nota, hora }]  cierre de caja del efectivo
// }


export const COLORES = ['#8b1e2d', '#1d1d1f', '#6b3e1f', '#1f4e79', '#2f5d3a', '#c9a227', '#f2ede4']

const CONFIG_INICIAL = { nombre: 'Mi Barbería', comisionPct: 50, fidelidadCada: 6, diasRecordatorio: 21, horario: HORARIO_INICIAL, toleranciaCita: 15 }

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
  ['Corte clásico', 15, 30],
  ['Degradado (fade)', 20, 40],
  ['Corte + barba', 25, 50],
  ['Barba', 10, 20],
  ['Corte de niño', 12, 25],
]

function serviciosIniciales() {
  return SERVICIOS_INICIALES.map(([nombre, precio, duracion]) => ({ id: nuevoId(), nombre, precio, duracion }))
}

const COLECCIONES = ['historial', 'clientes', 'espera', 'citas', 'productos', 'ventas', 'gastos', 'cierres', 'barberos', 'agenda', 'fichas', 'bloqueos']

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

// --- Sesión y nube --------------------------------------------------------
// Desde el 2026-10-18 todo vive en Firebase (proyecto "barberia"), con
// varias barberías (multitenant, copiado de las líneas de
// control-de-autos). El enlace (lo que va después del #) dice cómo se
// entra:
//   #/                con cuenta: Luis (la plataforma, crea las
//                     barberías) o el dueño de una barbería (su panel)
//   #/barbero/{id}    sin cuenta: los barberos ocupan y cobran sillas
//   #/pantalla/{id}   sin cuenta: el televisor del local, solo para ver
//   #/local/{id}      sin cuenta: los clientes, desde su celular, ven qué
//                     sillas están libres y qué barbero está cortando
// `estado` es null mientras no llegó la barbería.

export function leerRuta() {
  const partes = (typeof location !== 'undefined' ? location.hash : '').replace(/^#\/?/, '').split('/').filter(Boolean)
  // #/barbero/{id}/{barberoId}: el enlace personal de un barbero.
  if (['barbero', 'pantalla', 'local'].includes(partes[0]) && partes[1]) return { modo: partes[0], id: decodeURIComponent(partes[1]), yo: partes[2] ? decodeURIComponent(partes[2]) : null }
  return { modo: 'panel', id: null }
}

const RUTA = leerRuta()
let estado = null
// rol: 'super' (Luis) | 'dueno' | 'barbero' | 'pantalla'
let sesion = { modo: RUTA.modo, cargando: true, usuario: null, rol: null, barberiaId: RUTA.id, listo: false, error: null }
let barberiaId = null
let dejarDeEscuchar = null
const oyentes = new Set()
const avisar = () => oyentes.forEach((fn) => fn())

// Devuelve la promesa del guardado. `avisarError: false`: quien llama se
// encarga del error (la reserva de cita, que puede perder la hora).
function fijar(nuevo, { avisarError = true } = {}) {
  const antes = estado
  // El dueño mantiene al día lo público que sale de lo privado.
  estado = sesion.rol === 'dueno' ? derivados(nuevo) : nuevo
  avisar()
  if (!barberiaId) return Promise.resolve()
  return guardarCambios(barberiaId, antes, estado, { publico: sesion.modo !== 'panel' }).catch((err) => {
    console.error('[store] guardar en la nube', err)
    if (!avisarError) throw err
    alert(`No se pudo guardar: ${err.message}`)
  })
}

// Se conecta a una barbería. `completa`: el dueño ve todo (clientes,
// caja...); los barberos y el televisor, solo las sillas y la espera.
// `inicializar`: si la barbería todavía no tiene sus datos (recién
// creada por la plataforma), el dueño la arranca con 3 sillas y los
// cortes de ejemplo.
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
      // Un barbero cobró, o llegó una cita por la web: el dueño pone al día
      // las fichas (visitas, tarjeta) y los bloqueos.
      if (completa) {
        const d = derivados(estado)
        if (d !== estado) fijar(d)
      }
    },
    (existe) => {
      if (existe && armado.sillas) {
        sesion = { ...sesion, cargando: false, listo: true }
        estado = completar(armado)
        avisar()
        // Citas y clientes de antes de que existieran la agenda, los
        // bloqueos y las fichas públicas: el dueño los completa al entrar.
        if (completa && derivados(estado) !== estado) fijar(estado)
      } else if (inicializar) {
        // Barbería recién creada: arranca limpia. (Antes se subía lo que el
        // equipo tenía guardado de cuando todo era local, y una barbería
        // nueva abierta en el celular de Luis se llevó sus pruebas viejas:
        // bug real, 2026-10-18.)
        sesion = { ...sesion, cargando: false, listo: true }
        fijar(inicial(armado.nombreBarberia))
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
    completa ? undefined : COLECCIONES_PUBLICAS
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
    sesion = { ...sesion, cargando: Boolean(usuario), usuario, rol: null, barberiaId: null, listo: false, error: null }
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
// `barberoId`: el barbero que corta (registrado, con su foto); la silla
// pasa a mostrarlo y su nombre queda para la comisión.
// `esperaId`: si venía de la cola, sale de la cola.
// `citaId`: si tenía cita, la cita queda atendida.
export function ocuparSilla(id, { servicioIds = [], clienteId = null, nombre = '', esperaId = null, citaId: citaElegida = null, barberoId } = {}) {
  const barbero = barberoId ? estado.barberos.find((b) => b.id === barberoId) : null
  // Si no se eligió su cita pero el cliente tiene una hoy (aunque ya se
  // haya pasado la tolerancia), es esa: se une sola (bug real,
  // 2026-10-22: lo sentaron en la silla y la cita seguía "Aceptada").
  const citaId = citaElegida || citaDeHoyDe(clienteId)
  // Un barbero no puede estar cortando en dos sillas a la vez (pedido
  // del usuario, 2026-10-18). La ventana de ocupar ya no lo deja elegir;
  // esto es por si dos celulares lo intentan al mismo tiempo.
  const otra = barbero && sillaOcupadaPor(barbero.id, id)
  if (otra) {
    alert(`${barbero.nombre} ya está cortando en ${otra.nombre}. Libérala primero.`)
    return false
  }
  // Ni un cliente en dos sillas (pedido del usuario, 2026-10-20).
  const sentado = sillaDelCliente(estado.sillas, { clienteId, nombre }, id)
  if (sentado) {
    alert(`${nombre || 'Ese cliente'} ya se está cortando en ${sentado.nombre}. Libérala primero.`)
    return false
  }
  const ahora = new Date().toISOString()
  fijar({
    ...estado,
    sillas: estado.sillas.map((s) =>
      s.id === id
        ? {
            ...s,
            ocupadaDesde: ahora,
            clienteId,
            cliente: nombre.trim(),
            servicioIds,
            // Si venía con cita: la silla la recuerda y al cobrar queda en
            // el historial (así la cita muestra lo que se cobró).
            citaId: citaId || null,
            ...(barbero ? { barberoId: barbero.id, barbero: barbero.nombre } : {}),
          }
        : s
    ),
    espera: esperaId ? estado.espera.filter((x) => x.id !== esperaId) : estado.espera,
    // La cita queda atendida, con la silla y el barbero que la atendieron.
    ...(citaId && estado.citas.some((c) => c.id === citaId)
      ? conCitas(estado.citas.map((c) => (c.id === citaId ? { ...c, estado: 'atendida', atendidaEn: ahora, sillaId: id, barberoId: barbero?.id || c.barberoId || null } : c)))
      : {}),
  })
  // Sin cuenta (el enlace de los barberos) las citas no se leen: se marca
  // atendida directo en la nube.
  if (citaId && sesion.rol !== 'dueno' && barberiaId) {
    marcarCitaAtendida(barberiaId, citaId, { sillaId: id, barberoId: barbero?.id || null }).catch((err) => console.error('[store] marcarCitaAtendida', err))
  }
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
      s.id === id
        ? {
            ...s,
            ocupadaDesde: null,
            liberadaEn: fin,
            clienteId: null,
            cliente: '',
            servicioIds: [],
            citaId: null,
            // El que cortó se va de la silla (su nombre ya quedó en el historial).
            barberoId: null,
            ...(s.barberoId ? { barbero: '' } : {}),
          }
        : s
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
        citaId: silla.citaId || null,
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

// La cita de hoy, sin atender, de un cliente (la más temprana), o null.
// El dueño la busca en sus citas; los barberos (sin cuenta), en la agenda.
function citaDeHoyDe(clienteId) {
  if (!clienteId) return null
  const hoy = claveDia()
  const fuente = sesion.rol === 'dueno' ? estado.citas.filter((c) => CITA_ACTIVA.includes(c.estado)) : estado.agenda
  const suyas = fuente.filter((c) => c.fecha === hoy && c.clienteId === clienteId).sort((a, b) => a.hora.localeCompare(b.hora))
  return suyas[0]?.id || null
}

// El cliente de una cita ya estaba sentado en una silla sin su cita
// elegida: se unen (la cita queda atendida en esa silla y al cobrar
// muestra lo cobrado).
export function unirCitaConSilla(citaId, sillaId) {
  const silla = estado.sillas.find((s) => s.id === sillaId)
  if (!silla?.ocupadaDesde) return
  fijar({
    ...estado,
    sillas: estado.sillas.map((s) => (s.id === sillaId ? { ...s, citaId } : s)),
    ...conCitas(
      estado.citas.map((c) => (c.id === citaId ? { ...c, estado: 'atendida', atendidaEn: silla.ocupadaDesde, sillaId, barberoId: silla.barberoId || c.barberoId || null } : c))
    ),
  })
}

// La silla (que no sea `menosId`) donde está cortando ahora este barbero.
export function sillaOcupadaPor(barberoId, menosId = null, sillas = estado?.sillas ?? []) {
  return sillas.find((s) => s.id !== menosId && s.ocupadaDesde && s.barberoId === barberoId) || null
}

// --- Barberos ----------------------------------------------------------------
// Se registran solos desde el enlace de los barberos (nombre, celular y
// foto), o los agrega el dueño. Se ven en cada silla que ocupan.

export function registrarBarbero({ nombre, telefono = '', foto = null }) {
  return agregarEn('barberos', { nombre: nombre.trim(), telefono: String(telefono).replace(/[^\d+]/g, ''), foto, creadoEn: new Date().toISOString() })
}

export function guardarBarbero(id, datos) {
  const limpio = { ...datos }
  if ('nombre' in limpio) limpio.nombre = limpio.nombre.trim()
  if ('telefono' in limpio) limpio.telefono = String(limpio.telefono || '').replace(/[^\d+]/g, '')
  const barbero = estado.barberos.find((b) => b.id === id)
  fijar({
    ...estado,
    barberos: estado.barberos.map((b) => (b.id === id ? { ...b, ...limpio } : b)),
    // Si cambió el nombre, las sillas que tiene lo muestran actualizado.
    sillas: limpio.nombre && barbero && limpio.nombre !== barbero.nombre ? estado.sillas.map((s) => (s.barberoId === id ? { ...s, barbero: limpio.nombre } : s)) : estado.sillas,
  })
}

export function eliminarBarbero(id) {
  fijar({
    ...estado,
    barberos: estado.barberos.filter((b) => b.id !== id),
    sillas: estado.sillas.some((s) => s.barberoId === id || s.barberoFijoId === id)
      ? estado.sillas.map((s) => (s.barberoId === id || s.barberoFijoId === id ? { ...s, barberoId: s.barberoId === id ? null : s.barberoId, barberoFijoId: s.barberoFijoId === id ? null : s.barberoFijoId } : s))
      : estado.sillas,
  })
}

// --- Cola de espera --------------------------------------------------------

// `barberoId`: el barbero que prefiere (o null, cualquiera). `web`: se
// anotó solo desde la página de clientes. Devuelve el anotado (la página
// de clientes lo recuerda para mostrarle su turno).
export function anotarEnEspera({ clienteId = null, nombre = '', servicioIds = [], barberoId = null, web = false }) {
  return agregarEn('espera', { clienteId, nombre: nombre.trim() || 'Cliente', servicioIds, barberoId, web, llegada: new Date().toISOString() })
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

// El cliente nuevo se registra solo desde la página de clientes (pedido
// del usuario, 2026-10-20): queda como cliente (marcado "web") y con su
// ficha pública, para entrar a su cuenta al toque. Si su celular ya está
// registrado, entra con esa ficha en vez de duplicarse. Devuelve la ficha.
export async function registrarClienteWeb({ nombre, telefono }) {
  const huella = huellaCelular(telefono, barberiaId)
  const existente = huella && estado.fichas.find((f) => f.huella === huella && f.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())
  if (existente) return existente
  const cliente = {
    id: nuevoId(),
    nombre: nombre.trim(),
    telefono: String(telefono || '').replace(/[^\d+]/g, ''),
    servicioIds: [],
    notas: '',
    fotoCorte: null,
    origen: 'web',
    creadoEn: new Date().toISOString(),
  }
  const [ficha] = fichasDe([cliente], [], [], estado.config)
  try {
    await fijar({ ...estado, clientes: [...estado.clientes, cliente], fichas: [...estado.fichas, ficha] }, { avisarError: false })
  } catch (err) {
    estado = { ...estado, clientes: estado.clientes.filter((c) => c.id !== cliente.id), fichas: estado.fichas.filter((f) => f.id !== cliente.id) }
    avisar()
    throw new Error(`No se pudo registrar: ${err.message}`, { cause: err })
  }
  return ficha
}

// --- Citas --------------------------------------------------------------------
// Estados: 'pendiente' (pedida, sin aceptar), 'confirmada' (aceptada,
// con su silla), 'atendida', 'cancelada', 'no-llego' (pasó la tolerancia).
// Las dos primeras ocupan su hora en la agenda.
const CITA_ACTIVA = ['pendiente', 'confirmada']

// La agenda es la parte PÚBLICA de las citas (día, hora, duración y
// barbero, sin nombres ni celulares): con ella la página de clientes
// sabe qué horas están libres. Se rehace cada vez que cambian las citas;
// solo las pendientes ocupan lugar. Lo que no cambió queda igual (mismo
// objeto), así no se reescribe en la nube.
function agendaDe(citas, agendaActual = []) {
  const actual = new Map(agendaActual.map((x) => [x.id, x]))
  return citas
    .filter((c) => CITA_ACTIVA.includes(c.estado))
    .map((c) => {
      const nuevo = {
        id: c.id,
        fecha: c.fecha,
        hora: c.hora,
        duracion: Number(c.duracion) || 30,
        barberoId: c.barberoId || null,
        sillaId: c.sillaId || null,
        // Aceptada por la barbería: su silla sale "Reservada" a esa hora.
        confirmada: c.estado === 'confirmada',
        // Para que el televisor y los barberos (sin cuenta) vean de quién
        // es y lo puedan sentar con su cita: nombre corto ("Luis O."), su
        // ficha y sus cortes. Sin celular ni nada más.
        nombre: nombreCorto(c.nombre),
        clienteId: c.clienteId || null,
        servicioIds: c.servicioIds || [],
      }
      const viejo = actual.get(c.id)
      return igualQue(viejo, nuevo) ? viejo : nuevo
    })
}

// Bloqueos: cada cita activa toma un carril (uno por silla) y deja un
// documento por cada bloque de 5 minutos que ocupa en ese carril (ver
// bloquesDe). Sin cuenta solo se pueden crear, no pisar: así, cuando a
// una hora ya están todas las sillas reservadas, nadie más la puede
// tomar, aunque dos personas reserven a la vez. Cada cita conserva el
// carril que ya tenía; las nuevas toman el primero libre.
function bloqueosDe(citas, actuales = [], capacidad = 1) {
  const actual = new Map(actuales.map((x) => [x.id, x]))
  const carrilDe = new Map(actuales.filter((x) => x.carril).map((x) => [x.citaId, x.carril]))
  const activas = citas.filter((c) => CITA_ACTIVA.includes(c.estado)).sort((a, b) => Number(carrilDe.has(b.id)) - Number(carrilDe.has(a.id)))
  const hechos = []
  for (const c of activas) {
    const bloques = bloquesDe(c.fecha, c.hora, c.duracion)
    let k = carrilDe.get(c.id)
    const tomados = new Set(hechos.map((x) => x.id))
    if (!k || bloques.some((b) => tomados.has(`${b}_${k}`))) k = carrilLibre(bloques, hechos, capacidad)
    // Sin carril: el dueño la anotó con todas las sillas tomadas.
    if (!k) continue
    for (const b of bloques) {
      const id = `${b}_${k}`
      const viejo = actual.get(id)
      hechos.push(viejo?.citaId === c.id && viejo.carril === k ? viejo : { id, citaId: c.id, carril: k })
    }
  }
  return hechos
}

// Fichas: lo público de cada cliente, para que se busque en la página de
// clientes, reserve como él mismo y vea cómo va (pedido del usuario,
// 2026-10-20): el nombre, los 3 últimos números del celular, la huella
// del celular (para encontrarse escribiéndolo completo), su corte de
// siempre, cuántas veces vino, su último corte y su tarjeta. El celular
// completo, las notas y lo que gastó no salen.
// Comparar sin importar el orden de las claves (la nube las devuelve en
// otro orden; si no, el dueño reescribiría las fichas sin parar).
const ordenado = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenado(v[k])])) : Array.isArray(v) ? v.map(ordenado) : v)
const igualQue = (a, b) => Boolean(a) && JSON.stringify(ordenado(a)) === JSON.stringify(ordenado(b))

function fichasDe(clientes, historial, citas, config, actuales = []) {
  const actual = new Map(actuales.map((x) => [x.id, x]))
  const visitasDe = new Map()
  for (const h of historial) {
    if (!h.clienteId) continue
    if (!visitasDe.has(h.clienteId)) visitasDe.set(h.clienteId, [])
    visitasDe.get(h.clienteId).push(h)
  }
  const cada = Number(config.fidelidadCada) || 0
  return clientes.map((c) => {
    const visitas = visitasDe.get(c.id) || []
    const hoy = claveDia()
    const tarjeta = fidelidad(visitas, c.id, cada)
    const nuevo = {
      id: c.id,
      nombre: c.nombre,
      fin: digitosCelular(c.telefono).slice(-3),
      huella: huellaCelular(c.telefono, barberiaId),
      servicioIds: c.servicioIds || [],
      visitas: visitas.length,
      // Sus últimos 5 cortes (lo más nuevo primero) y sus próximas citas,
      // para "Mi cuenta" en la página de clientes (pedido del usuario,
      // 2026-10-20).
      ultimos: [...visitas]
        .sort((a, b) => b.fin.localeCompare(a.fin))
        .slice(0, 5)
        .map((h) => ({ fecha: claveDia(h.fin), cortes: h.cobro?.servicios?.map((x) => x.nombre) || [], barbero: h.barbero || '', gratis: Boolean(h.cobro?.gratis) })),
      citas: citas
        .filter((x) => x.clienteId === c.id && CITA_ACTIVA.includes(x.estado) && x.fecha >= hoy)
        .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`))
        .map((x) => ({ id: x.id, fecha: x.fecha, hora: x.hora, confirmada: x.estado === 'confirmada' })),
      tarjeta: tarjeta || null,
    }
    const viejo = actual.get(c.id)
    return igualQue(viejo, nuevo) ? viejo : nuevo
  })
}

const mismaLista = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

// Agenda, bloqueos y fichas rehechos desde las citas y los clientes.
// Si nada cambió, devuelve el mismo objeto.
function derivados(e) {
  const agenda = agendaDe(e.citas, e.agenda)
  const bloqueos = bloqueosDe(e.citas, e.bloqueos, e.sillas.length)
  const fichas = fichasDe(e.clientes, e.historial, e.citas, e.config, e.fichas)
  if (mismaLista(agenda, e.agenda) && mismaLista(bloqueos, e.bloqueos) && mismaLista(fichas, e.fichas)) return e
  return { ...e, agenda, bloqueos, fichas }
}

function conCitas(citas) {
  return { citas, agenda: agendaDe(citas, estado.agenda) }
}

export function guardarCita(id, datos) {
  const citas = id ? estado.citas.map((c) => (c.id === id ? { ...c, ...datos } : c)) : [...estado.citas, { id: nuevoId(), estado: 'pendiente', ...datos }]
  fijar({ ...estado, ...conCitas(citas) })
}

export function cambiarEstadoCita(id, nuevoEstado, extra = {}) {
  fijar({ ...estado, ...conCitas(estado.citas.map((c) => (c.id === id ? { ...c, ...extra, estado: nuevoEstado } : c))) })
}

// Cancelar (o rechazar, si todavía no se había aceptado) con el motivo,
// para que quede anotado y se le pueda avisar al cliente.
export function cancelarCita(id, motivo = '') {
  cambiarEstadoCita(id, 'cancelada', { motivo: motivo.trim(), canceladaEn: new Date().toISOString() })
}

// La barbería acepta la cita y le asigna su silla: desde ese momento la
// silla sale "Reservada" a esa hora (pedido del usuario, 2026-10-18).
export function aceptarCita(id, sillaId) {
  fijar({ ...estado, ...conCitas(estado.citas.map((c) => (c.id === id ? { ...c, estado: 'confirmada', sillaId: sillaId || c.sillaId || null } : c))) })
}

export function eliminarCita(id) {
  fijar({ ...estado, ...conCitas(estado.citas.filter((c) => c.id !== id)) })
}

// Cita reservada por el cliente desde la página de clientes (sin
// cuenta): la cita (privada, con su celular), su lugar en la agenda
// (pública) y los bloqueos de su hora. El dueño la ve en Citas marcada
// "por la web". `clienteId`: si se buscó y eligió como cliente frecuente
// (su celular lo tiene el dueño). Si alguien tomó esa hora un momento
// antes, la nube no deja crear los bloqueos y la reserva falla entera.
export async function reservarCitaWeb({ fecha, hora, duracion, barberoId, servicioIds, nombre, telefono, clienteId = null, carril = 1 }) {
  const cita = {
    id: nuevoId(),
    fecha,
    hora,
    duracion: Number(duracion) || 30,
    barberoId: barberoId || null,
    sillaId: null,
    clienteId,
    nombre: nombre.trim(),
    telefono: String(telefono || '').replace(/[^\d+]/g, ''),
    servicioIds,
    estado: 'pendiente',
    origen: 'web',
    creadaEn: new Date().toISOString(),
  }
  const lugar = { id: cita.id, fecha, hora, duracion: cita.duracion, barberoId: cita.barberoId, sillaId: null, nombre: nombreCorto(cita.nombre), clienteId: cita.clienteId, servicioIds: cita.servicioIds || [] }
  const bloqueos = bloquesDe(fecha, hora, cita.duracion).map((b) => ({ id: `${b}_${carril}`, citaId: cita.id, carril }))
  try {
    await fijar({ ...estado, citas: [...estado.citas, cita], agenda: [...estado.agenda, lugar], bloqueos: [...estado.bloqueos, ...bloqueos] }, { avisarError: false })
  } catch (err) {
    const otra = (x) => x.id !== cita.id && x.citaId !== cita.id
    estado = { ...estado, citas: estado.citas.filter(otra), agenda: estado.agenda.filter(otra), bloqueos: estado.bloqueos.filter(otra) }
    avisar()
    throw new Error(err.code === 'permission-denied' ? 'Esa hora la acaba de tomar otra persona. Elige otra hora.' : `No se pudo reservar: ${err.message}`, { cause: err })
  }
  return cita
}

// --- Cortes y precios -------------------------------------------------------

export function agregarServicio(nombre, precio, duracion = 30, foto = null) {
  return agregarEn('servicios', { nombre: nombre.trim(), precio: Number(precio) || 0, duracion: Math.max(5, Number(duracion) || 30), foto })
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
  else return agregarEn('productos', limpio)
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
  const nueva = sillaNueva(estado.sillas.length + 1)
  fijar({ ...estado, sillas: [...estado.sillas, nueva] })
  return nueva
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
