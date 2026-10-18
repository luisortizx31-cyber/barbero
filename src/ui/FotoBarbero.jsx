import { useRef, useState } from 'react'
import { achicarFoto } from '../domain/foto'

// Foto redonda del barbero, o sus iniciales si no subió foto.
export function FotoBarbero({ barbero, tam = 'h-12 w-12', texto = 'text-base' }) {
  if (barbero?.foto) return <img src={barbero.foto} alt={barbero.nombre} className={`${tam} shrink-0 rounded-full border-2 border-laton object-cover`} />
  const iniciales = (barbero?.nombre || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
  return (
    <span className={`${tam} ${texto} flex shrink-0 items-center justify-center rounded-full border-2 border-laton/60 bg-laton-suave font-extrabold text-laton`} aria-label={barbero?.nombre}>
      {iniciales}
    </span>
  )
}

// Botón para sacarse o elegir la foto: se achica a ~260 px (unos 20 KB)
// antes de guardarla.
export function SubirFotoBarbero({ foto, onFoto, texto = '📷 Foto' }) {
  const ref = useRef(null)
  const [cargando, setCargando] = useState(false)
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} disabled={cargando} className="rounded-xl border border-laton/60 bg-laton-suave px-3 py-2 text-sm font-bold text-laton disabled:opacity-50">
        {cargando ? 'Cargando…' : foto ? '📷 Cambiar foto' : texto}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={async (e) => {
          const archivo = e.target.files?.[0]
          e.target.value = ''
          if (!archivo) return
          setCargando(true)
          try {
            onFoto(await achicarFoto(archivo, 260))
          } catch (err) {
            alert(err.message)
          } finally {
            setCargando(false)
          }
        }}
      />
    </>
  )
}
