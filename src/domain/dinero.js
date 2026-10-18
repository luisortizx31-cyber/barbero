// "S/ 25.00"
export function formatearMonto(valor) {
  return `S/ ${(Number(valor) || 0).toFixed(2)}`
}

export const METODOS = [
  { id: 'efectivo', texto: 'Efectivo', icono: '💵' },
  { id: 'yape', texto: 'Yape', icono: '📱' },
  { id: 'plin', texto: 'Plin', icono: '📲' },
]

export function textoMetodo(id) {
  return METODOS.find((m) => m.id === id)?.texto || id
}
