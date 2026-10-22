import { useEffect, useRef, useState } from 'react'

// Aviso corto abajo de la pantalla ("✓ Corte agregado", "✓ Silla
// agregada"...) que se va solo a los 4 segundos, con el id de lo que se
// acaba de agregar o cambiar para resaltarlo en la lista mientras dura
// (pedido del usuario, 2026-10-22).
export function useAviso() {
  const [aviso, setAviso] = useState(null) // { texto, id }
  const temporizador = useRef(null)
  useEffect(() => () => clearTimeout(temporizador.current), [])

  function avisar(texto, id = null) {
    setAviso({ texto, id })
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setAviso(null), 4000)
  }

  return { aviso, avisar, resaltado: aviso?.id ?? null }
}
