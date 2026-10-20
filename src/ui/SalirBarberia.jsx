import { irAlInicio } from '../data/inicio'

// Botón para salir de la página de una barbería (ver irAlInicio).
export function BotonSalirBarberia({ className = '' }) {
  return (
    <button
      type="button"
      onClick={() => confirm('¿Salir de esta barbería? Podrás entrar a otra o con tu cuenta.') && irAlInicio()}
      className={`text-xs text-tinta-suave underline decoration-dotted ${className}`}
    >
      ⏏ Salir de esta barbería
    </button>
  )
}
