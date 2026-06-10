import { LogOut, Moon, Sun } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../auth/AuthProvider'
import { useDarkMode } from '../hooks/useDarkMode'

export default function DashboardPage() {
  const { signOut } = useAuth()
  const { dark, toggle } = useDarkMode()
  const monthLabel = format(new Date(), 'MMMM yyyy', { locale: es })

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold capitalize">{monthLabel}</h1>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={toggle}
            aria-label="Cambiar tema"
            className="rounded-full p-2.5 text-zinc-500 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-card"
          >
            {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>
          <button
            type="button"
            onClick={signOut}
            aria-label="Cerrar sesión"
            className="rounded-full p-2.5 text-zinc-500 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-card"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-card">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Excedente del mes</p>
        <p className="tnum mt-1 text-3xl font-bold text-emerald-400">$0</p>
        <p className="mt-2 text-xs text-zinc-500">El dashboard se completa en la Fase 2.</p>
      </section>
    </div>
  )
}
