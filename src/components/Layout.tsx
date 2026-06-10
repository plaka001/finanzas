import { Outlet } from 'react-router-dom'
import { CloudOff } from 'lucide-react'
import BottomNav from './BottomNav'
import { useOfflineSync } from '../hooks/useOfflineSync'

export default function Layout() {
  const pendingCount = useOfflineSync()

  return (
    <div className="mx-auto min-h-dvh max-w-md pt-safe md:max-w-2xl">
      {pendingCount > 0 && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400">
          <CloudOff className="size-4 shrink-0" />
          {pendingCount === 1
            ? '1 movimiento pendiente de sincronizar'
            : `${pendingCount} movimientos pendientes de sincronizar`}
        </div>
      )}
      <main className="px-4 pb-28 pt-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
