import { useRef, useState } from 'react'
import { useEstado, agregarSilla, guardarSilla, eliminarSilla, moverSilla, guardarConfig, COLORES } from '../data/store'
import { achicarFoto } from '../domain/foto'
import { SillaImagen } from '../ui/SillaDibujo'
import { Aviso } from '../ui/Aviso'
import { useAviso } from '../ui/useAviso'

// Las sillas del local: cuántas hay, su nombre, el barbero que la usa
// y cómo se ven en la pantalla - un dibujo del color de la silla, o la
// FOTO de la silla real del local (pedido del usuario, 2026-10-17).
export default function Sillas() {
  const { config, sillas, barberos } = useEstado()
  const [nombreLocal, setNombreLocal] = useState(config.nombre)
  // "✓ Silla agregada" (pedido del usuario, 2026-10-22); la nueva queda
  // resaltada y se baja hasta ella.
  const { aviso, avisar, resaltado } = useAviso()

  function agregar() {
    const nueva = agregarSilla()
    avisar(`✓ Silla agregada: ${nueva.nombre}`, nueva.id)
    setTimeout(() => document.getElementById(`silla-${nueva.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-linea bg-panel p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-tinta-suave">Nombre de la barbería</span>
          <div className="flex gap-2">
            <input
              value={nombreLocal}
              onChange={(e) => setNombreLocal(e.target.value)}
              className="w-full rounded-xl border border-linea bg-fondo px-3 py-2.5 text-tinta outline-none focus-visible:border-laton"
            />
            <button
              type="button"
              onClick={() => guardarConfig({ nombre: nombreLocal.trim() || 'Mi Barbería' })}
              disabled={nombreLocal.trim() === config.nombre}
              className="shrink-0 rounded-xl bg-laton px-4 font-bold text-fondo disabled:opacity-30"
            >
              Guardar
            </button>
          </div>
        </label>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">
          Sillas del local <span className="text-tinta-suave">({sillas.length})</span>
        </h2>
        <button type="button" onClick={agregar} className="rounded-xl bg-laton px-4 py-2.5 text-sm font-bold text-fondo">
          + Agregar silla
        </button>
      </div>

      <ul className="space-y-3">
        {sillas.map((s, i) => (
          <EditorSilla key={s.id} silla={s} barberos={barberos} primera={i === 0} ultima={i === sillas.length - 1} nueva={s.id === resaltado} />
        ))}
      </ul>
      <Aviso aviso={aviso} />
    </div>
  )
}

function EditorSilla({ silla, barberos, primera, ultima, nueva = false }) {
  const [nombre, setNombre] = useState(silla.nombre)
  const [barbero, setBarbero] = useState(silla.barbero)
  const [subiendo, setSubiendo] = useState(false)
  const archivoRef = useRef(null)
  // Con barberos registrados, el barbero se elige en la lista (se guarda al toque).
  const cambios = nombre.trim() !== silla.nombre || (barberos.length === 0 && barbero.trim() !== silla.barbero)

  async function subirFoto(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setSubiendo(true)
    try {
      guardarSilla(silla.id, { foto: await achicarFoto(archivo) })
    } catch (err) {
      alert(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <li id={`silla-${silla.id}`} className={`rounded-2xl border p-4 transition-colors duration-700 ${nueva ? 'border-libre bg-libre-suave' : 'border-linea bg-panel'}`}>
      <div className="flex gap-4">
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-panel-2">
          <SillaImagen silla={silla} className="h-full w-full p-1" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre de la silla"
            aria-label="Nombre de la silla"
            className="w-full rounded-xl border border-linea bg-fondo px-3 py-2 font-bold text-tinta outline-none focus-visible:border-laton"
          />
          {barberos.length > 0 ? (
            // Con barberos registrados se elige de la lista (sale su foto).
            <select
              value={silla.barberoFijoId || ''}
              onChange={(e) => {
                const b = barberos.find((x) => x.id === e.target.value)
                // El barbero FIJO de la silla (el que corta ahora se elige al ocuparla).
                guardarSilla(silla.id, { barberoFijoId: b?.id || null })
              }}
              aria-label="Barbero de esta silla"
              className="w-full rounded-xl border border-linea bg-fondo px-3 py-2 text-sm text-tinta outline-none focus-visible:border-laton"
            >
              <option value="">Sin barbero fijo</option>
              {barberos.map((b) => (
                <option key={b.id} value={b.id}>
                  ✂ {b.nombre}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={barbero}
              onChange={(e) => setBarbero(e.target.value)}
              placeholder="Barbero (opcional)"
              aria-label="Barbero"
              className="w-full rounded-xl border border-linea bg-fondo px-3 py-2 text-sm text-tinta outline-none focus-visible:border-laton"
            />
          )}
          {cambios && (
            <button
              type="button"
              onClick={() => guardarSilla(silla.id, { nombre: nombre.trim() || silla.nombre, ...(barberos.length === 0 ? { barbero: barbero.trim() } : {}) })}
              className="w-full rounded-xl bg-laton py-2 text-sm font-bold text-fondo"
            >
              Guardar cambios
            </button>
          )}
        </div>
      </div>

      {/* Cómo se ve: foto de la silla real, o el dibujo de un color */}
      <div className="mt-4 rounded-xl bg-fondo p-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-suave">Cómo se ve en la pantalla</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => archivoRef.current?.click()}
            disabled={subiendo}
            className="rounded-xl border border-laton/60 bg-laton-suave px-3 py-2 text-sm font-bold text-laton disabled:opacity-50"
          >
            📷 {subiendo ? 'Cargando…' : silla.foto ? 'Cambiar la foto' : 'Foto de mi silla'}
          </button>
          {silla.foto && (
            <button type="button" onClick={() => guardarSilla(silla.id, { foto: null })} className="rounded-xl border border-linea px-3 py-2 text-sm text-tinta-suave">
              Quitar foto
            </button>
          )}
          <input ref={archivoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={subirFoto} />
        </div>
        {!silla.foto && (
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Color de la silla">
            {COLORES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={silla.color === c}
                aria-label={`Color ${c}`}
                onClick={() => guardarSilla(silla.id, { color: c })}
                className={`h-9 w-9 rounded-full border-2 ${silla.color === c ? 'border-laton ring-2 ring-laton ring-offset-2 ring-offset-fondo' : 'border-linea'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <div className="flex gap-2">
          <button type="button" onClick={() => moverSilla(silla.id, -1)} disabled={primera} className="rounded-lg border border-linea px-3 py-1.5 text-tinta-suave disabled:opacity-30" aria-label="Subir">
            ↑
          </button>
          <button type="button" onClick={() => moverSilla(silla.id, 1)} disabled={ultima} className="rounded-lg border border-linea px-3 py-1.5 text-tinta-suave disabled:opacity-30" aria-label="Bajar">
            ↓
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            if (silla.ocupadaDesde) return alert('Esa silla está ocupada. Libérala primero.')
            if (confirm(`¿Quitar ${silla.nombre}?`)) eliminarSilla(silla.id)
          }}
          className="rounded-lg px-3 py-1.5 text-ocupada"
        >
          Quitar silla
        </button>
      </div>
    </li>
  )
}
