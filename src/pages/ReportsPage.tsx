import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { formatCOP } from '../lib/format'
import { buildCsv, downloadCsv } from '../lib/csv'
import { useCategories } from '../hooks/useCategories'
import { useAccounts } from '../hooks/useAccounts'
import type { Transaction } from '../types'

type YearTx = Pick<Transaction, 'amount' | 'type' | 'category_id' | 'occurred_at'>

const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export default function ReportsPage() {
  const { data: categories = [] } = useCategories()
  const { data: accounts = [] } = useAccounts()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [categoryId, setCategoryId] = useState('')
  const [exporting, setExporting] = useState(false)

  const { data: yearTx = [], isLoading } = useQuery({
    queryKey: ['transactions', 'year', year],
    queryFn: async (): Promise<YearTx[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, type, category_id, occurred_at')
        .gte('occurred_at', `${year}-01-01`)
        .lte('occurred_at', `${year}-12-31`)
        .is('transfer_id', null) // transferencias fuera de los reportes
      if (error) throw error
      return data
    },
  })

  const monthly = useMemo(() => {
    const rows = MONTH_LABELS.map((label) => ({ label, ingresos: 0, gastos: 0, excedente: 0 }))
    for (const t of yearTx) {
      const m = parseISO(t.occurred_at).getMonth()
      if (t.type === 'income') rows[m].ingresos += t.amount
      else rows[m].gastos += t.amount
    }
    for (const r of rows) r.excedente = r.ingresos - r.gastos
    return rows
  }, [yearTx])

  const expenseCategories = categories.filter((c) => c.type === 'expense' && !c.archived)
  const selectedCategory = expenseCategories.find((c) => c.id === categoryId) ?? expenseCategories[0]

  // sin useMemo: el React Compiler lo memoiza solo
  const categoryMonthly = MONTH_LABELS.map((label) => ({ label, total: 0 }))
  if (selectedCategory) {
    for (const t of yearTx) {
      if (t.category_id !== selectedCategory.id) continue
      categoryMonthly[parseISO(t.occurred_at).getMonth()].total += t.amount
    }
  }

  const totals = useMemo(() => {
    let ingresos = 0
    let gastos = 0
    for (const t of yearTx) {
      if (t.type === 'income') ingresos += t.amount
      else gastos += t.amount
    }
    return { ingresos, gastos, excedente: ingresos - gastos }
  }, [yearTx])

  async function exportCsv() {
    setExporting(true)
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('occurred_at', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      const byId = new Map(categories.map((c) => [c.id, c.name]))
      const accountById = new Map(accounts.map((a) => [a.id, a.name]))
      const rows: string[][] = [
        ['fecha', 'tipo', 'categoria', 'cuenta', 'monto', 'nota'],
        ...(data as Transaction[]).map((t) => [
          t.occurred_at,
          t.transfer_id ? 'transferencia' : t.type === 'expense' ? 'gasto' : 'ingreso',
          t.category_id ? (byId.get(t.category_id) ?? '') : '',
          t.account_id ? (accountById.get(t.account_id) ?? '') : '',
          String(t.amount),
          t.note ?? '',
        ]),
      ]
      downloadCsv(buildCsv(rows), `la-caleta-movimientos-${format(new Date(), 'yyyy-MM-dd')}.csv`)
    } finally {
      setExporting(false)
    }
  }

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
          <h1 className="text-lg font-bold">Reportes</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Año anterior"
            onClick={() => setYear((y) => y - 1)}
            className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-card"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="tnum w-12 text-center text-sm font-semibold">{year}</span>
          <button
            type="button"
            aria-label="Año siguiente"
            onClick={() => setYear((y) => y + 1)}
            className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-card"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-3 text-center shadow-sm dark:bg-card">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Ingresos</p>
          <p className="tnum text-sm font-bold text-emerald-400">{formatCOP(totals.ingresos)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Gastos</p>
          <p className="tnum text-sm font-bold text-rose-400">{formatCOP(totals.gastos)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Excedente</p>
          <p className={`tnum text-sm font-bold ${totals.excedente >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCOP(totals.excedente)}
          </p>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-card">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Ingresos vs gastos · tendencia de excedente
        </h2>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-zinc-500">Cargando…</p>
        ) : (
          <div className="mt-2 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
                <Tooltip
                  formatter={(value, name) => [formatCOP(Number(value)), String(name)]}
                  contentStyle={{
                    backgroundColor: '#131a20',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 12,
                    color: '#e4e4e7',
                  }}
                />
                <Bar dataKey="ingresos" fill="#34d399" radius={[3, 3, 0, 0]} barSize={8} />
                <Bar dataKey="gastos" fill="#fb7185" radius={[3, 3, 0, 0]} barSize={8} />
                <Line
                  type="monotone"
                  dataKey="excedente"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-1 flex gap-4 text-[10px] text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-400" /> Ingresos
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-rose-400" /> Gastos
          </span>
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 rounded bg-blue-400" /> Excedente
          </span>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Evolución por categoría
          </h2>
          <select
            value={selectedCategory?.id ?? ''}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label="Categoría"
            className="max-w-40 rounded-xl bg-zinc-100 px-2 py-1.5 text-xs outline-none dark:bg-card-hover"
          >
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={categoryMonthly} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis hide />
              <Tooltip
                formatter={(value) => [formatCOP(Number(value)), selectedCategory?.name ?? '']}
                contentStyle={{
                  backgroundColor: '#131a20',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 12,
                  color: '#e4e4e7',
                }}
              />
              <Bar
                dataKey="total"
                fill={selectedCategory?.color ?? '#71717a'}
                radius={[3, 3, 0, 0]}
                barSize={12}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <button
        type="button"
        disabled={exporting}
        onClick={exportCsv}
        className="flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold shadow-sm transition active:scale-95 disabled:opacity-40 dark:bg-card"
      >
        <Download className="size-4 text-zinc-400" />
        {exporting ? 'Exportando…' : 'Exportar todos los movimientos (CSV)'}
      </button>
      <p className="-mt-2 text-center text-[10px] text-zinc-500 dark:text-zinc-400">
        Columnas: fecha · tipo · categoría · cuenta · monto · nota{' '}
        {format(new Date(), "'· generado' d MMM yyyy", { locale: es })}
      </p>
    </div>
  )
}
