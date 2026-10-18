import { useRef, useState } from 'react'
import { useEstado, guardarConfig, exportarCopia, importarCopia, pesoGuardado } from '../data/store'
import { claveDia } from '../domain/hora'

// Ajustes del local: nombre, comisión de los barberos, tarjeta de
// fidelidad, cuándo recordar a los clientes, y la copia de seguridad
// (todo vive en este equipo: si se pierde el celular, con la copia se
// recupera).
export default function Ajustes() {
  const { config, clientes, historial } = useEstado()
  const [datos, setDatos] = useState({ ...config })
  const [aviso, setAviso] = useState(null)
  const [error, setError] = useState(null)
  const archivoRef = useRef(null)
  const campo = (nombre) => ({
    value: datos[nombre] ?? '',
    onChange: (e) => {
      setDatos((d) => ({ ...d, [nombre]: e.target.value }))
      setAviso(null)
    },
  })

  function guardar(e) {
    e.preventDefault()
    guardarConfig({
      nombre: (datos.nombre || '').trim() || 'Mi Barbería',
      comisionPct: Math.min(100, Math.max(0, Number(datos.comisionPct) || 0)),
      fidelidadCada: Math.max(0, Math.round(Number(datos.fidelidadCada) || 0)),
      diasRecordatorio: Math.max(1, Math.round(Number(datos.diasRecordatorio) || 21)),
    })
    setAviso('Guardado.')
  }

  function bajarCopia() {
    const url = URL.createObjectURL(new Blob([exportarCopia()], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `barberia-copia-${claveDia()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setAviso('Copia descargada. Guárdala en tu WhatsApp, correo o Drive.')
  }

  async function restaurar(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setError(null)
    if (!confirm('Restaurar una copia REEMPLAZA todo lo que hay ahora en este equipo. ¿Continuar?')) return
    try {
      importarCopia(await archivo.text())
      setAviso('Copia restaurada.')
    } catch (err) {
      setError(err instanceof SyntaxError ? 'Ese archivo no se puede leer.' : err.message)
    }
  }

  const kb = Math.round(pesoGuardado() / 1024)
  const cada = Number(datos.fidelidadCada) || 0

  return (
    <div className="space-y-5">
      <form onSubmit={guardar} className="space-y-4">
        <Bloque titulo="Barbería">
          <Etiqueta texto="Nombre de la barbería">
            <input {...campo('nombre')} className={CLASE_INPUT} />
          </Etiqueta>
        </Bloque>

        <Bloque titulo="💈 Comisión de los barberos">
          <Etiqueta texto="% de cada corte que se lleva el barbero">
            <div className="flex items-center gap-2">
              <input type="number" min="0" max="100" inputMode="numeric" {...campo('comisionPct')} className={`${CLASE_INPUT} cifra w-24 text-right`} />
              <span className="text-tinta-suave">%</span>
            </div>
          </Etiqueta>
          <p className="text-xs text-tinta-suave">
            Ej. con 50%: de un corte de S/ 20, S/ 10 son del barbero y S/ 10 del local. Los productos son todos del local. En la Caja sale cuánto pagarle a cada uno.
          </p>
        </Bloque>

        <Bloque titulo="🎁 Tarjeta de fidelidad">
          <Etiqueta texto="Cada cuántos cortes, uno gratis (0 = sin tarjeta)">
            <input type="number" min="0" inputMode="numeric" {...campo('fidelidadCada')} className={`${CLASE_INPUT} cifra w-24 text-right`} />
          </Etiqueta>
          <p className="text-xs text-tinta-suave">
            {cada >= 2 ? `Cuando un cliente frecuente junta ${cada - 1} cortes pagados, el ${cada}º le sale gratis. Al cobrar, la app avisa.` : 'Sin tarjeta de fidelidad.'}
          </p>
        </Bloque>

        <Bloque titulo="🔔 Recordatorio por WhatsApp">
          <Etiqueta texto="Recordar a los clientes que no vienen hace (días)">
            <input type="number" min="1" inputMode="numeric" {...campo('diasRecordatorio')} className={`${CLASE_INPUT} cifra w-24 text-right`} />
          </Etiqueta>
          <p className="text-xs text-tinta-suave">Salen en Clientes → Para recordar, con un botón para mandarles el mensaje.</p>
        </Bloque>

        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-xl bg-laton px-5 py-3 font-bold text-fondo">
            Guardar ajustes
          </button>
          {aviso && <p className="text-sm font-medium text-libre">✓ {aviso}</p>}
        </div>
      </form>

      <Bloque titulo="💾 Copia de seguridad">
        <p className="text-sm text-tinta-suave">
          Todo se guarda en este equipo ({clientes.length} clientes, {historial.length} atenciones, {kb} KB). Baja una copia cada cierto tiempo y guárdala en otro lado (tu WhatsApp, correo, Drive): si se pierde o cambias el celular, con la copia lo recuperas todo.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={bajarCopia} className="rounded-xl bg-laton px-4 py-2.5 font-bold text-fondo">
            ⬇ Bajar copia
          </button>
          <button type="button" onClick={() => archivoRef.current?.click()} className="rounded-xl border border-linea px-4 py-2.5 font-bold text-tinta-suave">
            ⬆ Restaurar una copia
          </button>
          <input ref={archivoRef} type="file" accept="application/json,.json" className="hidden" onChange={restaurar} />
        </div>
        {error && <p className="rounded-lg bg-ocupada-suave px-3 py-2 text-sm text-ocupada">{error}</p>}
      </Bloque>
    </div>
  )
}

const CLASE_INPUT = 'w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton'

function Bloque({ titulo, children }) {
  return (
    <div className="space-y-3 rounded-2xl border border-linea bg-panel p-4">
      <p className="font-extrabold">{titulo}</p>
      {children}
    </div>
  )
}

function Etiqueta({ texto, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-tinta-suave">{texto}</span>
      {children}
    </label>
  )
}
