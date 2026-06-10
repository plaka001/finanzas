import { supabase } from './supabase'
import type { CategoryType, Transaction } from '../types'
import { enqueuePending, type PendingTransaction } from './offlineQueue'

export interface NewTransaction {
  user_id: string
  amount: number
  type: CategoryType
  category_id: string | null
  note: string | null
  occurred_at: string
}

export type SaveResult =
  | { status: 'synced'; id: string }
  | { status: 'queued'; localId: string }

/**
 * Guarda un movimiento: directo a Supabase si hay red,
 * a la cola offline (IndexedDB) si no o si falla la red.
 */
export async function saveTransaction(input: NewTransaction): Promise<SaveResult> {
  if (navigator.onLine) {
    const { data, error } = await supabase
      .from('transactions')
      .insert(input)
      .select('id')
      .single()
    if (!error) return { status: 'synced', id: data.id }
  }
  const pending: PendingTransaction = { local_id: crypto.randomUUID(), ...input }
  await enqueuePending(pending)
  return { status: 'queued', localId: pending.local_id }
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

export async function updateTransaction(
  id: string,
  patch: Partial<Pick<Transaction, 'amount' | 'type' | 'category_id' | 'note' | 'occurred_at'>>,
): Promise<void> {
  const { error } = await supabase.from('transactions').update(patch).eq('id', id)
  if (error) throw error
}
