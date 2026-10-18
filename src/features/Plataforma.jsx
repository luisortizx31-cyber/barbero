import { useEffect, useState } from 'react'
import { salir, useSesion } from '../data/store'
import { listarBarberias, crearBarberia, eliminarBarberia, obtenerPrivado, guardarDatosBarberia, enlaces } from '../data/plataforma'
import { linkWhatsapp } from '../domain/clientes'
import { Hoja } from '../ui/Hoja'

// Panel de la plataforma (solo Luis): las barberías que usan el
// sistema. Se crea cada una con la cuenta de su dueño, y se le pasan sus
// tres enlaces: su panel, el de sus barberos y el del televisor.
export default function Plataforma() {
  const { usuario } = useSesion()
  const [barberias, setBarberias] = useState(null)
  const [error, setError] = useState(null)
  const [abierta, setAbierta] = useState(null) // barbería | 'nueva'

  async function cargar() {
    try {
      setBarberias(await listarBarberias())
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    let vigente = true
    listarBarberias()
      .then((b) => vigente && setBarberias(b))
      .catch((err) => vigente && setError(err.message))
    return () => {
      vigente = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-laton">✂ Plataforma</p>
          <h1 className="text-2xl font-extrabold">Barberías</h1>
          <p className="text-xs text-tinta-suave">{usuario?.email}</p>
        </div>
        <button type="button" onClick={() => salir()} className="rounded-xl border border-linea px-3 py-2 text-sm text-tinta-suave">
          Salir
        </button>
      </div>

      <button type="button" onClick={() => setAbierta('nueva')} className="w-full rounded-2xl bg-laton py-3.5 font-extrabold text-fondo">
        + Nueva barbería
      </button>

      {error && <p className="rounded-xl bg-ocupada-suave px-3 py-2 text-sm text-ocupada">{error}</p>}
      {barberias === null ? (
        <p className="text-center text-tinta-suave">Cargando…</p>
      ) : barberias.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linea p-6 text-center text-tinta-suave">Todavía no hay barberías. Crea la primera.</p>
      ) : (
        <ul className="space-y-2">
          {barberias.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => setAbierta(b)} className="flex w-full items-center gap-3 rounded-2xl border border-linea bg-panel p-4 text-left">
                <span className="text-3xl" aria-hidden="true">
                  💈
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold">{b.nombre}</span>
                  <span className="block truncate text-xs text-tinta-suave">
                    {b.dueno || 'Sin dueño'} · {b.correo}
                  </span>
                  <span className="block text-xs">
                    {b.abierta ? (
                      <>
                        <span className="text-ocupada">{b.ocupadas} ocupadas</span> de {b.sillas} sillas ahora
                      </>
                    ) : (
                      <span className="text-laton">El dueño todavía no entró</span>
                    )}
                  </span>
                </span>
                <span className="text-tinta-suave">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {abierta === 'nueva' && (
        <Hoja titulo="Nueva barbería" onCerrar={() => setAbierta(null)}>
          <NuevaBarberia
            onCreada={async (slug) => {
              await cargar()
              setAbierta({ id: slug, recienCreada: true })
            }}
          />
        </Hoja>
      )}
      {abierta && abierta !== 'nueva' && (
        <Hoja titulo={barberias?.find((b) => b.id === abierta.id)?.nombre || abierta.id} onCerrar={() => setAbierta(null)}>
          <FichaBarberia
            barberia={barberias?.find((b) => b.id === abierta.id) || { id: abierta.id }}
            recienCreada={abierta.recienCreada}
            onCambio={cargar}
            onBorrada={async () => {
              setAbierta(null)
              await cargar()
            }}
          />
        </Hoja>
      )}
    </div>
  )
}

const CLASE_INPUT = 'w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton'

function NuevaBarberia({ onCreada }) {
  const [datos, setDatos] = useState({ nombre: '', dueno: '', telefono: '', correo: '', clave: '' })
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null)
  const campo = (k) => ({ value: datos[k], onChange: (e) => setDatos((d) => ({ ...d, [k]: e.target.value })) })

  async function crear(e) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    try {
      onCreada(await crearBarberia(datos))
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <form onSubmit={crear} className="space-y-3">
      <input {...campo('nombre')} required placeholder="Nombre de la barbería" className={`${CLASE_INPUT} font-bold`} />
      <input {...campo('dueno')} placeholder="Nombre del dueño" className={CLASE_INPUT} />
      <input {...campo('telefono')} type="tel" inputMode="tel" placeholder="Celular del dueño (para mandarle sus datos)" className={CLASE_INPUT} />
      <p className="pt-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">Cuenta del dueño (para entrar a su panel)</p>
      <input {...campo('correo')} type="email" required placeholder="Correo" className={CLASE_INPUT} />
      <input {...campo('clave')} type="text" required minLength={6} placeholder="Contraseña (mínimo 6)" className={`${CLASE_INPUT} cifra`} />
      {error && <p className="rounded-xl bg-ocupada-suave px-3 py-2 text-sm text-ocupada">{error}</p>}
      <button type="submit" disabled={ocupado} className="w-full rounded-2xl bg-laton py-3.5 font-extrabold text-fondo disabled:opacity-50">
        {ocupado ? 'Creando…' : 'Crear barbería'}
      </button>
    </form>
  )
}

function FichaBarberia({ barberia: b, recienCreada, onCambio, onBorrada }) {
  const [privado, setPrivado] = useState(null)
  const [verClave, setVerClave] = useState(false)
  const [editando, setEditando] = useState(false)
  const [datos, setDatos] = useState({ nombre: b.nombre || '', dueno: b.dueno || '', telefono: b.telefono || '' })
  const e = enlaces(b.id)

  useEffect(() => {
    let vigente = true
    obtenerPrivado(b.id).then((p) => vigente && setPrivado(p))
    return () => {
      vigente = false
    }
  }, [b.id])

  const mensaje = [
    `Hola${b.dueno ? ` ${b.dueno.split(' ')[0]}` : ''} 👋, ya está lista tu barbería *${b.nombre}* ✂💈`,
    '',
    `*Tu panel (dueño):* ${e.panel}`,
    privado ? `Correo: ${privado.correo}\nContraseña: ${privado.clave}` : '',
    '',
    `*Para tus barberos* (sin contraseña): ${e.barbero}`,
    `*Para el televisor del local:* ${e.pantalla}`,
  ]
    .filter((x, i, a) => x !== '' || a[i - 1] !== '')
    .join('\n')
  const wa = linkWhatsapp(b.telefono, mensaje)

  return (
    <div className="space-y-4">
      {recienCreada && <p className="rounded-xl bg-libre-suave px-3 py-2 text-sm font-bold text-libre">✓ Barbería creada. Mándale sus datos al dueño.</p>}

      <div className="space-y-2">
        <Enlace titulo="Panel del dueño (con su correo)" url={e.panel} />
        <Enlace titulo="Barberos (sin contraseña)" url={e.barbero} />
        <Enlace titulo="Televisor (solo ver)" url={e.pantalla} />
      </div>

      <div className="rounded-2xl border border-linea bg-fondo p-3 text-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-tinta-suave">Cuenta del dueño</p>
        <p>
          Correo: <span className="font-bold">{privado?.correo || b.correo || '…'}</span>
        </p>
        <p>
          Contraseña:{' '}
          {verClave ? (
            <span className="cifra font-bold">{privado?.clave || '—'}</span>
          ) : (
            <button type="button" onClick={() => setVerClave(true)} className="underline decoration-dotted">
              mostrar
            </button>
          )}
        </p>
      </div>

      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="block w-full rounded-2xl bg-libre py-3.5 text-center font-extrabold text-white">
          💬 Mandarle todo por WhatsApp
        </a>
      ) : (
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(mensaje).then(() => alert('Copiado. Pégalo en WhatsApp.'))}
          className="w-full rounded-2xl bg-libre py-3.5 font-extrabold text-white"
        >
          📋 Copiar los datos para mandárselos
        </button>
      )}

      {editando ? (
        <div className="space-y-2 rounded-2xl border border-linea p-3">
          <input value={datos.nombre} onChange={(ev) => setDatos((d) => ({ ...d, nombre: ev.target.value }))} placeholder="Nombre" className={`${CLASE_INPUT} font-bold`} />
          <input value={datos.dueno} onChange={(ev) => setDatos((d) => ({ ...d, dueno: ev.target.value }))} placeholder="Dueño" className={CLASE_INPUT} />
          <input value={datos.telefono} onChange={(ev) => setDatos((d) => ({ ...d, telefono: ev.target.value }))} placeholder="Celular" className={CLASE_INPUT} />
          <p className="text-xs text-tinta-suave">El enlace no cambia aunque cambie el nombre.</p>
          <button
            type="button"
            onClick={async () => {
              await guardarDatosBarberia(b.id, datos)
              setEditando(false)
              onCambio()
            }}
            className="w-full rounded-xl bg-laton py-2.5 font-bold text-fondo"
          >
            Guardar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setEditando(true)} className="w-full rounded-xl border border-linea py-2.5 text-sm font-bold text-tinta-suave">
          ✎ Editar nombre, dueño o celular
        </button>
      )}

      <button
        type="button"
        onClick={async () => {
          if (!confirm(`¿Quitar la barbería "${b.nombre}"? Su dueño ya no podrá entrar y sus enlaces dejan de funcionar.`)) return
          if (!confirm('¿Seguro? Esto no se puede deshacer desde la app.')) return
          await eliminarBarberia(b.id)
          onBorrada()
        }}
        className="w-full text-center text-sm text-ocupada underline decoration-dotted"
      >
        Quitar barbería
      </button>
    </div>
  )
}

function Enlace({ titulo, url }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-xl border border-linea bg-fondo px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-tinta-suave">{titulo}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-laton underline decoration-dotted">
          {url.replace(/^https?:\/\//, '')}
        </a>
      </div>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard?.writeText(url).then(() => {
            setCopiado(true)
            setTimeout(() => setCopiado(false), 1500)
          })
        }
        className="shrink-0 rounded-lg border border-linea px-2.5 py-1.5 text-xs font-bold"
      >
        {copiado ? '✓' : 'Copiar'}
      </button>
    </div>
  )
}
