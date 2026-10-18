import { useEstado } from '../data/store'
import { SECCIONES_MAS } from '../domain/secciones'

// Menú "Más": lo que no se usa a cada rato.

export default function Mas({ onIr }) {
  const { productos } = useEstado()
  const agotados = productos.filter((p) => p.stock != null && p.stock <= 2).length
  return (
    <ul className="space-y-2">
      {SECCIONES_MAS.map((s) => (
        <li key={s.id}>
          <button type="button" onClick={() => onIr(s.id)} className="flex w-full items-center gap-4 rounded-2xl border border-linea bg-panel p-4 text-left active:scale-[0.99]">
            <span className="text-3xl">{s.icono}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold">{s.texto}</span>
              <span className="block text-sm text-tinta-suave">{s.detalle}</span>
            </span>
            {s.id === 'productos' && agotados > 0 && <span className="rounded-full bg-ocupada px-2 py-0.5 text-xs font-bold text-white">{agotados}</span>}
            <span className="text-tinta-suave">›</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
