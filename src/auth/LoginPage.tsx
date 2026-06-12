import { useState, type FormEvent } from 'react'
import { Wallet } from 'lucide-react'
import { useAuth } from './AuthProvider'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const message = await signIn(email, password)
    if (message) setError('Credenciales incorrectas')
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 pb-safe pt-safe">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-3">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-500/15">
            <Wallet className="size-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold">La Caleta</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Rumbo a deuda cero.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-3.5 text-base outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-card"
          />
          <input
            type="password"
            autoComplete="current-password"
            required
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-3.5 text-base outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-card"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-xl bg-emerald-500 py-3.5 text-base font-semibold text-zinc-950 transition active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
