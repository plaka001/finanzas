import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addMonths, endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCOP } from '../lib/format'
import { deleteTransaction, deleteTransfer, updateTransaction } from '../lib/transactions'
import { useCategories } from '../hooks/useCategories'
import { useAccounts } from '../hooks/useAccounts'
import TransactionRow from '../components/TransactionRow'
import EditTransactionSheet from '../components/EditTransactionSheet'
import type { Category, Transaction } from '../types'

const PAGE_SIZE = 50

type TypeFilter = 'all' | 'expense' | 'income'

interface Filters {
  from: string
  to: string
  type: TypeFilter
  categoryId: string
  accountId: string
  search: string
}

function filteredQuery(columns: string, f: Filters) {
  let q = supabase
    .from('transactions')
    .select(columns)
    .gte('occurred_at', f.from)
    .lte('occurred_at', f.to)
  if (f.type !== 'all') q = q.eq('type', f.type)
  if (f.categoryId) q = q.eq('category_id', f.categoryId)
  if (f.accountId) q = q.eq('account_id', f.accountId)
  if (f.search) q = q.ilike('note', `%${f.search}%`)
  return q
}

export default function TransactionsPage() {
  const queryClient = useQueryClient()
  const { data: categories = [] } = useCategories()
  const { data: accounts = [] } = useAccounts()

  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const filters: Filters = {
    from: format(month, 'yyyy-MM-dd'),
    to: format(endOfMonth(month), 'yyyy-MM-dd'),
    type: typeFilter,
    categoryId,
    accountId,
    search,
  }
  const filterKey = [filters.from, filters.type, filters.categoryId, filters.accountId, filters.search]

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['transactions', ...filterKey],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<Transaction[]> => {
      const { data, error } = await filteredQuery('*', filters)
        .order('occurred_at', { ascending: false })
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1)
      if (error) throw error
      return data as unknown as Transaction[]
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.flat().length : undefined,
  })

  const { data: totals } = useQuery({
    queryKey: ['transactions', 'totals', ...filterKey],
    queryFn: async () => {
      const { data, error } = await filteredQuery('amount, type, transfer_id', filters)
      if (error) throw error
      let income = 0
      let expense = 0
      for (const t of data as unknown as Pick<Transaction, 'amount' | 'type' | 'transfer_id'>[]) {
        if (t.transfer_id) continue // transferencias fuera de los totales
        if (t.type === 'income') income += t.amount
        else expense += t.amount
      }
      return { income, expense }
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['month-summary'] })
    queryClient.invalidateQueries({ queryKey: ['account-activity'] })
    queryClient.invalidateQueries({ queryKey: ['debts'] })
  }

  const deleteMutation = useMutation({
    mutationFn: (t: Transaction) =>
      t.transfer_id ? deleteTransfer(t.transfer_id) : deleteTransaction(t.id),
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; patch: Parameters<typeof updateTransaction>[1] }) =>
      updateTransaction(vars.id, vars.patch),
    onSuccess: () => {
      invalidate()
      setEditing(null)
    },
  })

  const transactions = useMemo(() => data?.pages.flat() ?? [], [data])

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of transactions) {
      const list = map.get(t.occurred_at)
      if (list) list.push(t)
      else map.set(t.occurred_at, [t])
    }
    return [...map.entries()]
  }, [transactions])

  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const balance = (totals?.income ?? 0) - (totals?.expense ?? 0)
  const visibleCategories = categories.filter(
    (c) => !c.archived && (typeFilter === 'all' || c.type === typeFilter),
  )
  const visibleAccounts = accounts.filter((a) => !a.archived)

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Movimientos</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-card"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="w-28 text-center text-sm font-semibold capitalize">
            {format(month, 'MMM yyyy', { locale: es })}
          </span>
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-card"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-3 text-center shadow-sm dark:bg-card">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Ingresos</p>
          <p className="tnum text-sm font-bold text-emerald-400">{formatCOP(totals?.income ?? 0)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Gastos</p>
          <p className="tnum text-sm font-bold text-rose-400">{formatCOP(totals?.expense ?? 0)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Balance</p>
          <p className={`tnum text-sm font-bold ${balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCOP(balance)}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-white px-3 shadow-sm dark:bg-card">
          <Search className="size-4 shrink-0 text-zinc-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nota…"
            className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-zinc-400"
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Filtrar por categoría"
          className="max-w-32 rounded-xl bg-white px-2 text-sm shadow-sm outline-none dark:bg-card"
        >
          <option value="">Todas</option>
          {visibleCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>

      {visibleAccounts.length > 0 && (
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          aria-label="Filtrar por cuenta"
          className="rounded-xl bg-white px-3 py-2.5 text-sm shadow-sm outline-none dark:bg-card"
        >
          <option value="">Todas las cuentas</option>
          {visibleAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.icon} {a.name}
            </option>
          ))}
        </select>
      )}

      <div className="flex rounded-xl bg-zinc-200 p-1 text-xs font-semibold dark:bg-card">
        {(
          [
            ['all', 'Todos'],
            ['expense', 'Gastos'],
            ['income', 'Ingresos'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTypeFilter(value)
              setCategoryId('')
            }}
            className={`flex-1 rounded-lg py-1.5 transition ${
              typeFilter === value
                ? 'bg-white shadow-sm dark:bg-card-hover'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-zinc-500">Cargando…</p>
      ) : groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nada registrado en este período. El botón ➕ registra el primero.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-1.5 text-xs font-semibold capitalize text-zinc-500 dark:text-zinc-400">
                {format(parseISO(day), "EEEE d 'de' MMMM", { locale: es })}
              </h2>
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-card">
                {items.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    category={t.category_id ? categoryById.get(t.category_id) : undefined}
                    account={t.account_id ? accountById.get(t.account_id) : undefined}
                    onEdit={() => {
                      if (t.transfer_id) {
                        if (confirm('Las transferencias no se editan. ¿Eliminar la transferencia completa (salida y entrada)?'))
                          deleteMutation.mutate(t)
                      } else {
                        setEditing(t)
                      }
                    }}
                    onDelete={() => {
                      const msg = t.transfer_id
                        ? '¿Eliminar la transferencia completa (salida y entrada)?'
                        : '¿Eliminar este movimiento?'
                      if (confirm(msg)) deleteMutation.mutate(t)
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
          <div ref={sentinelRef} className="h-1" />
          {isFetchingNextPage && (
            <p className="py-2 text-center text-xs text-zinc-500">Cargando más…</p>
          )}
        </div>
      )}

      {editing && (
        <EditTransactionSheet
          transaction={editing}
          categories={categories as Category[]}
          accounts={accounts}
          saving={updateMutation.isPending}
          onCancel={() => setEditing(null)}
          onSave={(patch) => updateMutation.mutate({ id: editing.id, patch })}
        />
      )}
    </div>
  )
}
