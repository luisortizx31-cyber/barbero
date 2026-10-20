// Toda foto que se sube (barberos, cortes, clientes, sillas) se guarda
// como JPEG de 30 KB como máximo (pedido del usuario, 2026-10-20). Se
// achica a `anchoMaximo` px y se baja la calidad hasta que entre; si ni
// así entra, se achica más.
export const TOPE_FOTO_BYTES = 30 * 1024

export async function achicarFoto(archivo, anchoMaximo = 520) {
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Esa imagen no se puede abrir.'))
      i.src = url
    })
    let lado = Math.min(anchoMaximo, Math.max(img.width, img.height))
    for (;;) {
      const escala = lado / Math.max(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * escala))
      canvas.height = Math.max(1, Math.round(img.height * escala))
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      for (const calidad of [0.8, 0.7, 0.6, 0.5, 0.4]) {
        const datos = canvas.toDataURL('image/jpeg', calidad)
        // El texto que se guarda (data URL) es lo que pesa.
        if (datos.length <= TOPE_FOTO_BYTES || lado <= 80) return datos
      }
      lado = Math.round(lado * 0.8)
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}
