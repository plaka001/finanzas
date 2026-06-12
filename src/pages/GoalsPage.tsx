import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Pencil, Plus } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { formatCOP, parseAmountInput } from '../lib/format'
import AmountDateSheet from '../components/AmountDateSheet'
import EmojiPicker from '../components/EmojiPicker'
import type { Goal } from '../types'

interface GoalForm {
  name: string
  target_amount: number
  deadline: string | null
  icon: string
}

export default function GoalsPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [contributing, setContributing] = useState<Goal | null>(null)
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase.from('goals').select('*').order('sort_order')
      if (error) throw error
      return data
    },
  })

  const visible = goals.filter((g) => !g.archived)

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

  const save = useMutation({
    mutationFn: async (form: GoalForm) => {
      if (!session) return
      if (editing === 'new') {
        const maxOrder = Math.max(0, ...goals.map((g) => g.sort_order))
        const { error } = await supabase
          .from('goals')
          .insert({ user_id: session.user.id, ...form, sort_order: maxOrder + 1 })
        if (error) throw error
      } else if (editing) {
        const { error } = await supabase.from('goals').update(form).eq('id', editing.id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })

  const archive = useMutation({
    mutationFn: async (goal: Goal) => {
      const { error } = await supabase.from('goals').update({ archived: true }).eq('id', goal.id)
      if (error) throw error
    },
    onSuccess: () => {
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Metas</h1>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-500 transition active:scale-95"
        >
          <Plus className="size-3.5" /> Nueva meta
        </button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-zinc-500">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onContribute={() => setContributing(goal)}
              onEdit={goal.is_debt_free_goal ? undefined : () => setEditing(goal)}
            />
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

      {editing && (
        <GoalFormSheet
          goal={editing === 'new' ? null : editing}
          saving={save.isPending || archive.isPending}
          onCancel={() => setEditing(null)}
          onSave={(form) => save.mutate(form)}
          onArchive={editing === 'new' ? undefined : () => archive.mutate(editing)}
        />
      )}
    </div>
  )
}

function GoalFormSheet({
  goal,
  saving,
  onCancel,
  onSave,
  onArchive,
}: {
  goal: Goal | null
  saving: boolean
  onCancel: () => void
  onSave: (form: GoalForm) => void
  onArchive?: () => void
}) {
  const [name, setName] = useState(goal?.name ?? '')
  const [targetStr, setTargetStr] = useState(goal ? String(goal.target_amount) : '')
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [icon, setIcon] = useState(goal?.icon ?? '🎯')

  const target = parseAmountInput(targetStr)
  const valid = name.trim().length > 0 && target > 0

  return (
    <div className="sheet-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onCancel}>
      <div
        className="sheet-panel w-full max-w-md rounded-t-3xl bg-white p-5 pb-safe dark:bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold">{goal ? 'Editar meta' : 'Nueva meta'}</h2>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Nombre
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fondo de emergencia"
              className="rounded-xl bg-zinc-100 px-3 py-2.5 text-sm text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100"
            />
          </label>

          <EmojiPicker value={icon} onChange={setIcon} />

          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Monto objetivo
            <input
              type="text"
              inputMode="numeric"
              value={target > 0 ? formatCOP(target) : ''}
              onChange={(e) => setTargetStr(e.target.value)}
              placeholder="$0"
              className="tnum rounded-xl bg-zinc-100 px-3 py-2.5 text-lg font-bold text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Fecha límite (opcional)
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="rounded-xl bg-zinc-100 px-3 py-2.5 text-sm text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100"
            />
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl bg-zinc-200 py-3 text-sm font-semibold text-zinc-700 transition active:scale-95 dark:bg-card-hover dark:text-zinc-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!valid || saving}
            onClick={() =>
              onSave({ name: name.trim(), target_amount: target, deadline: deadline || null, icon: icon.trim() || '🎯' })
            }
            className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 transition active:scale-95 disabled:opacity-40"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>

        {onArchive && (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (confirm('¿Archivar esta meta? Se oculta de la lista; los aportes se conservan.'))
                onArchive()
            }}
            className="mt-3 w-full rounded-xl bg-zinc-100 py-2.5 text-xs font-semibold text-zinc-500 transition active:scale-95 dark:bg-card-hover dark:text-zinc-400"
          >
            Archivar meta
          </button>
        )}
      </div>
    </div>
  )
}

function GoalCard({
  goal,
  onContribute,
  onEdit,
}: {
  goal: Goal
  onContribute: () => void
  onEdit?: () => void
}) {
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
        {onEdit && (
          <button
            type="button"
            aria-label={`Editar ${goal.name}`}
            onClick={onEdit}
            className="shrink-0 rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-card-hover"
          >
            <Pencil className="size-4" />
          </button>
        )}
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
