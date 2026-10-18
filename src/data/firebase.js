import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

// Proyecto Firebase "barberia" (creado por el usuario el 2026-10-18)
// para que varios celulares y el televisor vean las mismas sillas.
// Esta configuración es pública por diseño (va en el código de toda app
// web de Firebase); lo que protege los datos son las reglas de
// firestore.rules: cada barbería solo lee y escribe lo suyo.
export const firebaseConfig = {
  apiKey: 'AIzaSyC5QRCmEfkdq0ZOP72k1gQRrntYwWESlfQ',
  authDomain: 'barberia-8b2aa.firebaseapp.com',
  projectId: 'barberia-8b2aa',
  storageBucket: 'barberia-8b2aa.firebasestorage.app',
  messagingSenderId: '748625129082',
  appId: '1:748625129082:web:739464892cf9425afe15c3',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Caché en el equipo: la app sigue funcionando sin internet (en el
// local se cae la señal) y sube los cambios cuando vuelve.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
})
