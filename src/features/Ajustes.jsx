import { useRef, useState } from 'react'
import { useEstado, useSesion, guardarConfig, exportarCopia, importarCopia, pesoGuardado, salir } from '../data/store'
import { claveDia } from '../domain/hora'
import { enlaces } from '../data/plataforma'
import { HORARIO_INICIAL, NOMBRES_DIAS } from '../domain/horario'

// Ajustes del local: nombre, comisión de los barberos, tarjeta de
// fidelidad, cuándo recordar a los clientes, y la copia de seguridad
// (todo vive en este equipo: si se pierde el celular, con la copia se
// recupera).
export default function Ajustes() {
  const { config, clientes, historial } = useEstado()
  const { usuario, barberiaId } = useSesion()
  const e = enlaces(barberiaId)
  const [datos, setDatos] = useState({ ...config })
  const [horario, setHorario] = useState(() => ({ ...HORARIO_INICIAL, ...config.horario }))
  const cambiarDia = (d, cambios) => {
    setHorario((h) => ({ ...h, [d]: { ...h[d], ...cambios } }))
    setAviso(null)
  }
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
      horario,
      toleranciaCita: Math.min(120, Math.max(0, Math.round(Number(datos.toleranciaCita ?? 15)))),
      citasWeb: datos.citasWeb !== false,
      colaWeb: datos.colaWeb !== false,
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

        <Bloque titulo="🕘 Horario de atención">
          <p className="text-xs text-tinta-suave">Sale en la página de clientes ("Abierto · cierra 9:00 p. m.") y solo se pueden reservar citas en estas horas.</p>
          <ul className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <li key={d} className="flex items-center gap-2">
                <label className="flex w-28 shrink-0 items-center gap-2 text-sm">
                  <input type="checkbox" checked={horario[d].abierto} onChange={(e) => cambiarDia(d, { abierto: e.target.checked })} className="h-4 w-4" />
                  <span className={horario[d].abierto ? 'font-bold' : 'text-tinta-suave'}>{NOMBRES_DIAS[d]}</span>
                </label>
                {horario[d].abierto ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1">
                    <input type="time" value={horario[d].desde} onChange={(e) => cambiarDia(d, { desde: e.target.value })} aria-label={`${NOMBRES_DIAS[d]} desde`} className="min-w-0 flex-1 rounded-lg border border-linea bg-fondo px-2 py-1.5 text-sm text-tinta" />
                    <span className="text-tinta-suave">a</span>
                    <input type="time" value={horario[d].hasta} onChange={(e) => cambiarDia(d, { hasta: e.target.value })} aria-label={`${NOMBRES_DIAS[d]} hasta`} className="min-w-0 flex-1 rounded-lg border border-linea bg-fondo px-2 py-1.5 text-sm text-tinta" />
                  </div>
                ) : (
                  <span className="text-sm text-tinta-suave">Cerrado</span>
                )}
              </li>
            ))}
          </ul>
        </Bloque>

        {/* Qué puede hacer el cliente desde su celular (pedido del usuario,
            2026-10-20). */}
        <Bloque titulo="📱 Página de clientes">
          <p className="text-xs text-tinta-suave">Elige qué pueden hacer tus clientes desde su celular. Lo demás (si hay sitio, los barberos, los precios, su tarjeta) se sigue viendo.</p>
          {[
            ['citasWeb', '📅 Reservar cita', 'Los clientes eligen día y hora para cortarse.'],
            ['colaWeb', '⏳ Anótame (la cola de espera)', 'Los clientes se anotan en la cola de hoy y ven su turno.'],
          ].map(([clave, titulo, ayuda]) => (
            <label key={clave} className="flex items-start gap-3 rounded-xl border border-linea bg-fondo p-3">
              <input
                type="checkbox"
                checked={datos[clave] !== false}
                onChange={(e) => {
                  setDatos((d) => ({ ...d, [clave]: e.target.checked }))
                  setAviso(null)
                }}
                className="mt-0.5 h-5 w-5 shrink-0"
              />
              <span>
                <span className="block font-bold">Mostrar «{titulo}»</span>
                <span className="block text-xs text-tinta-suave">{ayuda}</span>
              </span>
            </label>
          ))}
        </Bloque>

        <Bloque titulo="📅 Citas">
          <Etiqueta texto="Tiempo máximo que se espera al cliente con cita (minutos)">
            <div className="flex items-center gap-2">
              <input type="number" min="0" max="120" step="5" inputMode="numeric" {...campo('toleranciaCita')} className={`${CLASE_INPUT} cifra w-24 text-right`} />
              <span className="text-tinta-suave">min</span>
            </div>
          </Etiqueta>
          <p className="text-xs text-tinta-suave">
            Si el cliente no llega en ese tiempo, su silla deja de estar reservada y su hora queda libre. Se le avisa al reservar y al aceptarle la cita.
          </p>
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

      <Bloque titulo="📱 Cuenta y otros equipos">
        <p className="text-sm">
          Cuenta: <span className="font-bold">{usuario?.email}</span>
        </p>
        <p className="text-sm text-tinta-suave">Mándales estos enlaces. No necesitan contraseña y todos ven las mismas sillas al instante.</p>
        <Enlace titulo="✂ Para tus barberos (ocupan y cobran sillas)" url={e.barbero} />
        <Enlace titulo="📺 Para el televisor del local (solo ver)" url={e.pantalla} />
        <Enlace titulo="👥 Para tus clientes (ven si hay sitio y quién corta)" url={e.local} />
        <p className="text-xs text-tinta-suave">Los barberos no ven la caja, los clientes ni las citas: eso es solo para ti, con tu correo.</p>
        <button
          type="button"
          onClick={() => confirm('¿Salir de la cuenta en este equipo? Los datos quedan guardados en la nube.') && salir()}
          className="rounded-xl border border-linea px-4 py-2.5 font-bold text-tinta-suave"
        >
          Salir de la cuenta
        </button>
      </Bloque>

      <Bloque titulo="💾 Copia de seguridad">
        <p className="text-sm text-tinta-suave">
          Todo se guarda en la nube ({clientes.length} clientes, {historial.length} atenciones, {kb} KB). Igual conviene bajar una copia de vez en cuando y guardarla en tu WhatsApp, correo o Drive, por si algún día se borra algo por error.
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

function Enlace({ titulo, url }) {
  const [copiado, setCopiado] = useState(false)
  const compartir = `https://wa.me/?text=${encodeURIComponent(url)}`
  return (
    <div className="rounded-xl border border-linea bg-fondo p-3">
      <p className="text-xs font-bold text-tinta-suave">{titulo}</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-laton underline decoration-dotted">
        {url.replace(/^https?:\/\//, '')}
      </a>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() =>
            navigator.clipboard?.writeText(url).then(() => {
              setCopiado(true)
              setTimeout(() => setCopiado(false), 1500)
            })
          }
          className="rounded-lg border border-linea px-3 py-1.5 text-xs font-bold"
        >
          {copiado ? '✓ Copiado' : 'Copiar'}
        </button>
        <a href={compartir} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-libre px-3 py-1.5 text-xs font-bold text-white">
          💬 WhatsApp
        </a>
      </div>
    </div>
  )
}
