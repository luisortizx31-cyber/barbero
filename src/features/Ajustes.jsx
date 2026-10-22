import { useRef, useState } from 'react'
import { useEstado, useSesion, guardarConfig, exportarCopia, importarCopia, pesoGuardado, salir } from '../data/store'
import { claveDia } from '../domain/hora'
import { enlaces } from '../data/plataforma'
import { BotonInstalar } from '../ui/Instalar'
import { ElegirHora } from '../ui/ElegirHora'
import { TEMAS, TEMA_INICIAL } from '../domain/temas'
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
      <BotonInstalar />
      <Apariencia config={config} />
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
              <li key={d} className="rounded-xl border border-linea bg-fondo p-2.5">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={horario[d].abierto} onChange={(e) => cambiarDia(d, { abierto: e.target.checked })} className="h-4 w-4" />
                  <span className={horario[d].abierto ? 'font-bold' : 'text-tinta-suave'}>{NOMBRES_DIAS[d]}</span>
                  {!horario[d].abierto && <span className="ml-auto text-xs text-tinta-suave">Cerrado</span>}
                </label>
                {horario[d].abierto && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-xs font-bold text-tinta-suave">Abre</span>
                      <ElegirHora chico value={horario[d].desde} onChange={(h) => cambiarDia(d, { desde: h })} etiqueta={`${NOMBRES_DIAS[d]} abre`} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-xs font-bold text-tinta-suave">Cierra</span>
                      <ElegirHora chico value={horario[d].hasta} onChange={(h) => cambiarDia(d, { hasta: h })} etiqueta={`${NOMBRES_DIAS[d]} cierra`} />
                    </div>
                  </div>
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

// Cómo se ve la barbería (pedido del usuario, 2026-10-22: "los colores
// los veo muy oscuros, que pueda elegirlos, y una opción para que se vea
// como Control de Autos con los íconos"). Se guarda al tocar, sin
// "Guardar", y se ve el cambio al instante. El tema es de toda la
// barbería (panel, televisor, barberos y clientes); el diseño, del panel.
function Apariencia({ config }) {
  const tema = config.tema || TEMA_INICIAL
  const diseno = config.diseno || 'pestanas'
  return (
    <Bloque titulo="🎨 Apariencia">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">Colores</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TEMAS.map((t) => {
            const [fondo, tarjeta, principal, texto] = t.muestra
            const activo = tema === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => guardarConfig({ tema: t.id })}
                aria-pressed={activo}
                className={`overflow-hidden rounded-2xl border-2 text-left transition-transform active:scale-[0.98] ${activo ? 'border-laton ring-2 ring-laton/40' : 'border-linea'}`}
              >
                {/* Miniatura: fondo, una tarjeta y un botón del color principal */}
                <span className="block p-2.5" style={{ background: fondo }}>
                  <span className="block rounded-lg p-2" style={{ background: tarjeta, boxShadow: '0 1px 2px rgb(0 0 0 / 0.12)' }}>
                    <span className="mb-1.5 block h-1.5 w-2/3 rounded-full" style={{ background: texto, opacity: 0.8 }} />
                    <span className="mb-2 flex gap-1">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#2fbf71' }} />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#e5484d' }} />
                    </span>
                    <span className="block h-4 rounded-md" style={{ background: principal }} />
                  </span>
                </span>
                <span className="block bg-panel px-2.5 py-2">
                  <span className="block text-sm font-extrabold">
                    {activo ? '✓ ' : ''}
                    {t.nombre}
                  </span>
                  <span className="block text-[11px] leading-tight text-tinta-suave">{t.detalle}</span>
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-tinta-suave">Se ve igual en tu panel, el televisor, los celulares de los barberos y la página de clientes.</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">Diseño del panel</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'pestanas', nombre: 'Pestañas abajo', detalle: 'Las secciones siempre a mano, abajo' },
            { id: 'iconos', nombre: 'Inicio con íconos', detalle: 'Como Control de Autos: un inicio con íconos grandes' },
          ].map((d) => {
            const activo = diseno === d.id
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => guardarConfig({ diseno: d.id })}
                aria-pressed={activo}
                className={`overflow-hidden rounded-2xl border-2 text-left transition-transform active:scale-[0.98] ${activo ? 'border-laton ring-2 ring-laton/40' : 'border-linea'}`}
              >
                {/* Miniatura del diseño */}
                <span className="flex h-24 flex-col bg-fondo p-2">
                  {d.id === 'iconos' ? (
                    <>
                      <span className="mb-1.5 block h-5 rounded-md bg-laton" />
                      <span className="grid flex-1 grid-cols-3 gap-1">
                        {Array.from({ length: 6 }, (_, i) => (
                          <span key={i} className="rounded border border-linea bg-panel" />
                        ))}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="grid flex-1 grid-cols-2 gap-1">
                        {Array.from({ length: 4 }, (_, i) => (
                          <span key={i} className="rounded border border-linea bg-panel" />
                        ))}
                      </span>
                      <span className="mt-1.5 flex justify-around rounded-md border border-linea bg-panel py-1">
                        {Array.from({ length: 5 }, (_, i) => (
                          <span key={i} className={`h-2 w-2 rounded-full ${i === 0 ? 'bg-laton' : 'bg-linea'}`} />
                        ))}
                      </span>
                    </>
                  )}
                </span>
                <span className="block bg-panel px-2.5 py-2">
                  <span className="block text-sm font-extrabold">
                    {activo ? '✓ ' : ''}
                    {d.nombre}
                  </span>
                  <span className="block text-[11px] leading-tight text-tinta-suave">{d.detalle}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </Bloque>
  )
}

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
