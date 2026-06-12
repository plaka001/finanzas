import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Link2, Plus } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { formatCOP, parseAmountInput } from '../lib/format'
import { useCategories } from '../hooks/useCategories'
import type { RecurringFrequency, RecurringPayment } from '../types'

const FREQ_LABEL: Record<RecurringFrequency, string> = {
  monthly: 'Mensual',
  yearly: 'Anual',
  once: 'Única vez',
}

interface ReminderForm {
  name: string
  amount: number | null
  frequency: RecurringFrequency
  due_day: number | null
  due_date: string | null
  category_id: string | null
}

export default function RemindersPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const { data: categories = [] } = useCategories()
  const [editing, setEditing] = useState<RecurringPayment | 'new' | null>(null)

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['recurring-payments', 'all'],
    queryFn: async (): Promise<RecurringPayment[]> => {
      const { data, error } = await supabase
        .from('recurring_payments')
        .select('*')
        .order('created_at')
      if (error) throw error
      return data
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['recurring-payments'] })
  }

  const save = useMutation({
    mutationFn: async (form: ReminderForm) => {
      if (!session) return
      if (editing === 'new') {
        const { error } = await supabase
          .from('recurring_payments')
          .insert({ user_id: session.user.id, ...form, active: true })
        if (error) throw error
      } else if (editing) {
        const { error } = await supabase
          .from('recurring_payments')
          .update(form)
          .eq('id', editing.id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      setEditing(null)
      invalidate()
    },
  })

  const toggleActive = useMutation({
    mutationFn: async (r: RecurringPayment) => {
      const { error } = await supabase
        .from('recurring_payments')
        .update({ active: !r.active })
        .eq('id', r.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const activeOnes = reminders.filter((r) => r.active)
  const inactive = reminders.filter((r) => !r.active)

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            aria-label="Volver al inicio"
            className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-card"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-lg font-bold">Recordatorios</h1>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-500 transition active:scale-95"
        >
          <Plus className="size-3.5" /> Nuevo
        </button>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Estos pagos alimentan «Próximos pagos» y el calendario .ics (se descarga desde el inicio).
        Completa aquí las fechas reales de SOAT y tecnomecánica.
      </p>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-zinc-500">Cargando…</p>
      ) : (
        <>
          <ReminderList reminders={activeOnes} onEdit={setEditing} onToggle={(r) => toggleActive.mutate(r)} />
          {inactive.length > 0 && (
            <>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Inactivos
              </h2>
              <ReminderList reminders={inactive} onEdit={setEditing} onToggle={(r) => toggleActive.mutate(r)} />
            </>
          )}
        </>
      )}

      {editing && (
        <ReminderFormSheet
          reminder={editing === 'new' ? null : editing}
          categories={categories.filter((c) => c.type === 'expense' && !c.archived)}
          saving={save.isPending}
          onCancel={() => setEditing(null)}
          onSave={(form) => save.mutate(form)}
        />
      )}
    </div>
  )
}

function describeSchedule(r: RecurringPayment): string {
  if (r.frequency === 'monthly') return `Mensual · día ${r.due_day}`
  if (r.frequency === 'yearly')
    return r.due_date
      ? `Anual · ${format(parseISO(r.due_date), 'd MMM', { locale: es })}`
      : 'Anual · fecha pendiente'
  return r.due_date ? format(parseISO(r.due_date), "d 'de' MMMM yyyy", { locale: es }) : 'Única vez'
}

function ReminderList({
  reminders,
  onEdit,
  onToggle,
}: {
  reminders: RecurringPayment[]
  onEdit: (r: RecurringPayment) => void
  onToggle: (r: RecurringPayment) => void
}) {
  if (reminders.length === 0) {
    return (
      <p className="rounded-2xl bg-white p-4 text-sm text-zinc-500 shadow-sm dark:bg-card dark:text-zinc-400">
        Sin recordatorios. Crea el primero con «Nuevo».
      </p>
    )
  }
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-card">
      {reminders.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-800"
        >
          <button type="button" onClick={() => onEdit(r)} className="min-w-0 flex-1 text-left">
            <p className={`flex items-center gap-1.5 truncate text-sm font-medium ${r.active ? '' : 'text-zinc-400 dark:text-zinc-500'}`}>
              {r.name}
              {r.debt_id && <Link2 className="size-3.5 shrink-0 text-zinc-400" aria-label="Vinculado a deuda" />}
            </p>
            <p className="tnum text-xs text-zinc-500 dark:text-zinc-400">
              {r.amount ? formatCOP(r.amount) : 'Monto variable'} · {describeSchedule(r)}
            </p>
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={r.active}
            aria-label={r.active ? 'Desactivar' : 'Activar'}
            onClick={() => onToggle(r)}
            className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition ${
              r.active ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-card-hover'
            }`}
          >
            <span
              className={`block size-5 rounded-full bg-white transition-transform ${
                r.active ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  )
}

function ReminderFormSheet({
  reminder,
  categories,
  saving,
  onCancel,
  onSave,
}: {
  reminder: RecurringPayment | null
  categories: { id: string; icon: string; name: string }[]
  saving: boolean
  onCancel: () => void
  onSave: (form: ReminderForm) => void
}) {
  const [name, setName] = useState(reminder?.name ?? '')
  const [amountStr, setAmountStr] = useState(reminder?.amount ? String(reminder.amount) : '')
  const [frequency, setFrequency] = useState<RecurringFrequency>(reminder?.frequency ?? 'monthly')
  const [dayStr, setDayStr] = useState(reminder?.due_day ? String(reminder.due_day) : '')
  const [date, setDate] = useState(reminder?.due_date ?? '')
  const [categoryId, setCategoryId] = useState(reminder?.category_id ?? '')

  const amount = parseAmountInput(amountStr)
  const day = parseInt(dayStr, 10)
  const valid =
    name.trim().length > 0 &&
    (frequency === 'monthly' ? day >= 1 && day <= 31 : date.length > 0)

  const textInput =
    'rounded-xl bg-zinc-100 px-3 py-2.5 text-sm text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100'
  const labelCls = 'flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400'

  return (
    <div className="sheet-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onCancel}>
      <div
        className="sheet-panel max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-safe dark:bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold">{reminder ? 'Editar recordatorio' : 'Nuevo recordatorio'}</h2>

        <div className="mt-4 flex flex-col gap-3">
          <label className={labelCls}>
            Nombre
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="SOAT moto"
              className={textInput}
            />
          </label>

          <label className={labelCls}>
            Monto (opcional; vacío = variable)
            <input
              type="text"
              inputMode="numeric"
              value={amount > 0 ? formatCOP(amount) : ''}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="$0"
              className={`${textInput} tnum font-bold`}
            />
          </label>

          <div className="flex rounded-xl bg-zinc-200 p-1 text-xs font-semibold dark:bg-card-hover">
            {(Object.keys(FREQ_LABEL) as RecurringFrequency[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                className={`flex-1 rounded-lg py-1.5 transition ${
                  frequency === f ? 'bg-white shadow-sm dark:bg-card' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {FREQ_LABEL[f]}
              </button>
            ))}
          </div>

          {frequency === 'monthly' ? (
            <label className={labelCls}>
              Día del mes
              <input
                type="number"
                min={1}
                max={31}
                value={dayStr}
                onChange={(e) => setDayStr(e.target.value)}
                placeholder="1–31"
                className={`${textInput} tnum`}
              />
            </label>
          ) : (
            <label className={labelCls}>
              {frequency === 'yearly' ? 'Fecha (se repite cada año)' : 'Fecha'}
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={textInput}
              />
            </label>
          )}

          <label className={labelCls}>
            Categoría (opcional, para «marcar pagado»)
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={textInput}
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
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
              onSave({
                name: name.trim(),
                amount: amount > 0 ? amount : null,
                frequency,
                // anual: la BD exige due_day; se toma de la fecha ancla
                due_day:
                  frequency === 'monthly'
                    ? day
                    : frequency === 'yearly' && date
                      ? parseISO(date).getDate()
                      : null,
                due_date: frequency === 'monthly' ? null : date || null,
                category_id: categoryId || null,
              })
            }
            className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 transition active:scale-95 disabled:opacity-40"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
