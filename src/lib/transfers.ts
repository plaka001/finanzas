import { supabase } from './supabase'
import type { Account } from '../types'

export interface TransferInput {
  user_id: string
  from: Account
  to: Account
  amount: number
  date: string
}

/**
 * Transferencia entre cuentas: par de transacciones (salida/entrada) con el
 * mismo transfer_id, excluidas de los totales de ingresos/gastos.
 * Caso especial: si la cuenta destino es una TC vinculada a deuda, se registra
 * como pago de la deuda (debt_payment con la cuenta origen) en vez de entrada.
 */
export async function saveTransfer({ user_id, from, to, amount, date }: TransferInput): Promise<void> {
  if (to.debt_id) {
    const { error } = await supabase.from('debt_payments').insert({
      user_id,
      debt_id: to.debt_id,
      amount,
      kind: 'cuota',
      paid_at: date,
      account_id: from.id,
    })
    if (error) throw error
    return
  }

  const transferId = crypto.randomUUID()
  const { error } = await supabase.from('transactions').insert([
    {
      user_id,
      amount,
      type: 'expense',
      category_id: null,
      note: `Transferencia a ${to.name}`,
      occurred_at: date,
      account_id: from.id,
      transfer_id: transferId,
    },
    {
      user_id,
      amount,
      type: 'income',
      category_id: null,
      note: `Transferencia desde ${from.name}`,
      occurred_at: date,
      account_id: to.id,
      transfer_id: transferId,
    },
  ])
  if (error) throw error
}
