import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Debt } from '../types'

export function useDebts() {
  return useQuery({
    queryKey: ['debts'],
    queryFn: async (): Promise<Debt[]> => {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .order('current_balance', { ascending: false })
      if (error) throw error
      return data
    },
  })
}
