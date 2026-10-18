import { useEffect, useState } from 'react'

// "3:45 p. m."
export function formatearHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// "25 min", "1 h 05 min"
export function formatearDuracion(ms) {
  const min = Math.max(0, Math.floor(ms / 60000))
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`
}

// "2026-10-17" en la hora local
export function claveDia(fecha = new Date()) {
  const d = new Date(fecha)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// "sábado, 17 de octubre"
export function formatearDia(clave) {
  const [a, m, d] = clave.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
}

// La hora de ahora, que se refresca sola (para los minutos que lleva
// ocupada cada silla y el reloj de la pantalla).
export function useAhora(cadaMs = 1000) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), cadaMs)
    return () => clearInterval(t)
  }, [cadaMs])
  return ahora
}
