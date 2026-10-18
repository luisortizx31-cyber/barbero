import { useRef, useState } from 'react'
import { achicarFoto } from '../domain/foto'
import { CropeadorFoto } from './CropeadorFoto'
import { VisorFoto } from './VisorFoto'

// Foto redonda del barbero, o sus iniciales si no subió foto. Con
// \`ampliable\`, tocarla la muestra en grande (pedido del usuario,
// 2026-10-18: que el cliente vea la foto del barbero al tocarlo).
export function FotoBarbero({ barbero, tam = 'h-12 w-12', texto = 'text-base', ampliable = false }) {
  const [grande, setGrande] = useState(false)
  if (barbero?.foto) {
    const img = <img src={barbero.foto} alt={barbero.nombre} className={`${tam} shrink-0 rounded-full border-2 border-laton object-cover`} />
    if (!ampliable) return img
    return (
      <>
        <button type="button" onClick={() => setGrande(true)} aria-label={`Ver la foto de ${barbero.nombre}`} className="shrink-0 rounded-full">
          {img}
        </button>
        {grande && <VisorFoto url={barbero.foto} titulo={`✂ ${barbero.nombre}`} onCerrar={() => setGrande(false)} />}
      </>
    )
  }
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

// Subir la foto del barbero, igual que en control-de-autos: se toma con
// la cámara o se elige de la galería, y antes de guardarla se recorta
// (mover, acercar/alejar con la barra o pellizcando, girar). Se guarda
// achicada a ~260 px (unos 20 KB).
export function SubirFotoBarbero({ foto, onFoto }) {
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
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => camara.current?.click()} className="rounded-xl border border-laton/60 bg-laton-suave px-3 py-2 text-sm font-bold text-laton">
          📷 {foto ? 'Otra foto' : 'Tomarme una foto'}
        </button>
        <button type="button" onClick={() => galeria.current?.click()} className="rounded-xl border border-linea px-3 py-2 text-sm font-bold text-tinta-suave">
          🖼 Galería
        </button>
      </div>
      <input ref={camara} type="file" accept="image/*" capture="user" className="hidden" onChange={elegido} />
      <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={elegido} />
      {archivo && (
        <CropeadorFoto
          archivo={archivo}
          redondo
          onConfirmar={async (recortado) => {
            try {
              onFoto(await achicarFoto(recortado, 260))
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
