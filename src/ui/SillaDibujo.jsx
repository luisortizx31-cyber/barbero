// Silla de barbero dibujada, del color que elija el local. Si el local
// sube la foto de su silla real, se muestra la foto en vez del dibujo
// (ver SillaImagen).
export function SillaDibujo({ color = '#8b1e2d', className = '' }) {
  const metal = '#b9bec6'
  const metalOscuro = '#7d838d'
  const idBrillo = `brillo-${color.replace(/[^a-z0-9]/gi, '')}`
  return (
    <svg viewBox="0 0 200 220" className={className} role="img" aria-label="Silla de barbero">
      <defs>
        <linearGradient id={idBrillo} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      {/* Base y columna */}
      <ellipse cx="100" cy="206" rx="62" ry="10" fill={metalOscuro} />
      <ellipse cx="100" cy="202" rx="58" ry="8" fill={metal} />
      <rect x="91" y="150" width="18" height="52" rx="4" fill={metal} />
      <rect x="91" y="150" width="6" height="52" fill="#fff" opacity="0.35" />
      {/* Apoyapiés */}
      <rect x="96" y="150" width="8" height="26" fill={metalOscuro} />
      <rect x="64" y="172" width="72" height="9" rx="4" fill={metal} />
      {/* Cabecera */}
      <rect x="96" y="30" width="8" height="14" fill={metal} />
      <rect x="72" y="10" width="56" height="24" rx="10" fill={color} />
      <rect x="72" y="10" width="56" height="24" rx="10" fill={`url(#${idBrillo})`} />
      {/* Respaldo */}
      <rect x="54" y="40" width="92" height="90" rx="16" fill={color} />
      <rect x="54" y="40" width="92" height="90" rx="16" fill={`url(#${idBrillo})`} />
      <g stroke="#000" strokeOpacity="0.22" strokeWidth="2">
        <line x1="77" y1="50" x2="77" y2="122" />
        <line x1="100" y1="50" x2="100" y2="122" />
        <line x1="123" y1="50" x2="123" y2="122" />
      </g>
      {/* Brazos */}
      <rect x="30" y="100" width="34" height="12" rx="6" fill={metal} />
      <rect x="136" y="100" width="34" height="12" rx="6" fill={metal} />
      <rect x="40" y="110" width="8" height="22" fill={metalOscuro} />
      <rect x="152" y="110" width="8" height="22" fill={metalOscuro} />
      {/* Asiento */}
      <rect x="40" y="122" width="120" height="32" rx="12" fill={color} />
      <rect x="40" y="122" width="120" height="32" rx="12" fill={`url(#${idBrillo})`} />
      <rect x="40" y="146" width="120" height="8" rx="4" fill="#000" opacity="0.2" />
    </svg>
  )
}

export function SillaImagen({ silla, className = '' }) {
  if (silla.foto) return <img src={silla.foto} alt={silla.nombre} className={`object-cover ${className}`} />
  return <SillaDibujo color={silla.color} className={className} />
}
