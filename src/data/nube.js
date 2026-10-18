import { doc, collection, onSnapshot, writeBatch } from 'firebase/firestore'
import { db } from './firebase'

// Cómo se guarda la barbería en Firestore (una por cuenta):
//
//   barberias/{uid}                 config, servicios, sillas, espera
//   barberias/{uid}/historial/{id}  cada atención
//   barberias/{uid}/clientes/{id}   ... y lo mismo para citas, productos,
//                                   ventas, gastos y cierres (id = día)
//
// Lo que cambia a cada rato y tiene que verse al instante en todas las
// pantallas (sillas, cola) va en el documento principal; lo que crece
// sin parar va en colecciones, un documento por cosa.
//
// store.js sigue trabajando con un solo objeto `estado` igual que antes;
// acá se arma ese objeto con lo que llega de la nube, y al guardar se
// escribe solo lo que cambió.

export const CAMPOS_PRINCIPALES = ['config', 'servicios', 'sillas', 'espera']
export const COLECCIONES_NUBE = ['historial', 'clientes', 'citas', 'productos', 'ventas', 'gastos', 'cierres']

// cierres se identifican por el día
const idDe = (coleccion, item) => (coleccion === 'cierres' ? item.dia : item.id)

const ORDEN = {
  historial: (a, b) => a.fin.localeCompare(b.fin),
  ventas: (a, b) => a.fecha.localeCompare(b.fecha),
  gastos: (a, b) => a.fecha.localeCompare(b.fecha),
  clientes: (a, b) => (a.creadoEn || '').localeCompare(b.creadoEn || ''),
  productos: (a, b) => (a.nombre || '').localeCompare(b.nombre || ''),
}

// Escucha la barbería de `uid`. `alCambiar(parcial)` recibe las partes
// que llegaron; `alListo(existe)` se llama una vez, cuando ya llegó todo
// (existe = false si la cuenta todavía no tiene barbería).
export function escucharBarberia(uid, alCambiar, alListo, alError) {
  const raiz = doc(db, 'barberias', uid)
  const pendientes = new Set(['principal', ...COLECCIONES_NUBE])
  let existe = null
  const avisarSiListo = (parte) => {
    if (!pendientes.has(parte)) return
    pendientes.delete(parte)
    if (pendientes.size === 0) alListo(existe)
  }

  const bajas = [
    onSnapshot(
      raiz,
      (snap) => {
        existe = snap.exists()
        if (existe) {
          const d = snap.data()
          alCambiar(Object.fromEntries(CAMPOS_PRINCIPALES.filter((c) => d[c] !== undefined).map((c) => [c, d[c]])))
        }
        avisarSiListo('principal')
      },
      alError
    ),
    ...COLECCIONES_NUBE.map((c) =>
      onSnapshot(
        collection(raiz, c),
        (snap) => {
          const items = snap.docs.map((d) => d.data())
          if (ORDEN[c]) items.sort(ORDEN[c])
          alCambiar({ [c]: items })
          avisarSiListo(c)
        },
        alError
      )
    ),
  ]
  return () => bajas.forEach((b) => b())
}

// Escribe en la nube lo que cambió entre `antes` y `despues` (los dos con
// la forma de `estado`). Se compara por referencia: store.js nunca
// modifica un objeto, siempre crea uno nuevo, así que lo que no cambió
// es el mismo objeto.
export async function guardarCambios(uid, antes, despues) {
  const raiz = doc(db, 'barberias', uid)
  const operaciones = []

  const principal = {}
  for (const c of CAMPOS_PRINCIPALES) if (!antes || antes[c] !== despues[c]) principal[c] = despues[c]
  if (Object.keys(principal).length) operaciones.push((b) => b.set(raiz, principal, { merge: true }))

  for (const c of COLECCIONES_NUBE) {
    const viejos = antes?.[c] ?? []
    const nuevos = despues[c] ?? []
    if (viejos === nuevos) continue
    const porIdViejo = new Map(viejos.map((x) => [idDe(c, x), x]))
    const idsNuevos = new Set()
    for (const x of nuevos) {
      const id = idDe(c, x)
      idsNuevos.add(id)
      if (porIdViejo.get(id) !== x) operaciones.push((b) => b.set(doc(raiz, c, id), x))
    }
    for (const id of porIdViejo.keys()) if (!idsNuevos.has(id)) operaciones.push((b) => b.delete(doc(raiz, c, id)))
  }

  // Firestore acepta hasta 500 operaciones por tanda.
  for (let i = 0; i < operaciones.length; i += 400) {
    const b = writeBatch(db)
    operaciones.slice(i, i + 400).forEach((op) => op(b))
    await b.commit()
  }
}
