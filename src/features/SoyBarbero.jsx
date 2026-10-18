import { useState } from 'react'
import { useEstado } from '../data/store'
import { FotoBarbero } from '../ui/FotoBarbero'
import { FormBarbero } from './Barberos'

// Enlace de los barberos: la primera vez cada uno elige quién es (o se
// registra con su nombre y su foto). Queda recordado en SU celular, y
// al ocupar una silla la silla muestra su foto y su nombre.
export default function SoyBarbero({ onElegir }) {
  const { barberos, config } = useEstado()
  const [registrando, setRegistrando] = useState(barberos.length === 0)

  return (
    <div className="mx-auto max-w-md space-y-5 p-5">
      <div className="text-center">
        <p className="text-4xl" aria-hidden="true">
          ✂
        </p>
        <h1 className="text-2xl font-extrabold">{config.nombre}</h1>
        <p className="text-sm text-tinta-suave">{registrando ? 'Regístrate con tu nombre y tu foto. Tu foto sale en la silla que ocupes.' : '¿Quién eres?'}</p>
      </div>

      {registrando ? (
        <>
          <FormBarbero onListo={(b) => b && onElegir(b.id)} textoBoton="✓ Registrarme" />
          {barberos.length > 0 && (
            <button type="button" onClick={() => setRegistrando(false)} className="w-full text-center text-sm text-tinta-suave underline decoration-dotted">
              Ya estoy registrado
            </button>
          )}
        </>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3">
            {barberos.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => onElegir(b.id)} className="flex w-full flex-col items-center gap-2 rounded-2xl border border-linea bg-panel p-4 active:scale-[0.98]">
                  <FotoBarbero barbero={b} tam="h-20 w-20" texto="text-2xl" />
                  <span className="w-full truncate text-center font-bold">{b.nombre}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setRegistrando(true)} className="w-full rounded-2xl border border-laton/60 py-3 font-bold text-laton">
            + Soy nuevo: registrarme
          </button>
        </>
      )}
    </div>
  )
}
