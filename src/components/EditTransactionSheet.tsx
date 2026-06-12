import { useState } from 'react'
import { formatCOP, parseAmountInput } from '../lib/format'
import type { Account, Category, CategoryType, Transaction } from '../types'

interface Props {
  transaction: Transaction
  categories: Category[]
  accounts: Account[]
  saving: boolean
  onCancel: () => void
  onSave: (patch: {
    amount: number
    type: CategoryType
    category_id: string | null
    note: string | null
    occurred_at: string
    account_id: string | null
  }) => void
}

/** Bottom sheet para editar un movimiento existente. */
export default function EditTransactionSheet({
  transaction,
  categories,
  accounts,
  saving,
  onCancel,
  onSave,
}: Props) {
  const [amountStr, setAmountStr] = useState(String(transaction.amount))
  const [type, setType] = useState<CategoryType>(transaction.type)
  const [categoryId, setCategoryId] = useState(transaction.category_id ?? '')
  const [accountId, setAccountId] = useState(transaction.account_id ?? '')
  const [note, setNote] = useState(transaction.note ?? '')
  const [date, setDate] = useState(transaction.occurred_at)

  const amount = parseAmountInput(amountStr)
  const typeCategories = categories.filter((c) => c.type === type && !c.archived)
  const selectableAccounts = accounts.filter((a) => !a.archived || a.id === transaction.account_id)

  return (
    <div className="sheet-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onCancel}>
      <div
        className="sheet-panel w-full max-w-md rounded-t-3xl bg-white p-5 pb-safe dark:bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold">Editar movimiento</h2>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex rounded-xl bg-zinc-200 p-1 text-xs font-semibold dark:bg-card-hover">
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
                  setCategoryId('')
                }}
                className={`flex-1 rounded-lg py-1.5 transition ${
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

          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Monto
            <input
              type="text"
              inputMode="numeric"
              value={amount > 0 ? formatCOP(amount) : ''}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="$0"
              className="tnum rounded-xl bg-zinc-100 px-3 py-2.5 text-lg font-bold text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Categoría
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="rounded-xl bg-zinc-100 px-3 py-2.5 text-sm text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100"
            >
              <option value="">Sin categoría</option>
              {typeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Cuenta
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="rounded-xl bg-zinc-100 px-3 py-2.5 text-sm text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100"
            >
              <option value="">Sin cuenta</option>
              {selectableAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.icon} {a.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Nota
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Opcional"
              className="rounded-xl bg-zinc-100 px-3 py-2.5 text-sm text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100"
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
            onClick={() =>
              onSave({
                amount,
                type,
                category_id: categoryId || null,
                note: note.trim() || null,
                occurred_at: date,
                account_id: accountId || null,
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
