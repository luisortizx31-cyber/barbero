import { useEffect } from 'react'

// Ventana que sube desde abajo (en el celular) o aparece al centro (en
// una pantalla grande). Se cierra con la ✕, tocando afuera o con Esc.
export function Hoja({ titulo, subtitulo, onCerrar, children }) {
  useEffect(() => {
    const alTeclear = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92svh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-linea bg-panel shadow-2xl sm:rounded-3xl"
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-linea bg-panel px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold">{titulo}</h2>
            {subtitulo && <p className="text-sm text-tinta-suave">{subtitulo}</p>}
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="px-1 text-2xl leading-none text-tinta-suave">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
