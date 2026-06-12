import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Account } from '../types'

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function defaultAccount(accounts: Account[]): Account | undefined {
  const active = accounts.filter((a) => !a.archived)
  return active.find((a) => a.is_default) ?? active[0]
}

export interface AccountActivity {
  /** Movimiento neto sobre el saldo inicial (ingresos − gastos − pagos de deuda hechos desde la cuenta). */
  delta: number
  movements: number
}

/**
 * Actividad por cuenta para calcular saldos:
 * saldo = initial_balance + ingresos − gastos − debt_payments desde la cuenta.
 * Las transferencias ya son un par gasto/ingreso, así que entran solas.
 */
export function useAccountActivity() {
  return useQuery({
    queryKey: ['account-activity'],
    queryFn: async (): Promise<Map<string, AccountActivity>> => {
      const [tx, dp] = await Promise.all([
        supabase
          .from('transactions')
          .select('account_id, type, amount')
          .not('account_id', 'is', null),
        supabase
          .from('debt_payments')
          .select('account_id, amount')
          .not('account_id', 'is', null),
      ])
      if (tx.error) throw tx.error
      if (dp.error) throw dp.error

      const map = new Map<string, AccountActivity>()
      const bump = (id: string, amount: number) => {
        const cur = map.get(id) ?? { delta: 0, movements: 0 }
        map.set(id, { delta: cur.delta + amount, movements: cur.movements + 1 })
      }
      for (const t of tx.data as { account_id: string; type: string; amount: number }[]) {
        bump(t.account_id, t.type === 'income' ? t.amount : -t.amount)
      }
      for (const p of dp.data as { account_id: string; amount: number }[]) {
        bump(p.account_id, -p.amount)
      }
      return map
    },
  })
}

export function accountBalance(account: Account, activity?: Map<string, AccountActivity>): number {
  return account.initial_balance + (activity?.get(account.id)?.delta ?? 0)
}
