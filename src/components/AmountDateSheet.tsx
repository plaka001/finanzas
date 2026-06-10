import { useState } from 'react'
import { format } from 'date-fns'
import { formatCOP, parseAmountInput } from '../lib/format'

interface Props {
  title: string
  confirmLabel: string
  initialAmount?: number | null
  saving: boolean
  onCancel: () => void
  onConfirm: (values: { amount: number; date: string }) => void
}

/** Bottom sheet genérico: monto + fecha (cuotas, abonos, aportes a metas). */
export default function AmountDateSheet({
  title,
  confirmLabel,
  initialAmount,
  saving,
  onCancel,
  onConfirm,
}: Props) {
  const [amountStr, setAmountStr] = useState(initialAmount ? String(initialAmount) : '')
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const amount = parseAmountInput(amountStr)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-safe dark:bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold">{title}</h2>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Monto
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              value={amount > 0 ? formatCOP(amount) : ''}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="$0"
              className="tnum rounded-xl bg-zinc-100 px-3 py-2.5 text-lg font-bold text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Fecha
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
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
            disabled={amount <= 0 || saving}
            onClick={() => onConfirm({ amount, date })}
            className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 transition active:scale-95 disabled:opacity-40"
          >
            {saving ? 'Guardando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
