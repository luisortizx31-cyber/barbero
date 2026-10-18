import { useState } from 'react'
import { entrar, recuperarClave } from '../data/store'

// Entrar con la cuenta: el dueño de una barbería (la cuenta se la da
// la plataforma, no hay "crear cuenta") o Luis (la plataforma). Los
// barberos y el televisor no pasan por acá: entran con su enlace.
export default function Entrar() {
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
      await entrar(correo, clave)
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
        Entra con la cuenta de tu barbería.
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
          autoComplete="current-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          placeholder="Contraseña"
          required
          minLength={6}
          className="w-full rounded-xl border border-linea bg-panel px-4 py-3 text-tinta outline-none focus-visible:border-laton"
        />
        {error && <p className="rounded-xl bg-ocupada-suave px-3 py-2 text-sm text-ocupada">{error}</p>}
        {aviso && <p className="rounded-xl bg-libre-suave px-3 py-2 text-sm text-libre">{aviso}</p>}
        <button type="submit" disabled={ocupado} className="w-full rounded-xl bg-laton py-3.5 text-base font-extrabold text-fondo disabled:opacity-50">
          {ocupado ? 'Un momento…' : 'Entrar'}
        </button>
      </form>

      <div className="mt-5 space-y-3 text-center text-sm">
        <button type="button" onClick={olvide} className="block w-full text-tinta-suave underline decoration-dotted">
          Olvidé mi contraseña
        </button>
      </div>
    </div>
  )
}
