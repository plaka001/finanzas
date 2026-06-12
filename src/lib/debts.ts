import { supabase } from './supabase'
import type { Debt } from '../types'

export interface DebtInput {
  name: string
  original_amount: number | null
  current_balance: number
  interest_rate_ea: number | null
  monthly_payment: number | null
  payment_day: number | null
  end_date: string | null
  notes: string | null
}

/**
 * Mantiene el recurring_payment mensual vinculado a la deuda:
 * con día de pago lo crea/actualiza (monto null = variable, ej. TC);
 * sin día de pago lo desactiva.
 */
async function syncDebtRecurring(userId: string, debtId: string, input: DebtInput): Promise<void> {
  const { data: existing, error } = await supabase
    .from('recurring_payments')
    .select('id')
    .eq('debt_id', debtId)
    .eq('frequency', 'monthly')
    .limit(1)
    .maybeSingle()
  if (error) throw error

  if (input.payment_day) {
    const fields = {
      name: `Cuota ${input.name}`,
      amount: input.monthly_payment,
      due_day: input.payment_day,
    }
    if (existing) {
      const { error } = await supabase
        .from('recurring_payments')
        .update({ ...fields, active: true })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('recurring_payments').insert({
        user_id: userId,
        ...fields,
        frequency: 'monthly',
        debt_id: debtId,
        active: true,
      })
      if (error) throw error
    }
  } else if (existing) {
    const { error } = await supabase
      .from('recurring_payments')
      .update({ active: false })
      .eq('id', existing.id)
    if (error) throw error
  }
}

export async function createDebt(userId: string, input: DebtInput): Promise<string> {
  const { data, error } = await supabase
    .from('debts')
    .insert({ user_id: userId, ...input, status: 'active' })
    .select('id')
    .single()
  if (error) throw error
  await syncDebtRecurring(userId, data.id, input)
  return data.id
}

export async function updateDebt(userId: string, debtId: string, input: DebtInput): Promise<void> {
  const { error } = await supabase.from('debts').update(input).eq('id', debtId)
  if (error) throw error
  await syncDebtRecurring(userId, debtId, input)
}

/** Archiva la deuda y desactiva sus recurrentes (no borra el historial). */
export async function archiveDebt(debt: Debt): Promise<void> {
  const { error } = await supabase.from('debts').update({ archived: true }).eq('id', debt.id)
  if (error) throw error
  const { error: recError } = await supabase
    .from('recurring_payments')
    .update({ active: false })
    .eq('debt_id', debt.id)
  if (recError) throw recError
}

/** Solo para deudas sin pagos registrados. */
export async function deleteDebt(debt: Debt): Promise<void> {
  const { error: recError } = await supabase
    .from('recurring_payments')
    .delete()
    .eq('debt_id', debt.id)
  if (recError) throw recError
  const { error } = await supabase.from('debts').delete().eq('id', debt.id)
  if (error) throw error
}
