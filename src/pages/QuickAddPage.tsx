import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'

export default function QuickAddPage() {
  const navigate = useNavigate()
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-safe pt-safe">
      <header className="flex items-center justify-between py-3">
        <h1 className="text-lg font-bold">Registrar</h1>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => navigate(-1)}
          className="rounded-full p-2.5 text-zinc-500 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-card"
        >
          <X className="size-5" />
        </button>
      </header>
      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
        Quick Add con teclado numérico y cola offline — se construye en la Fase 2.
      </p>
    </div>
  )
}
