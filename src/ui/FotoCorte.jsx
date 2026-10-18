import { useRef, useState } from 'react'
import { achicarFoto } from '../domain/foto'
import { CropeadorFoto } from './CropeadorFoto'
import { VisorFoto } from './VisorFoto'

// Foto de un corte (pedido del usuario, 2026-10-18: "que los cortes
// también tengan foto para que el cliente pueda elegir qué corte").
// Cuadrada, tocarla la muestra en grande si \`ampliable\`.
export function FotoCorte({ servicio, tam = 'h-14 w-14', ampliable = false, className = '' }) {
  const [grande, setGrande] = useState(false)
  if (!servicio?.foto) {
    return <span className={`${tam} flex shrink-0 items-center justify-center rounded-xl bg-panel-2 text-2xl ${className}`}>✂</span>
  }
  const img = <img src={servicio.foto} alt={servicio.nombre} className={`${tam} shrink-0 rounded-xl object-cover ${className}`} />
  if (!ampliable) return img
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setGrande(true)
        }}
        aria-label={`Ver la foto de ${servicio.nombre}`}
        className="shrink-0"
      >
        {img}
      </button>
      {grande && <VisorFoto url={servicio.foto} titulo={servicio.nombre} onCerrar={() => setGrande(false)} />}
    </>
  )
}

// Subir la foto del corte: cámara o galería, y el mismo recortador que
// la foto del barbero (cuadrado). Se guarda achicada (~300 px, unos 25 KB).
export function SubirFotoCorte({ foto, onFoto }) {
  const camara = useRef(null)
  const galeria = useRef(null)
  const [archivo, setArchivo] = useState(null)

  function elegido(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) setArchivo(f)
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => camara.current?.click()} className="rounded-lg border border-laton/60 bg-laton-suave px-2.5 py-1.5 text-xs font-bold text-laton">
          📷 {foto ? 'Otra foto' : 'Foto'}
        </button>
        <button type="button" onClick={() => galeria.current?.click()} className="rounded-lg border border-linea px-2.5 py-1.5 text-xs font-bold text-tinta-suave">
          🖼 Galería
        </button>
        {foto && (
          <button type="button" onClick={() => onFoto(null)} className="rounded-lg px-2 py-1.5 text-xs text-tinta-suave underline decoration-dotted">
            Quitar
          </button>
        )}
      </div>
      <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={elegido} />
      <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={elegido} />
      {archivo && (
        <CropeadorFoto
          archivo={archivo}
          onConfirmar={async (recortado) => {
            try {
              onFoto(await achicarFoto(recortado, 300))
            } catch (err) {
              alert(err.message)
            } finally {
              setArchivo(null)
            }
          }}
          onCancelar={() => setArchivo(null)}
        />
      )}
    </>
  )
}
