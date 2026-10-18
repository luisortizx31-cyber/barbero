import { FotoBarbero } from './FotoBarbero'

// Elegir el barbero de preferencia (pedido del usuario, 2026-10-18: "los
// clientes quieren a su barbero de preferencia"), con su foto. null =
// cualquiera, el primero que se desocupe.
export function ElegirBarbero({ barberos, valor, onCambiar, conCualquiera = true }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {conCualquiera && (
        <button
          type="button"
          onClick={() => onCambiar(null)}
          aria-pressed={!valor}
          className={`flex w-20 shrink-0 flex-col items-center gap-1 rounded-2xl border-2 p-2 ${!valor ? 'border-laton bg-laton-suave' : 'border-linea'}`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-panel-2 text-2xl">💈</span>
          <span className="w-full truncate text-center text-xs font-bold">Cualquiera</span>
        </button>
      )}
      {barberos.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => onCambiar(b.id)}
          aria-pressed={valor === b.id}
          className={`flex w-20 shrink-0 flex-col items-center gap-1 rounded-2xl border-2 p-2 ${valor === b.id ? 'border-laton bg-laton-suave' : 'border-linea'}`}
        >
          <FotoBarbero barbero={b} tam="h-12 w-12" texto="text-sm" />
          <span className="w-full truncate text-center text-xs font-bold">{b.nombre.split(' ')[0]}</span>
        </button>
      ))}
    </div>
  )
}
