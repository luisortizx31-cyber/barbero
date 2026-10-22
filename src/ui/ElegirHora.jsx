// Elegir una hora con a. m. y p. m. (pedido del usuario, 2026-10-22: el
// reloj del navegador salía en 24 horas, "20:01"). Hora de 1 a 12,
// minutos de 00 a 59 y a. m. / p. m. `value` y `onChange` en "HH:MM" de
// 24 horas, como se guarda todo.
const HORAS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTOS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

function partes(valor) {
  const [h, m] = String(valor || '').split(':').map(Number)
  if (Number.isNaN(h)) return { hora: null, minuto: null, pm: false }
  return { hora: h % 12 === 0 ? 12 : h % 12, minuto: String(m || 0).padStart(2, '0'), pm: h >= 12 }
}

function armar(hora, minuto, pm) {
  const h = (hora % 12) + (pm ? 12 : 0)
  return `${String(h).padStart(2, '0')}:${minuto}`
}

const CLASE_SELECT = 'cifra min-w-0 flex-1 appearance-none rounded-xl border border-linea bg-fondo px-2 py-2.5 text-center text-lg font-extrabold text-tinta outline-none focus-visible:border-laton'

export function ElegirHora({ value, onChange, chico = false, etiqueta = 'Hora' }) {
  const { hora, minuto, pm } = partes(value)
  const cambiar = (cambios) => {
    const p = { hora: hora ?? 9, minuto: minuto ?? '00', pm, ...cambios }
    onChange(armar(p.hora, p.minuto, p.pm))
  }
  const clase = chico ? CLASE_SELECT.replace('py-2.5', 'py-1.5').replace('text-lg', 'text-sm') : CLASE_SELECT

  return (
    <div className="flex min-w-0 items-center gap-1.5" role="group" aria-label={etiqueta}>
      <select value={hora ?? ''} onChange={(e) => cambiar({ hora: Number(e.target.value) })} aria-label={`${etiqueta}: hora`} className={clase}>
        {hora == null && <option value="">--</option>}
        {HORAS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="font-extrabold text-tinta-suave">:</span>
      <select value={minuto ?? ''} onChange={(e) => cambiar({ minuto: e.target.value })} aria-label={`${etiqueta}: minutos`} className={clase}>
        {minuto == null && <option value="">--</option>}
        {MINUTOS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <div className="flex shrink-0 overflow-hidden rounded-xl border border-linea">
        {[
          [false, 'a. m.'],
          [true, 'p. m.'],
        ].map(([esPm, texto]) => (
          <button
            key={texto}
            type="button"
            onClick={() => cambiar({ pm: esPm })}
            aria-pressed={pm === esPm && hora != null}
            className={`${chico ? 'px-2 py-1.5 text-[11px]' : 'px-2.5 py-2.5 text-xs'} font-bold ${pm === esPm && hora != null ? 'bg-laton text-fondo' : 'bg-fondo text-tinta-suave'}`}
          >
            {texto}
          </button>
        ))}
      </div>
    </div>
  )
}
