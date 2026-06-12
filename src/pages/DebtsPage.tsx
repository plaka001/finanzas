import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Plus } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { formatCOP } from '../lib/format'
import { createDebt, type DebtInput } from '../lib/debts'
import { useDebts } from '../hooks/useDebts'
import DebtFormSheet from '../components/DebtFormSheet'
import type { Debt } from '../types'

export default function DebtsPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const { data: debts = [], isLoading } = useDebts()
  const [creating, setCreating] = useState(false)

  const visible = debts.filter((d) => !d.archived)
  const active = visible.filter((d) => d.status === 'active')
  const paidOff = visible.filter((d) => d.status === 'paid_off')
  const totalBalance = active.reduce((sum, d) => sum + d.current_balance, 0)

  const create = useMutation({
    mutationFn: (input: DebtInput) => {
      if (!session) throw new Error('Sin sesión')
      return createDebt(session.user.id, input)
    },
    onSuccess: () => {
      setCreating(false)
      queryClient.invalidateQueries({ queryKey: ['debts'] })
      queryClient.invalidateQueries({ queryKey: ['recurring-payments'] })
    },
  })

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Deudas</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-500 transition active:scale-95"
        >
          <Plus className="size-3.5" /> Nueva deuda
        </button>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
          Deuda total
        </p>
        <p className="tnum mt-2 text-4xl font-bold text-rose-400">{formatCOP(totalBalance)}</p>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {active.length} {active.length === 1 ? 'deuda activa' : 'deudas activas'}
          {paidOff.length > 0 && ` · ${paidOff.length} saldada${paidOff.length > 1 ? 's' : ''}`}
        </p>
      </section>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-zinc-500">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((d) => (
            <DebtCard key={d.id} debt={d} />
          ))}
          {paidOff.length > 0 && (
            <>
              <h2 className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Saldadas
              </h2>
              {paidOff.map((d) => (
                <DebtCard key={d.id} debt={d} />
              ))}
            </>
          )}
        </div>
      )}

      {creating && (
        <DebtFormSheet
          debt={null}
          hasPayments={false}
          saving={create.isPending}
          onCancel={() => setCreating(false)}
          onSave={(input) => create.mutate(input)}
        />
      )}
    </div>
  )
}

function DebtCard({ debt }: { debt: Debt }) {
  const paidOff = debt.status === 'paid_off'
  const paid = debt.original_amount ? debt.original_amount - debt.current_balance : null
  const pct =
    debt.original_amount && paid !== null
      ? Math.min(Math.round((paid / debt.original_amount) * 100), 100)
      : null

  return (
    <Link
      to={`/deudas/${debt.id}`}
      className={`block rounded-2xl bg-white p-4 shadow-sm transition active:scale-[0.99] dark:bg-card ${
        paidOff ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold">{debt.name}</p>
        {paidOff ? (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
            Saldada
          </span>
        ) : (
          <ChevronRight className="size-4 shrink-0 text-zinc-400" />
        )}
      </div>

      <p className={`tnum mt-1 text-2xl font-bold ${paidOff ? 'text-emerald-400' : ''}`}>
        {paidOff ? formatCOP(0) : formatCOP(debt.current_balance)}
      </p>

      {pct !== null && (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-card-hover">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${paidOff ? 100 : pct}%` }}
            />
          </div>
          <p className="tnum mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            {paidOff ? 100 : pct}% pagado de {formatCOP(debt.original_amount!)}
          </p>
        </div>
      )}

      {!paidOff && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          {debt.interest_rate_ea !== null && <span className="tnum">{debt.interest_rate_ea}% E.A.</span>}
          {debt.monthly_payment !== null && (
            <span className="tnum">Cuota {formatCOP(debt.monthly_payment)}</span>
          )}
          {debt.payment_day !== null && <span>Vence el día {debt.payment_day}</span>}
        </div>
      )}
    </Link>
  )
}
