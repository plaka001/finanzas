import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Pencil, PiggyBank, Receipt } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { formatCOP } from '../lib/format'
import { archiveDebt, deleteDebt, updateDebt, type DebtInput } from '../lib/debts'
import { defaultAccount, useAccounts } from '../hooks/useAccounts'
import AmountDateSheet from '../components/AmountDateSheet'
import DebtFormSheet from '../components/DebtFormSheet'
import Celebration from '../components/Celebration'
import type { Debt, DebtPayment, PaymentKind } from '../types'

const KIND_LABEL: Record<PaymentKind, string> = {
  cuota: 'Cuota',
  abono_capital: 'Abono a capital',
}

export default function DebtDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: accounts = [] } = useAccounts()
  const [sheet, setSheet] = useState<PaymentKind | null>(null)
  const [editing, setEditing] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  const { data: debt } = useQuery({
    queryKey: ['debts', id],
    enabled: !!id,
    queryFn: async (): Promise<Debt | null> => {
      const { data, error } = await supabase.from('debts').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })

  const { data: payments = [] } = useQuery({
    queryKey: ['debt-payments', 'debt', id],
    enabled: !!id,
    queryFn: async (): Promise<DebtPayment[]> => {
      const { data, error } = await supabase
        .from('debt_payments')
        .select('*')
        .eq('debt_id', id!)
        .order('paid_at', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // Intereses ahorrados (estimado simple): cada abono deja de causar interés
  // por el tiempo que faltaba hasta el fin del crédito.
  const interestSaved = useMemo(() => {
    if (!debt?.interest_rate_ea || !debt.end_date) return 0
    const end = parseISO(debt.end_date)
    return payments
      .filter((p) => p.kind === 'abono_capital')
      .reduce((sum, p) => {
        const years = Math.max(differenceInCalendarDays(end, parseISO(p.paid_at)) / 365, 0)
        return sum + p.amount * (Number(debt.interest_rate_ea) / 100) * years
      }, 0)
  }, [debt, payments])

  const registerPayment = useMutation({
    mutationFn: async ({
      amount,
      date,
      kind,
      accountId,
    }: {
      amount: number
      date: string
      kind: PaymentKind
      accountId: string | null
    }) => {
      if (!session || !debt) return false
      const { error } = await supabase.from('debt_payments').insert({
        user_id: session.user.id,
        debt_id: debt.id,
        amount,
        kind,
        paid_at: date,
        account_id: accountId,
      })
      if (error) throw error
      return amount >= debt.current_balance
    },
    onSuccess: (paidOff) => {
      setSheet(null)
      queryClient.invalidateQueries({ queryKey: ['debts'] })
      queryClient.invalidateQueries({ queryKey: ['debt-payments'] })
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      queryClient.invalidateQueries({ queryKey: ['account-activity'] })
      if (paidOff) setCelebrating(true)
    },
  })

  const invalidateDebts = () => {
    queryClient.invalidateQueries({ queryKey: ['debts'] })
    queryClient.invalidateQueries({ queryKey: ['recurring-payments'] })
  }

  const edit = useMutation({
    mutationFn: (input: DebtInput) => {
      if (!session || !debt) throw new Error('Sin sesión')
      return updateDebt(session.user.id, debt.id, input)
    },
    onSuccess: () => {
      setEditing(false)
      invalidateDebts()
    },
  })

  const archive = useMutation({
    mutationFn: () => archiveDebt(debt!),
    onSuccess: () => {
      invalidateDebts()
      navigate('/deudas')
    },
  })

  const remove = useMutation({
    mutationFn: () => deleteDebt(debt!),
    onSuccess: () => {
      invalidateDebts()
      navigate('/deudas')
    },
  })

  if (!debt) {
    return (
      <div className="mx-auto w-full max-w-md">
        <BackLink />
        <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Cargando…</p>
      </div>
    )
  }

  const paidOff = debt.status === 'paid_off'
  const paid = debt.original_amount ? debt.original_amount - debt.current_balance : null
  const pct =
    debt.original_amount && paid !== null
      ? Math.min(Math.round((paid / debt.original_amount) * 100), 100)
      : null

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center gap-2">
        <BackLink />
        <h1 className="truncate text-lg font-bold">{debt.name}</h1>
        {paidOff && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
            Saldada
          </span>
        )}
        <button
          type="button"
          aria-label="Editar deuda"
          onClick={() => setEditing(true)}
          className="ml-auto rounded-full p-2 text-zinc-500 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-card"
        >
          <Pencil className="size-4" />
        </button>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
          Saldo actual
        </p>
        <p className={`tnum mt-2 text-4xl font-bold ${paidOff ? 'text-emerald-400' : 'text-rose-400'}`}>
          {formatCOP(debt.current_balance)}
        </p>

        {pct !== null && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-card-hover">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
            </div>
            <p className="tnum mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {pct}% pagado de {formatCOP(debt.original_amount!)}
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {debt.interest_rate_ea !== null && <span className="tnum">{debt.interest_rate_ea}% E.A.</span>}
          {debt.monthly_payment !== null && (
            <span className="tnum">Cuota {formatCOP(debt.monthly_payment)}</span>
          )}
          {debt.payment_day !== null && <span>Vence el día {debt.payment_day}</span>}
          {debt.end_date && (
            <span>Hasta {format(parseISO(debt.end_date), 'MMM yyyy', { locale: es })}</span>
          )}
        </div>
        {debt.notes && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{debt.notes}</p>
        )}
      </section>

      {interestSaved > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 px-4 py-3">
          <PiggyBank className="size-5 shrink-0 text-emerald-500" />
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Tus abonos a capital te ahorran{' '}
            <span className="tnum font-bold">{formatCOP(Math.round(interestSaved))}</span> en
            intereses (estimado).
          </p>
        </div>
      )}

      {!paidOff && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSheet('cuota')}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold shadow-sm transition active:scale-95 dark:bg-card"
          >
            <Receipt className="size-4 text-zinc-400" /> Registrar cuota
          </button>
          <button
            type="button"
            onClick={() => setSheet('abono_capital')}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 transition active:scale-95"
          >
            <PiggyBank className="size-4" /> Abonar a capital
          </button>
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Historial de pagos
        </h2>
        {payments.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-zinc-500 shadow-sm dark:bg-card dark:text-zinc-400">
            Sin pagos registrados. La primera cuota o abono aparecerá aquí.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-card">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-800"
              >
                <div>
                  <p className="text-sm font-medium">{KIND_LABEL[p.kind]}</p>
                  <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
                    {format(parseISO(p.paid_at), "d 'de' MMMM yyyy", { locale: es })}
                  </p>
                </div>
                <p
                  className={`tnum text-sm font-bold ${
                    p.kind === 'abono_capital' ? 'text-emerald-400' : ''
                  }`}
                >
                  {formatCOP(p.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {sheet && (
        <AmountDateSheet
          title={sheet === 'cuota' ? `Registrar cuota — ${debt.name}` : `Abono a capital — ${debt.name}`}
          confirmLabel={sheet === 'cuota' ? 'Registrar cuota' : 'Registrar abono'}
          initialAmount={sheet === 'cuota' ? debt.monthly_payment : null}
          accounts={accounts}
          initialAccountId={defaultAccount(accounts)?.id ?? null}
          saving={registerPayment.isPending}
          onCancel={() => setSheet(null)}
          onConfirm={({ amount, date, accountId }) =>
            registerPayment.mutate({ amount, date, kind: sheet, accountId })
          }
        />
      )}

      {editing && (
        <DebtFormSheet
          debt={debt}
          hasPayments={payments.length > 0}
          saving={edit.isPending || archive.isPending || remove.isPending}
          onCancel={() => setEditing(false)}
          onSave={(input) => edit.mutate(input)}
          onArchive={() => archive.mutate()}
          onDelete={() => remove.mutate()}
        />
      )}

      {celebrating && (
        <Celebration message={`¡${debt.name} saldada!`} onDone={() => setCelebrating(false)} />
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/deudas"
      aria-label="Volver a deudas"
      className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-card"
    >
      <ArrowLeft className="size-5" />
    </Link>
  )
}
