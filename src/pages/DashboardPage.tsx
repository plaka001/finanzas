import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endOfMonth, format, isSameMonth, parseISO, startOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { BarChart3, CalendarPlus, Check, LogOut, Moon, Sun, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { useAuth } from '../auth/AuthProvider'
import { useDarkMode } from '../hooks/useDarkMode'
import { useCategories } from '../hooks/useCategories'
import { useDebts } from '../hooks/useDebts'
import { supabase } from '../lib/supabase'
import { formatCOP, parseAmountInput } from '../lib/format'
import { computeUpcoming, type UpcomingPayment } from '../lib/upcoming'
import { buildDebtSeries } from '../lib/debtSeries'
import { buildIcs, downloadIcs } from '../lib/ics'
import DebtChart from '../components/DebtChart'
import type { DebtPayment, Goal, RecurringPayment, Settings, Transaction } from '../types'

type MonthTx = Pick<Transaction, 'amount' | 'type' | 'category_id' | 'note' | 'occurred_at'>

export default function DashboardPage() {
  const { session, signOut } = useAuth()
  const { dark, toggle } = useDarkMode()
  const queryClient = useQueryClient()
  const { data: categories = [] } = useCategories()
  const { data: debts = [] } = useDebts()
  const [calendarSheet, setCalendarSheet] = useState(false)

  const today = new Date()
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')
  const monthLabel = format(today, 'MMMM yyyy', { locale: es })
  const prevMonth = subMonths(today, 1)
  const prevStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd')
  const prevEnd = format(endOfMonth(prevMonth), 'yyyy-MM-dd')

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

  const { data: prevMonthTx = [] } = useQuery({
    queryKey: ['month-summary', prevStart],
    queryFn: async (): Promise<MonthTx[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, type, category_id, note, occurred_at')
        .gte('occurred_at', prevStart)
        .lte('occurred_at', prevEnd)
      if (error) throw error
      return data
    },
  })

  const { data: allDebtPayments = [] } = useQuery({
    queryKey: ['debt-payments', 'all'],
    queryFn: async (): Promise<Pick<DebtPayment, 'amount' | 'paid_at'>[]> => {
      const { data, error } = await supabase.from('debt_payments').select('amount, paid_at')
      if (error) throw error
      return data
    },
  })

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase.from('goals').select('*').order('sort_order')
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

  const debtSeries = useMemo(() => {
    const debtFreeGoal = goals.find((g) => g.is_debt_free_goal)
    const target = debtFreeGoal?.deadline ? parseISO(debtFreeGoal.deadline) : new Date(2027, 2, 31)
    return buildDebtSeries(debts, allDebtPayments, target)
  }, [debts, allDebtPayments, goals])
  const totalDebt = debts.reduce((sum, d) => sum + d.current_balance, 0)

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

  // Fugas: Suscripciones + Comida fuera/Rappi, este mes vs el anterior
  const leaks = useMemo(() => {
    const leakIds = new Set(
      categories
        .filter((c) => c.name === 'Suscripciones' || c.name === 'Comida fuera/Rappi')
        .map((c) => c.id),
    )
    const sumLeaks = (txs: MonthTx[]) =>
      txs
        .filter((t) => t.type === 'expense' && t.category_id && leakIds.has(t.category_id))
        .reduce((sum, t) => sum + t.amount, 0)
    return { current: sumLeaks(monthTx), previous: sumLeaks(prevMonthTx) }
  }, [categories, monthTx, prevMonthTx])

  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start">
      <header className="flex items-center justify-between md:col-span-2">
        <h1 className="text-lg font-bold capitalize">{monthLabel}</h1>
        <div className="flex gap-1">
          <Link
            to="/reportes"
            aria-label="Reportes"
            className="rounded-full p-2.5 text-zinc-500 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-card"
          >
            <BarChart3 className="size-5" />
          </Link>
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

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-card md:col-span-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
          Excedente del mes
        </p>
        <p className={`tnum mt-2 text-4xl font-bold ${surplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {formatCOP(surplus)}
        </p>
        <div className="mt-4 flex gap-6 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span className="flex flex-col gap-0.5">
            Ingresos <span className="tnum text-sm font-bold text-emerald-400">{formatCOP(income)}</span>
          </span>
          <span className="flex flex-col gap-0.5">
            Gastos <span className="tnum text-sm font-bold text-rose-400">{formatCOP(expense)}</span>
          </span>
        </div>
      </section>

      {overBudget && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/15 px-3 py-2.5 text-xs font-medium text-amber-600 dark:text-amber-400 md:col-span-2">
          <TriangleAlert className="size-4 shrink-0" />
          Los gastos del mes ({formatCOP(expense)}) superan el presupuesto esencial ({formatCOP(budget)}).
        </div>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Próximos pagos (7 días)
          </h2>
          <button
            type="button"
            onClick={() => setCalendarSheet(true)}
            className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-card"
          >
            <CalendarPlus className="size-4" /> Calendario
          </button>
        </div>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-zinc-500 shadow-sm dark:bg-card dark:text-zinc-400">
            Semana libre de pagos. El excedente puede ir a un abono de capital.
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

      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-card md:col-span-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Progreso a deuda cero
          </h2>
          <p className="tnum text-sm font-bold text-rose-400">{formatCOP(totalDebt)}</p>
        </div>
        {totalDebt === 0 && allDebtPayments.length === 0 ? (
          <p className="py-4 text-sm text-zinc-500 dark:text-zinc-400">
            Sin deudas activas. El panorama está limpio.
          </p>
        ) : (
          <>
            <DebtChart data={debtSeries} />
            <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
              Línea sólida: saldo real · punteada: proyección a{' '}
              {goals.find((g) => g.is_debt_free_goal)?.deadline
                ? format(parseISO(goals.find((g) => g.is_debt_free_goal)!.deadline!), 'MMM yyyy', { locale: es })
                : 'mar 2027'}
            </p>
          </>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-card">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Gastos del mes por categoría
        </h2>
        {topCategories.length === 0 ? (
          <p className="py-4 text-sm text-zinc-500 dark:text-zinc-400">
            Sin gastos este mes. Registra el primero con el botón ➕.
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

      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-card">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Fugas del mes
        </h2>
        <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
          Suscripciones + comida fuera/Rappi
        </p>
        <p className="tnum mt-2 text-2xl font-bold">{formatCOP(leaks.current)}</p>
        {leaks.previous > 0 ? (
          <p
            className={`mt-1 flex items-center gap-1 text-xs font-medium ${
              leaks.current > leaks.previous ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {leaks.current > leaks.previous ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            <span className="tnum">
              {leaks.current > leaks.previous ? '+' : '−'}
              {formatCOP(Math.abs(leaks.current - leaks.previous))}
            </span>
            <span className="font-normal text-zinc-500 dark:text-zinc-400">vs mes anterior ({formatCOP(leaks.previous)})</span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Sin referencia del mes anterior todavía.
          </p>
        )}
      </section>

      {calendarSheet && (
        <div
          className="sheet-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setCalendarSheet(false)}
        >
          <div
            className="sheet-panel w-full max-w-md rounded-t-3xl bg-white p-5 pb-safe dark:bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold">Recordatorios en tu calendario</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Descarga un archivo .ics con tus pagos activos. Cada evento alerta el día anterior
              y a las 8 AM del día del pago.
            </p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
              <li>Toca «Descargar .ics».</li>
              <li>En el iPhone, abre el archivo desde Descargas (app Archivos).</li>
              <li>Toca «Añadir todos» y elige tu calendario.</li>
              <li>Si tus pagos cambian, descarga e importa de nuevo.</li>
            </ol>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setCalendarSheet(false)}
                className="flex-1 rounded-xl bg-zinc-200 py-3 text-sm font-semibold text-zinc-700 transition active:scale-95 dark:bg-card-hover dark:text-zinc-200"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => downloadIcs(buildIcs(recurring))}
                className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 transition active:scale-95"
              >
                Descargar .ics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
