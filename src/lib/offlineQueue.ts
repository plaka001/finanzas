import { supabase } from './supabase'
import type { CategoryType } from '../types'

/** Movimiento pendiente de sincronizar (guardado offline en IndexedDB). */
export interface PendingTransaction {
  local_id: string
  user_id: string
  amount: number
  type: CategoryType
  category_id: string | null
  note: string | null
  occurred_at: string
}

const DB_NAME = 'panorama'
const DB_VERSION = 1
const STORE = 'pending_transactions'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'local_id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        t.oncomplete = () => db.close()
      }),
  )
}

export function enqueuePending(item: PendingTransaction): Promise<unknown> {
  return tx('readwrite', (s) => s.put(item))
}

export function removePending(localId: string): Promise<unknown> {
  return tx('readwrite', (s) => s.delete(localId))
}

export function listPending(): Promise<PendingTransaction[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<PendingTransaction[]>)
}

/**
 * Intenta subir los movimientos pendientes a Supabase.
 * Devuelve cuántos sincronizó. Se detiene al primer fallo de red.
 */
export async function flushPending(): Promise<number> {
  const pending = await listPending()
  let synced = 0
  for (const item of pending) {
    const { local_id, ...row } = item
    const { error } = await supabase.from('transactions').insert(row)
    if (error) break
    await removePending(local_id)
    synced++
  }
  return synced
}
