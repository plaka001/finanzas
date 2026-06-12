import { useRef, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { formatCOP } from '../lib/format'
import type { Account, Category, Transaction } from '../types'

const ACTIONS_WIDTH = 112

interface Props {
  transaction: Transaction
  category?: Category
  account?: Account
  onEdit: () => void
  onDelete: () => void
}

/** Fila de movimiento con swipe a la izquierda para editar/eliminar. */
export default function TransactionRow({ transaction: t, category, account, onEdit, onDelete }: Props) {
  const [offset, setOffset] = useState(0)
  const startX = useRef(0)
  const startY = useRef(0)
  const startOffset = useRef(0)
  const swiping = useRef(false)

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    startOffset.current = offset
    swiping.current = false
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    if (!swiping.current && Math.abs(dx) < Math.abs(dy)) return
    swiping.current = true
    setOffset(Math.min(0, Math.max(-ACTIONS_WIDTH, startOffset.current + dx)))
  }

  function onTouchEnd() {
    if (!swiping.current) return
    setOffset((o) => (o < -ACTIONS_WIDTH / 2 ? -ACTIONS_WIDTH : 0))
  }

  function onRowClick() {
    if (offset !== 0) setOffset(0)
    else onEdit()
  }

  const isExpense = t.type === 'expense'
  const isTransfer = t.transfer_id !== null
  const icon = isTransfer ? '🔁' : (category?.icon ?? '📦')
  const name = isTransfer ? 'Transferencia' : (category?.name ?? 'Sin categoría')
  const color = isTransfer ? '#71717a' : (category?.color ?? '#71717a')

  return (
    <div className="relative overflow-hidden border-b border-zinc-100 last:border-b-0 dark:border-zinc-800">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTIONS_WIDTH }}>
        <button
          type="button"
          aria-label="Editar"
          onClick={() => {
            setOffset(0)
            onEdit()
          }}
          className="flex flex-1 items-center justify-center bg-zinc-500 text-white"
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Eliminar"
          onClick={() => {
            setOffset(0)
            onDelete()
          }}
          className="flex flex-1 items-center justify-center bg-rose-500 text-white"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onRowClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative flex w-full items-center gap-3 bg-white px-3 py-2.5 text-left transition-transform dark:bg-card"
        style={{ transform: `translateX(${offset}px)` }}
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-base"
          style={{ backgroundColor: `${color}26` }}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          {(t.note || account) && (
            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
              {account && (
                <span style={{ color: account.color }}>
                  {account.icon} {account.name}
                </span>
              )}
              {account && t.note && ' · '}
              {t.note}
            </span>
          )}
        </span>
        <span
          className={`tnum text-sm font-semibold ${
            isTransfer ? 'text-zinc-500 dark:text-zinc-400' : isExpense ? 'text-rose-400' : 'text-emerald-400'
          }`}
        >
          {isExpense ? '−' : '+'}
          {formatCOP(t.amount)}
        </span>
      </button>
    </div>
  )
}
