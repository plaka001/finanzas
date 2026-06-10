import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { formatCOP } from '../lib/format'
import AmountDateSheet from '../components/AmountDateSheet'
import type { Goal } from '../types'

export default function GoalsPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [contributing, setContributing] = useState<Goal | null>(null)

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase.from('goals').select('*').order('sort_order')
      if (error) throw error
      return data
    },
  })

  const contribute = useMutation({
    mutationFn: async ({ goal, amount, date }: { goal: Goal; amount: number; date: string }) => {
      if (!session) return
      const { error } = await supabase.from('goal_contributions').insert({
        user_id: session.user.id,
        goal_id: goal.id,
        amount,
        contributed_at: date,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setContributing(null)
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="text-lg font-bold">Metas</h1>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-zinc-500">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onContribute={() => setContributing(goal)} />
          ))}
        </div>
      )}

      {contributing && (
        <AmountDateSheet
          title={`Aportar a ${contributing.name}`}
          confirmLabel="Aportar"
          saving={contribute.isPending}
          onCancel={() => setContributing(null)}
          onConfirm={({ amount, date }) => contribute.mutate({ goal: contributing, amount, date })}
        />
      )}
    </div>
  )
}

function GoalCard({ goal, onContribute }: { goal: Goal; onContribute: () => void }) {
  const pct = Math.min(Math.round((goal.current_amount / goal.target_amount) * 100), 100)
  const done = goal.current_amount >= goal.target_amount

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-card">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xl dark:bg-card-hover">
          {goal.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{goal.name}</p>
          {goal.deadline && (
            <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
              Para {format(parseISO(goal.deadline), 'MMMM yyyy', { locale: es })}
            </p>
          )}
        </div>
        {goal.is_debt_free_goal ? (
          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-500 dark:bg-card-hover dark:text-zinc-400">
            Automática
          </span>
        ) : (
          <button
            type="button"
            onClick={onContribute}
            className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-500 transition active:scale-95"
          >
            <Plus className="size-3.5" /> Aportar
          </button>
        )}
      </div>

      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-card-hover">
          <div
            className={`h-full rounded-full ${done ? 'bg-emerald-400' : goal.is_debt_free_goal ? 'bg-orange-400' : 'bg-emerald-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-baseline justify-between">
          <p className="tnum text-sm font-bold">
            {formatCOP(goal.current_amount)}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">
              {' '}
              / {formatCOP(goal.target_amount)}
            </span>
          </p>
          <p className="tnum text-xs font-semibold text-zinc-500 dark:text-zinc-400">{pct}%</p>
        </div>
      </div>

      {goal.is_debt_free_goal && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Se alimenta sola con cada cuota y abono que registras en Deudas.
        </p>
      )}
    </section>
  )
}
