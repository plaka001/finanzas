import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endOfMonth, format, isSameMonth, parseISO, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, LogOut, Moon, Sun, TriangleAlert } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { useAuth } from '../auth/AuthProvider'
import { useDarkMode } from '../hooks/useDarkMode'
import { useCategories } from '../hooks/useCategories'
import { supabase } from '../lib/supabase'
import { formatCOP, parseAmountInput } from '../lib/format'
import { computeUpcoming, type UpcomingPayment } from '../lib/upcoming'
import type { DebtPayment, RecurringPayment, Settings, Transaction } from '../types'

type MonthTx = Pick<Transaction, 'amount' | 'type' | 'category_id' | 'note' | 'occurred_at'>

export default function DashboardPage() {
  const { session, signOut } = useAuth()
  const { dark, toggle } = useDarkMode()
  const queryClient = useQueryClient()
  const { data: categories = [] } = useCategories()

  const today = new Date()
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')
  const monthLabel = format(today, 'MMMM yyyy', { locale: es })

  const { data: monthTx = [] } = useQuery({
    queryKey: ['month-summary', monthStart],
    queryFn: async (): Promise<MonthTx[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, type, category_id, note, occurred_at')
        .gte('occurred_at', monthStart)
        .lte('occurred_at', monthEnd)
      if (error) throw error
      return data
    },
  })

  const { data: recurring = [] } = useQuery({
    queryKey: ['recurring-payments'],
    queryFn: async (): Promise<RecurringPayment[]> => {
      const { data, error } = await supabase
        .from('recurring_payments')
        .select('*')
        .eq('active', true)
      if (error) throw error
      return data
    },
  })

  const { data: monthDebtPayments = [] } = useQuery({
    queryKey: ['debt-payments', monthStart],
    queryFn: async (): Promise<Pick<DebtPayment, 'debt_id' | 'paid_at'>[]> => {
      const { data, error } = await supabase
        .from('debt_payments')
        .select('debt_id, paid_at')
        .gte('paid_at', monthStart)
      if (error) throw error
      return data
    },
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<Settings | null> => {
      const { data, error } = await supabase.from('settings').select('*').maybeSingle()
      if (error) throw error
      return data
    },
  })

  const { income, expense } = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of monthTx) {
      if (t.type === 'income') income += t.amount
      else expense += t.amount
    }
    return { income, expense }
  }, [monthTx])
  const surplus = income - expense

  const topCategories = useMemo(() => {
    const sums = new Map<string, number>()
    for (const t of monthTx) {
      if (t.type !== 'expense' || !t.category_id) continue
      sums.set(t.category_id, (sums.get(t.category_id) ?? 0) + t.amount)
    }
    return [...sums.entries()]
      .map(([id, total]) => {
        const cat = categories.find((c) => c.id === id)
        return { id, total, name: cat?.name ?? 'Sin categoría', icon: cat?.icon ?? '📦', color: cat?.color ?? '#71717a' }
      })
      .sort((a, b) => b.total - a.total)
  }, [monthTx, categories])

  const upcoming = useMemo(() => computeUpcoming(recurring, new Date()), [recurring])

  function isPaid({ payment, due }: UpcomingPayment): boolean {
    if (payment.debt_id) {
      return monthDebtPayments.some(
        (dp) => dp.debt_id === payment.debt_id && isSameMonth(parseISO(dp.paid_at), due),
      )
    }
    return monthTx.some(
      (t) => t.note === payment.name && isSameMonth(parseISO(t.occurred_at), due),
    )
  }

  const markPaid = useMutation({
    mutationFn: async (item: UpcomingPayment) => {
      if (!session) return
      let amount = item.payment.amount
      if (!amount) {
        const raw = prompt(`¿Cuánto pagaste de "${item.payment.name}"?`)
        if (!raw) return
        amount = parseAmountInput(raw)
        if (amount <= 0) return
      }
      const paidAt = format(new Date(), 'yyyy-MM-dd')
      if (item.payment.debt_id) {
        const { error } = await supabase.from('debt_payments').insert({
          user_id: session.user.id,
          debt_id: item.payment.debt_id,
          amount,
          kind: 'cuota',
          paid_at: paidAt,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.from('transactions').insert({
          user_id: session.user.id,
          amount,
          type: 'expense',
          category_id: item.payment.category_id,
          note: item.payment.name,
          occurred_at: paidAt,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['month-summary'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['debt-payments'] })
      queryClient.invalidateQueries({ queryKey: ['debts'] })
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })

  const budget = settings?.monthly_essential_budget ?? 0
  const overBudget = budget > 0 && expense > budget

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold capitalize">{monthLabel}</h1>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={toggle}
            aria-label="Cambiar tema"
            className="rounded-full p-2.5 text-zinc-500 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-card"
          >
            {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>
          <button
            type="button"
            onClick={signOut}
            aria-label="Cerrar sesión"
            className="rounded-full p-2.5 text-zinc-500 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-card"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-card">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Excedente del mes</p>
        <p className={`tnum mt-1 text-3xl font-bold ${surplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {formatCOP(surplus)}
        </p>
        <div className="mt-3 flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            Ingresos <span className="tnum font-semibold text-emerald-400">{formatCOP(income)}</span>
          </span>
          <span>
            Gastos <span className="tnum font-semibold text-rose-400">{formatCOP(expense)}</span>
          </span>
        </div>
      </section>

      {overBudget && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/15 px-3 py-2.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          <TriangleAlert className="size-4 shrink-0" />
          Los gastos del mes ({formatCOP(expense)}) superan el presupuesto esencial ({formatCOP(budget)}).
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Próximos pagos (7 días)
        </h2>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-zinc-500 shadow-sm dark:bg-card dark:text-zinc-400">
            Nada por pagar en los próximos 7 días. 🎉
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-card">
            {upcoming.map((item) => {
              const paid = isPaid(item)
              const urgent = item.daysLeft <= 1
              return (
                <div
                  key={item.payment.id}
                  className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${paid ? 'text-zinc-400 line-through dark:text-zinc-500' : ''}`}>
                      {item.payment.name}
                    </p>
                    <p className="tnum text-xs text-zinc-500 dark:text-zinc-400">
                      {item.payment.amount ? formatCOP(item.payment.amount) : 'Monto variable'} ·{' '}
                      {format(item.due, 'd MMM', { locale: es })}
                    </p>
                  </div>
                  {paid ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                      <Check className="size-4" /> Pagado
                    </span>
                  ) : (
                    <>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          urgent
                            ? 'bg-rose-500/15 text-rose-500'
                            : 'bg-zinc-200 text-zinc-600 dark:bg-card-hover dark:text-zinc-300'
                        }`}
                      >
                        {item.daysLeft === 0 ? 'Hoy' : item.daysLeft === 1 ? 'Mañana' : `${item.daysLeft} días`}
                      </span>
                      <button
                        type="button"
                        disabled={markPaid.isPending}
                        onClick={() => markPaid.mutate(item)}
                        className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-500 transition active:scale-95 disabled:opacity-40"
                      >
                        Pagar
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-card">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Gastos del mes por categoría
        </h2>
        {topCategories.length === 0 ? (
          <p className="py-4 text-sm text-zinc-500 dark:text-zinc-400">
            Aún no hay gastos este mes.
          </p>
        ) : (
          <>
            <div className="relative mx-auto h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topCategories}
                    dataKey="total"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {topCategories.map((c) => (
                      <Cell key={c.id} fill={c.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Total
                </span>
                <span className="tnum text-sm font-bold">{formatCOP(expense)}</span>
              </div>
            </div>
            <ul className="mt-2 flex flex-col gap-2">
              {topCategories.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="min-w-0 flex-1 truncate">
                    {c.icon} {c.name}
                  </span>
                  <span className="tnum font-semibold">{formatCOP(c.total)}</span>
                  <span className="tnum w-10 text-right text-xs text-zinc-500 dark:text-zinc-400">
                    {expense > 0 ? Math.round((c.total / expense) * 100) : 0}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
