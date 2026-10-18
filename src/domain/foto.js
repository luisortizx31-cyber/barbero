// La foto de la silla real del local se achica antes de guardarla
// (queda en este equipo, donde el espacio es poco): ~500 px y JPEG,
// unos 40-60 KB.
export async function achicarFoto(archivo, anchoMaximo = 520) {
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Esa imagen no se puede abrir.'))
      i.src = url
    })
    const escala = Math.min(1, anchoMaximo / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * escala)
    canvas.height = Math.round(img.height * escala)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.72)
  } finally {
    URL.revokeObjectURL(url)
  }
}
