// Salir de la página de una barbería (clientes, barberos o televisor) e
// ir al inicio, para entrar a otra o con una cuenta (pedido del usuario,
// 2026-10-20). Hace falta sobre todo en la app instalada, que vuelve
// sola a la última página abierta (ver index.html): se olvida esa página.
export function irAlInicio() {
  try {
    localStorage.setItem('barberia:ruta', '#/')
  } catch {
    // sin localStorage, igual se va al inicio
  }
  // La app lee la dirección al arrancar: se recarga en el inicio.
  location.replace(location.pathname + location.search)
}
