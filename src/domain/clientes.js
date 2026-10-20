import { claveDia } from './hora'

// Lo que se sabe de cada cliente por sus atenciones: cuántas veces
// vino, la última vez, cuánto gastó, y su tarjeta de fidelidad.

export function visitasDe(historial, clienteId) {
  return historial.filter((h) => h.clienteId === clienteId).sort((a, b) => b.fin.localeCompare(a.fin))
}

export function diasDesde(iso) {
  if (!iso) return null
  const [a, m, d] = claveDia(iso).split('-').map(Number)
  const hoy = new Date()
  return Math.round((new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) - new Date(a, m - 1, d)) / 86400000)
}

// Tarjeta de fidelidad: cada `cada` cortes, uno gratis. Cuentan las
// atenciones cobradas (no las gratis); cada gratis "gasta" cada-1 sellos.
// { sellos, meta, tocaGratis } - sellos de 0 a meta (meta = cada - 1).
export function fidelidad(historial, clienteId, cada) {
  if (!clienteId || !(cada >= 2)) return null
  const meta = cada - 1
  const visitas = historial.filter((h) => h.clienteId === clienteId && h.cobro)
  const pagadas = visitas.filter((h) => !h.cobro.gratis).length
  const gratis = visitas.filter((h) => h.cobro.gratis).length
  const sellos = Math.max(0, pagadas - gratis * meta)
  return { sellos: Math.min(sellos, meta), meta, tocaGratis: sellos >= meta }
}

export function resumenCliente(estado, cliente) {
  const visitas = visitasDe(estado.historial, cliente.id)
  const ultima = visitas[0]?.fin ?? null
  return {
    visitas: visitas.length,
    ultima,
    dias: diasDesde(ultima),
    gastado: visitas.reduce((t, h) => t + (h.cobro?.monto || 0), 0),
    fidelidad: fidelidad(estado.historial, cliente.id, Number(estado.config.fidelidadCada) || 0),
    historial: visitas,
  }
}

// WhatsApp con el mensaje escrito. null si no tiene celular.
export function linkWhatsapp(telefono, mensaje) {
  const d = String(telefono || '').replace(/\D/g, '')
  if (d.length < 9) return null
  const numero = d.length === 9 ? `51${d}` : d
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}

// Los 9 dígitos del celular (sin el 51 de adelante).
export function digitosCelular(telefono) {
  return String(telefono || '').replace(/\D/g, '').slice(-9)
}

// Huella del celular para la ficha pública: así el cliente se encuentra
// escribiendo su número completo sin que el número quede a la vista.
export function huellaCelular(telefono, barberiaId) {
  const d = digitosCelular(telefono)
  if (d.length < 9) return null
  let h = 0x811c9dc5
  for (const ch of `${barberiaId}:${d}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0
  return h.toString(36)
}
