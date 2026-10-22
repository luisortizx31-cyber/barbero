// Temas de color (pedido del usuario, 2026-10-22). Los colores de cada
// uno están en index.css (html[data-tema=...]); acá van el nombre y las
// muestras para elegirlo en Ajustes. `muestra`: fondo, tarjeta, color
// principal, texto.
export const TEMAS = [
  { id: 'dia', nombre: 'Día', detalle: 'Claro, crema y dorado', muestra: ['#f6f2ea', '#ffffff', '#8a6516', '#1f1a14'] },
  { id: 'control', nombre: 'Control', detalle: 'Como Control de Autos: papel, verde y dorado', muestra: ['#f7f5f0', '#ffffff', '#1e4d3d', '#14171f'] },
  { id: 'azul', nombre: 'Azul', detalle: 'Claro y sobrio, azul marino', muestra: ['#f3f6fa', '#ffffff', '#1f4e79', '#121a26'] },
  { id: 'vino', nombre: 'Vino', detalle: 'Claro con rojo vino, clásico', muestra: ['#faf5f3', '#ffffff', '#7a1f2b', '#1e1414'] },
  { id: 'grafito', nombre: 'Grafito', detalle: 'Oscuro suave con celeste', muestra: ['#1a1f26', '#232a33', '#6cb4ff', '#eef2f6'] },
  { id: 'noche', nombre: 'Noche', detalle: 'Oscuro con dorado, para el televisor', muestra: ['#14110e', '#201c17', '#c9a227', '#f4efe6'] },
]

export const TEMA_INICIAL = 'noche'

export const temaDe = (id) => TEMAS.find((t) => t.id === id) || TEMAS.find((t) => t.id === TEMA_INICIAL)

const CLAVE = 'barberia:tema'

// Pone el tema en toda la página (y lo recuerda en este equipo, para que
// al abrir no se vea un instante con el de antes: ver index.html).
export function aplicarTema(id) {
  const tema = temaDe(id)
  const html = document.documentElement
  if (tema.id === TEMA_INICIAL) delete html.dataset.tema
  else html.dataset.tema = tema.id
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema.muestra[0])
  try {
    localStorage.setItem(CLAVE, tema.id)
  } catch {
    // sin localStorage, solo no se recuerda
  }
}
