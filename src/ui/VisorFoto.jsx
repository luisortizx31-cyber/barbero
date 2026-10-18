// Visor a pantalla completa para ver una foto en grande (copiado de
// control-de-autos): la foto del barbero, al tocarla en la página de
// clientes. Se cierra tocando el fondo, la X, o Escape.
import { useEffect } from 'react'

export function VisorFoto({ url, titulo, onCerrar }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCerrar])

  // El visor se renderiza dentro del elemento que contiene la foto (una
  // fila clickeable en Vehículos), y un click React burbujea por el
  // arbol de componentes aunque el visor sea position:fixed - sin esto,
  // cerrar la foto tambien disparaba el click de esa fila (abrir el detalle).
  function cerrar(e) {
    e.stopPropagation()
    onCerrar()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-6" onClick={cerrar}>
      <button onClick={cerrar} aria-label="Cerrar" className="absolute right-4 top-4 text-3xl leading-none text-white">
        ×
      </button>
      <div className="flex max-h-full max-w-full flex-col items-center gap-3">
        <img src={url} alt={titulo || ''} onClick={(e) => e.stopPropagation()} className="min-h-0 max-w-full rounded-lg object-contain" />
        {titulo && <p className="shrink-0 text-center text-base font-semibold text-white">{titulo}</p>}
      </div>
    </div>
  )
}
