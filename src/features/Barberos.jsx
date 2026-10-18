import { useState } from 'react'
import { useEstado, useSesion, registrarBarbero, guardarBarbero, eliminarBarbero } from '../data/store'
import { enlaces } from '../data/plataforma'
import { FotoBarbero, SubirFotoBarbero } from '../ui/FotoBarbero'
import { Hoja } from '../ui/Hoja'

// Los barberos del local (para el dueño): se registran solos desde su
// enlace, o los agrega el dueño acá. Cada uno con su foto, que sale en
// la silla que ocupa.
export default function Barberos() {
  const { barberos, sillas } = useEstado()
  const { barberiaId } = useSesion()
  const [abierto, setAbierto] = useState(null) // barbero | 'nuevo'
  const e = enlaces(barberiaId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">
          ✂ Barberos <span className="text-tinta-suave">({barberos.length})</span>
        </h2>
        <button type="button" onClick={() => setAbierto('nuevo')} className="rounded-xl bg-laton px-4 py-2.5 text-sm font-bold text-fondo">
          + Barbero
        </button>
      </div>
      <p className="text-sm text-tinta-suave">
        También se pueden registrar solos con su foto desde este enlace:{' '}
        <a href={e.barbero} target="_blank" rel="noopener noreferrer" className="break-all text-laton underline decoration-dotted">
          {e.barbero.replace(/^https?:\/\//, '')}
        </a>
      </p>

      {barberos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linea p-6 text-center text-tinta-suave">Todavía no hay barberos registrados.</p>
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-panel">
          {barberos.map((b) => {
            const silla = sillas.find((s) => s.barberoId === b.id && s.ocupadaDesde)
            return (
              <li key={b.id}>
                <button type="button" onClick={() => setAbierto(b)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <FotoBarbero barbero={b} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{b.nombre}</span>
                    <span className="block text-xs text-tinta-suave">
                      {silla ? <span className="text-ocupada">Cortando en {silla.nombre}</span> : 'Libre'}
                      {b.telefono ? ` · ${b.telefono}` : ''}
                    </span>
                  </span>
                  <span className="text-tinta-suave">›</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {abierto && (
        <Hoja titulo={abierto === 'nuevo' ? 'Nuevo barbero' : abierto.nombre} onCerrar={() => setAbierto(null)}>
          <FormBarbero barbero={abierto === 'nuevo' ? null : barberos.find((b) => b.id === abierto.id)} onListo={() => setAbierto(null)} conBorrar />
        </Hoja>
      )}
    </div>
  )
}

// Formulario de barbero: lo usan el dueño y el propio barbero al
// registrarse desde su enlace.
export function FormBarbero({ barbero, onListo, conBorrar, textoBoton = 'Guardar' }) {
  const [nombre, setNombre] = useState(barbero?.nombre || '')
  const [telefono, setTelefono] = useState(barbero?.telefono || '')
  const [foto, setFoto] = useState(barbero?.foto || null)

  function guardar() {
    if (!nombre.trim()) return
    if (barbero) {
      guardarBarbero(barbero.id, { nombre, telefono, foto })
      onListo(barbero)
    } else onListo(registrarBarbero({ nombre, telefono, foto }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <FotoBarbero barbero={{ nombre: nombre || '?', foto }} tam="h-20 w-20" texto="text-2xl" />
        <div className="flex flex-wrap gap-2">
          <SubirFotoBarbero foto={foto} onFoto={setFoto} />
          {foto && (
            <button type="button" onClick={() => setFoto(null)} className="rounded-xl border border-linea px-3 py-2 text-sm text-tinta-suave">
              Quitar
            </button>
          )}
        </div>
      </div>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre (como te conocen los clientes)"
        aria-label="Nombre"
        className="w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 font-bold text-tinta outline-none focus-visible:border-laton"
      />
      <input
        type="tel"
        inputMode="tel"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="Celular (opcional)"
        aria-label="Celular"
        className="cifra w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton"
      />
      <button type="button" onClick={guardar} disabled={!nombre.trim()} className="w-full rounded-2xl bg-laton py-3.5 font-extrabold text-fondo disabled:opacity-40">
        {textoBoton}
      </button>
      {barbero && conBorrar && (
        <button
          type="button"
          onClick={() => {
            if (confirm(`¿Quitar a ${barbero.nombre}? Sus cortes ya cobrados quedan en la caja.`)) {
              eliminarBarbero(barbero.id)
              onListo(null)
            }
          }}
          className="w-full text-center text-sm text-ocupada underline decoration-dotted"
        >
          Quitar barbero
        </button>
      )}
    </div>
  )
}
