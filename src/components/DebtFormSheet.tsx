import { useState } from 'react'
import { formatCOP, parseAmountInput } from '../lib/format'
import type { DebtInput } from '../lib/debts'
import type { Debt } from '../types'

interface Props {
  debt: Debt | null
  hasPayments: boolean
  saving: boolean
  onCancel: () => void
  onSave: (input: DebtInput) => void
  onArchive?: () => void
  onDelete?: () => void
}

/** Bottom sheet de alta/edición de deuda. */
export default function DebtFormSheet({
  debt,
  hasPayments,
  saving,
  onCancel,
  onSave,
  onArchive,
  onDelete,
}: Props) {
  const [name, setName] = useState(debt?.name ?? '')
  const [balanceStr, setBalanceStr] = useState(debt ? String(debt.current_balance) : '')
  const [originalStr, setOriginalStr] = useState(debt?.original_amount ? String(debt.original_amount) : '')
  const [rateStr, setRateStr] = useState(debt?.interest_rate_ea !== null && debt ? String(debt.interest_rate_ea) : '')
  const [paymentStr, setPaymentStr] = useState(debt?.monthly_payment ? String(debt.monthly_payment) : '')
  const [dayStr, setDayStr] = useState(debt?.payment_day ? String(debt.payment_day) : '')
  const [endDate, setEndDate] = useState(debt?.end_date ?? '')
  const [notes, setNotes] = useState(debt?.notes ?? '')

  const balance = parseAmountInput(balanceStr)
  const original = parseAmountInput(originalStr)
  const payment = parseAmountInput(paymentStr)
  const rate = parseFloat(rateStr.replace(',', '.'))
  const day = parseInt(dayStr, 10)
  const dayValid = !dayStr || (day >= 1 && day <= 31)
  const valid = name.trim().length > 0 && balance > 0 && dayValid

  const moneyInput =
    'tnum rounded-xl bg-zinc-100 px-3 py-2.5 text-sm font-bold text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100'
  const textInput =
    'rounded-xl bg-zinc-100 px-3 py-2.5 text-sm text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100'
  const labelCls = 'flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400'

  return (
    <div className="sheet-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onCancel}>
      <div
        className="sheet-panel max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-safe dark:bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold">{debt ? 'Editar deuda' : 'Nueva deuda'}</h2>
        {!debt && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Con cuota y día de pago se crea solo su recordatorio mensual (entra a próximos pagos y
            al calendario).
          </p>
        )}

        <div className="mt-4 flex flex-col gap-3">
          <label className={labelCls}>
            Nombre
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="TC Bancolombia"
              className={textInput}
            />
          </label>

          <div className="flex gap-3">
            <label className={`${labelCls} flex-1`}>
              Saldo actual
              <input
                type="text"
                inputMode="numeric"
                value={balance > 0 ? formatCOP(balance) : ''}
                onChange={(e) => setBalanceStr(e.target.value)}
                placeholder="$0"
                className={moneyInput}
              />
            </label>
            <label className={`${labelCls} flex-1`}>
              Monto original (opcional)
              <input
                type="text"
                inputMode="numeric"
                value={original > 0 ? formatCOP(original) : ''}
                onChange={(e) => setOriginalStr(e.target.value)}
                placeholder="$0"
                className={moneyInput}
              />
            </label>
          </div>

          <div className="flex gap-3">
            <label className={`${labelCls} flex-1`}>
              Tasa % E.A. (opcional)
              <input
                type="text"
                inputMode="decimal"
                value={rateStr}
                onChange={(e) => setRateStr(e.target.value)}
                placeholder="18.02"
                className={`${textInput} tnum`}
              />
            </label>
            <label className={`${labelCls} flex-1`}>
              Día de pago (opcional)
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
          </div>

          <label className={labelCls}>
            Cuota mensual (opcional; vacía = variable)
            <input
              type="text"
              inputMode="numeric"
              value={payment > 0 ? formatCOP(payment) : ''}
              onChange={(e) => setPaymentStr(e.target.value)}
              placeholder="$0"
              className={moneyInput}
            />
          </label>

          <label className={labelCls}>
            Fecha fin (opcional)
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={textInput}
            />
          </label>

          <label className={labelCls}>
            Notas
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              className={textInput}
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
              onSave({
                name: name.trim(),
                original_amount: original > 0 ? original : null,
                current_balance: balance,
                interest_rate_ea: Number.isFinite(rate) ? rate : null,
                monthly_payment: payment > 0 ? payment : null,
                payment_day: dayStr && dayValid ? day : null,
                end_date: endDate || null,
                notes: notes.trim() || null,
              })
            }
            className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 transition active:scale-95 disabled:opacity-40"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>

        {debt && (
          <div className="mt-3 flex gap-2">
            {hasPayments
              ? onArchive && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      if (confirm('¿Archivar esta deuda? Se oculta de la lista y se desactivan sus recordatorios; el historial se conserva.'))
                        onArchive()
                    }}
                    className="flex-1 rounded-xl bg-zinc-100 py-2.5 text-xs font-semibold text-zinc-500 transition active:scale-95 dark:bg-card-hover dark:text-zinc-400"
                  >
                    Archivar deuda
                  </button>
                )
              : onDelete && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      if (confirm('¿Eliminar esta deuda y su recordatorio?')) onDelete()
                    }}
                    className="flex-1 rounded-xl bg-rose-500/10 py-2.5 text-xs font-semibold text-rose-500 transition active:scale-95"
                  >
                    Eliminar deuda
                  </button>
                )}
          </div>
        )}
      </div>
    </div>
  )
}
