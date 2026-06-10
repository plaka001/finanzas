import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { flushPending, listPending } from '../lib/offlineQueue'

/**
 * Sincroniza la cola offline al montar y al volver la conexión.
 * Devuelve el número de movimientos pendientes de subir.
 */
export function useOfflineSync(): number {
  const queryClient = useQueryClient()

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pending-count'],
    queryFn: async () => (await listPending()).length,
    staleTime: 0,
  })

  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      const synced = await flushPending()
      if (cancelled) return
      if (synced > 0) {
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
        queryClient.invalidateQueries({ queryKey: ['month-summary'] })
      }
      queryClient.invalidateQueries({ queryKey: ['pending-count'] })
    }
    sync()
    window.addEventListener('online', sync)
    return () => {
      cancelled = true
      window.removeEventListener('online', sync)
    }
  }, [queryClient])

  return pendingCount
}
