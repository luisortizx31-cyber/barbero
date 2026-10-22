// El aviso corto de abajo (ver useAviso).
export function Aviso({ aviso }) {
  if (!aviso) return null
  return (
    <div role="status" className="fixed inset-x-0 bottom-24 z-50 mx-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-libre px-4 py-3 text-center text-sm font-bold text-white shadow-2xl">
      {aviso.texto}
    </div>
  )
}
