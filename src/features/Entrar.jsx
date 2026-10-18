import { useState } from 'react'
import { entrar, crearCuenta, recuperarClave } from '../data/store'

// Entrar con la cuenta de la barbería. La misma cuenta se usa en todos
// los equipos del local (el celular del dueño, el de cada barbero y el
// televisor), así todos ven las mismas sillas.
export default function Entrar() {
  const [modo, setModo] = useState('entrar') // 'entrar' | 'crear'
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  async function enviar(e) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    setAviso(null)
    try {
      if (modo === 'crear') await crearCuenta(correo, clave)
      else await entrar(correo, clave)
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  async function olvide() {
    if (!correo.trim()) return setError('Escribe tu correo y vuelve a tocar "Olvidé mi contraseña".')
    try {
      await recuperarClave(correo)
      setAviso('Te mandamos un correo para cambiar la contraseña. Revisa también en spam.')
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center p-6">
      <p className="text-center text-5xl" aria-hidden="true">
        💈
      </p>
      <h1 className="mt-2 text-center text-2xl font-extrabold">Barbería</h1>
      <p className="mb-6 text-center text-sm text-tinta-suave">
        {modo === 'crear' ? 'Crea la cuenta de tu barbería.' : 'Entra con la cuenta de tu barbería.'} Usa la misma en todos los celulares y en el televisor del local.
      </p>

      <form onSubmit={enviar} className="space-y-3">
        <input
          type="email"
          autoComplete="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="Correo"
          required
          className="w-full rounded-xl border border-linea bg-panel px-4 py-3 text-tinta outline-none focus-visible:border-laton"
        />
        <input
          type="password"
          autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          placeholder={modo === 'crear' ? 'Contraseña (mínimo 6)' : 'Contraseña'}
          required
          minLength={6}
          className="w-full rounded-xl border border-linea bg-panel px-4 py-3 text-tinta outline-none focus-visible:border-laton"
        />
        {error && <p className="rounded-xl bg-ocupada-suave px-3 py-2 text-sm text-ocupada">{error}</p>}
        {aviso && <p className="rounded-xl bg-libre-suave px-3 py-2 text-sm text-libre">{aviso}</p>}
        <button type="submit" disabled={ocupado} className="w-full rounded-xl bg-laton py-3.5 text-base font-extrabold text-fondo disabled:opacity-50">
          {ocupado ? 'Un momento…' : modo === 'crear' ? 'Crear cuenta' : 'Entrar'}
        </button>
      </form>

      <div className="mt-5 space-y-3 text-center text-sm">
        <button
          type="button"
          onClick={() => {
            setModo(modo === 'crear' ? 'entrar' : 'crear')
            setError(null)
          }}
          className="font-bold text-laton underline decoration-dotted"
        >
          {modo === 'crear' ? 'Ya tengo cuenta: entrar' : 'Es mi primera vez: crear cuenta'}
        </button>
        {modo === 'entrar' && (
          <button type="button" onClick={olvide} className="block w-full text-tinta-suave underline decoration-dotted">
            Olvidé mi contraseña
          </button>
        )}
      </div>
    </div>
  )
}
