import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Delete, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useCategories } from '../hooks/useCategories'
import { formatCOP } from '../lib/format'
import { removePending } from '../lib/offlineQueue'
import { deleteTransaction, saveTransaction, type SaveResult } from '../lib/transactions'
import type { Category, CategoryType } from '../types'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back'] as const
const MAX_DIGITS = 11

interface ToastState {
  message: string
  result: SaveResult | null
}

export default function QuickAddPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const { data: categories = [] } = useCategories()

  const [digits, setDigits] = useState('')
  const [type, setType] = useState<CategoryType>('expense')
  const [note, setNote] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [showAll, setShowAll] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const amount = digits ? parseInt(digits, 10) : 0
  const frequent = categories.filter((c) => c.type === type && c.is_frequent)
  const rest = categories.filter((c) => c.type === type && !c.is_frequent)
  const visible = showAll ? [...frequent, ...rest] : frequent

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  function pressKey(key: (typeof KEYS)[number]) {
    if (key === 'back') {
      setDigits((d) => d.slice(0, -1))
      return
    }
    setDigits((d) => {
      if (d === '' && (key === '0' || key === '000')) return d
      const next = d + key
      return next.length > MAX_DIGITS ? d : next
    })
  }

  function showToast(message: string, result: SaveResult | null) {
    clearTimeout(toastTimer.current)
    setToast({ message, result })
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['month-summary'] })
    queryClient.invalidateQueries({ queryKey: ['pending-count'] })
  }

  async function save(category: Category) {
    if (amount <= 0 || saving || !session) return
    setSaving(true)
    try {
      const result = await saveTransaction({
        user_id: session.user.id,
        amount,
        type,
        category_id: category.id,
        note: note.trim() || null,
        occurred_at: date,
      })
      invalidate()
      const label = `${formatCOP(amount)} · ${category.name}`
      showToast(
        result.status === 'queued' ? `${label} (offline, se sincronizará)` : label,
        result,
      )
      setDigits('')
      setNote('')
      setNoteOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function undo() {
    const result = toast?.result
    clearTimeout(toastTimer.current)
    setToast(null)
    if (!result) return
    if (result.status === 'synced') await deleteTransaction(result.id)
    else await removePending(result.localId)
    invalidate()
  }

  const dateLabel =
    date === format(new Date(), 'yyyy-MM-dd')
      ? 'Hoy'
      : format(parseISO(date), 'd MMM yyyy', { locale: es })

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-safe pt-safe">
      <header className="flex items-center justify-between py-3">
        <div className="flex rounded-full bg-zinc-200 p-1 text-xs font-semibold dark:bg-card">
          {(
            [
              ['expense', 'Gasto'],
              ['income', 'Ingreso'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setType(value)
                setShowAll(false)
              }}
              className={`rounded-full px-4 py-1.5 transition ${
                type === value
                  ? value === 'expense'
                    ? 'bg-rose-500 text-white'
                    : 'bg-emerald-500 text-zinc-950'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => navigate(-1)}
          className="rounded-full p-2.5 text-zinc-500 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-card"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="py-4 text-center">
        <p
          className={`tnum text-5xl font-bold ${
            amount > 0
              ? type === 'expense'
                ? 'text-rose-400'
                : 'text-emerald-400'
              : 'text-zinc-400 dark:text-zinc-600'
          }`}
        >
          {formatCOP(amount)}
        </p>
        <div className="mt-3 flex items-center justify-center gap-2 text-xs">
          <label className="relative rounded-full bg-zinc-200 px-3 py-1.5 font-medium text-zinc-600 dark:bg-card dark:text-zinc-300">
            📅 {dateLabel}
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              aria-label="Fecha del movimiento"
            />
          </label>
          {noteOpen ? (
            <input
              autoFocus
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota…"
              className="w-36 rounded-full bg-zinc-200 px-3 py-1.5 outline-none placeholder:text-zinc-400 dark:bg-card dark:text-zinc-100"
            />
          ) : (
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="rounded-full bg-zinc-200 px-3 py-1.5 font-medium text-zinc-600 dark:bg-card dark:text-zinc-300"
            >
              + Nota
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="grid grid-cols-4 gap-2">
          {visible.map((cat) => (
            <button
              key={cat.id}
              type="button"
              disabled={amount <= 0 || saving}
              onClick={() => save(cat)}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 shadow-sm transition active:scale-95 disabled:opacity-40 dark:bg-card"
            >
              <span
                className="flex size-10 items-center justify-center rounded-full text-xl"
                style={{ backgroundColor: `${cat.color}26` }}
              >
                {cat.icon}
              </span>
              <span className="line-clamp-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                {cat.name}
              </span>
            </button>
          ))}
          {!showAll && rest.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-zinc-300 p-3 text-zinc-500 transition active:scale-95 dark:border-zinc-700 dark:text-zinc-400"
            >
              <span className="text-xl">⋯</span>
              <span className="text-[10px] font-medium">Más</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pb-4 pt-2">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => pressKey(key)}
            aria-label={key === 'back' ? 'Borrar' : key}
            className="tnum flex h-14 items-center justify-center rounded-2xl bg-white text-2xl font-semibold shadow-sm transition active:scale-95 active:bg-zinc-100 dark:bg-card dark:active:bg-card-hover"
          >
            {key === 'back' ? <Delete className="size-6 text-zinc-400" /> : key}
          </button>
        ))}
      </div>

      {toast && (
        <div className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-zinc-100 shadow-xl dark:bg-zinc-100 dark:text-zinc-900">
          <span className="line-clamp-1">✓ {toast.message}</span>
          {toast.result && (
            <button
              type="button"
              onClick={undo}
              className="shrink-0 font-bold text-emerald-400 dark:text-emerald-600"
            >
              Deshacer
            </button>
          )}
        </div>
      )}
    </div>
  )
}
