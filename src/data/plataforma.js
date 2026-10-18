import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db, firebaseConfig } from './firebase'

// La plataforma: Luis da de alta las barberías (multitenant, mismo
// patrón que las líneas de control-de-autos y los colegios de
// campeonato-web). Cada barbería tiene:
//   barberias/{slug}          nombre, dueño, celular, correo + sus datos (ver nube.js)
//   barberias_privado/{slug}  correo y clave, para volver a dárselos al dueño
//   usuarios/{uid}            { role: 'barberia', barberiaId } - la cuenta del dueño
//
// La cuenta de Luis es UNA sola, fija por su uid (también en
// firestore.rules), igual que la empresa en control-de-autos: así nadie
// que se cree una cuenta por su lado pasa por plataforma.
export const SUPER_UID = 'hReh0hAPwCOBqVi9mC81Okx8FiR2'

export function generarSlug(nombre) {
  return (nombre || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function obtenerPerfil(uid) {
  const snap = await getDoc(doc(db, 'usuarios', uid))
  return snap.exists() ? snap.data() : null
}

export async function listarBarberias() {
  const snap = await getDocs(collection(db, 'barberias'))
  return snap.docs
    .map((d) => {
      const x = d.data()
      return {
        id: d.id,
        nombre: x.nombre || x.config?.nombre || d.id,
        dueno: x.dueno || '',
        telefono: x.telefono || '',
        correo: x.correo || '',
        sillas: x.sillas?.length ?? 0,
        ocupadas: x.sillas?.filter((s) => s.ocupadaDesde).length ?? 0,
        abierta: Boolean(x.sillas),
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export async function obtenerPrivado(slug) {
  const snap = await getDoc(doc(db, 'barberias_privado', slug))
  return snap.exists() ? snap.data() : null
}

// Alta de una barbería: cuenta real de Firebase Auth para el dueño.
// createUserWithEmailAndPassword deja logueada la cuenta nueva en la
// instancia de Auth que se use - con la principal, Luis quedaría
// deslogueado. Por eso se usa una segunda instancia de la app solo para
// este alta y se descarta al terminar (igual que registrarLinea en
// control-de-autos).
export async function crearBarberia({ nombre, dueno, telefono, correo, clave }) {
  if (!nombre?.trim()) throw new Error('Ponle nombre a la barbería.')
  const slug = generarSlug(nombre)
  if (!slug) throw new Error('Ese nombre no sirve para el enlace. Prueba con letras o números.')
  if ((await getDoc(doc(db, 'barberias', slug))).exists()) throw new Error(`Ya hay una barbería con un nombre parecido ("${slug}").`)
  if ((clave || '').length < 6) throw new Error('La contraseña tiene que tener al menos 6 letras o números.')

  const secundaria = initializeApp(firebaseConfig, `alta-barberia-${Date.now()}`)
  let uid
  try {
    const cred = await createUserWithEmailAndPassword(getAuth(secundaria), correo.trim(), clave)
    uid = cred.user.uid
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') throw new Error('Ya existe una cuenta con ese correo.', { cause: err })
    if (err.code === 'auth/invalid-email') throw new Error('Ese correo no es válido.', { cause: err })
    throw err
  } finally {
    await deleteApp(secundaria)
  }

  await setDoc(doc(db, 'usuarios', uid), { role: 'barberia', barberiaId: slug })
  await setDoc(doc(db, 'barberias', slug), {
    nombre: nombre.trim(),
    dueno: (dueno || '').trim(),
    telefono: String(telefono || '').replace(/[^\d+]/g, ''),
    correo: correo.trim(),
    uid,
    creadoEn: serverTimestamp(),
  })
  await setDoc(doc(db, 'barberias_privado', slug), { correo: correo.trim(), clave, uid, creadoEn: serverTimestamp() })
  return slug
}

export async function guardarDatosBarberia(slug, { nombre, dueno, telefono }) {
  await setDoc(
    doc(db, 'barberias', slug),
    { nombre: nombre.trim(), dueno: (dueno || '').trim(), telefono: String(telefono || '').replace(/[^\d+]/g, '') },
    { merge: true }
  )
}

// Quita la barbería: su perfil, sus datos privados y su documento. La
// cuenta de Firebase Auth del dueño queda (borrar cuentas de otros
// requiere servidor), pero ya no tiene barbería y no puede entrar a nada.
// Las colecciones (historial, clientes...) quedan huérfanas e
// inaccesibles; si se vuelve a crear con el mismo nombre, vuelven.
export async function eliminarBarberia(slug) {
  const privado = await obtenerPrivado(slug)
  if (privado?.uid) await deleteDoc(doc(db, 'usuarios', privado.uid))
  await deleteDoc(doc(db, 'barberias_privado', slug))
  await deleteDoc(doc(db, 'barberias', slug))
}

export function enlaces(slug) {
  const base = `${location.origin}${location.pathname}`
  return {
    panel: base,
    barbero: `${base}#/barbero/${slug}`,
    pantalla: `${base}#/pantalla/${slug}`,
    local: `${base}#/local/${slug}`,
  }
}
