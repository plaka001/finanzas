import { NavLink, useNavigate } from 'react-router-dom'
import { Home, ListOrdered, Plus, Landmark, Target } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/movimientos', label: 'Movimientos', icon: ListOrdered },
  { to: '/deudas', label: 'Deudas', icon: Landmark },
  { to: '/metas', label: 'Metas', icon: Target },
]

export default function BottomNav() {
  const navigate = useNavigate()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/90 backdrop-blur-lg pb-safe dark:border-zinc-800 dark:bg-surface/90">
      <div className="mx-auto grid max-w-md grid-cols-5 items-center">
        {tabs.slice(0, 2).map((tab) => (
          <Tab key={tab.to} {...tab} />
        ))}
        <div className="flex justify-center">
          <button
            type="button"
            aria-label="Registrar movimiento"
            onClick={() => navigate('/agregar')}
            className="-mt-5 flex size-14 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/25 transition active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2.5} />
          </button>
        </div>
        {tabs.slice(2).map((tab) => (
          <Tab key={tab.to} {...tab} />
        ))}
      </div>
    </nav>
  )
}

function Tab({ to, label, icon: Icon }: (typeof tabs)[number]) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
          isActive ? 'text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'
        }`
      }
    >
      <Icon className="size-5" />
      {label}
    </NavLink>
  )
}
