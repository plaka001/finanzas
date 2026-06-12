import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowLeft, ArrowRightLeft, Plus } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { formatCOP, parseAmountInput } from '../lib/format'
import { saveTransfer } from '../lib/transfers'
import { accountBalance, useAccountActivity, useAccounts, type AccountActivity } from '../hooks/useAccounts'
import { useDebts } from '../hooks/useDebts'
import type { Account, AccountType } from '../types'

const TYPE_LABEL: Record<AccountType, string> = {
  ahorros: 'Ahorros',
  corriente: 'Corriente',
  tarjeta_credito: 'Tarjeta de crédito',
  efectivo: 'Efectivo',
  otro: 'Otra',
}

interface AccountForm {
  name: string
  type: AccountType
  icon: string
  color: string
  initial_balance: number
  is_default: boolean
  debt_id: string | null
}

export default function AccountsPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const { data: accounts = [], isLoading } = useAccounts()
  const { data: activity } = useAccountActivity()
  const { data: debts = [] } = useDebts()

  const [editing, setEditing] = useState<Account | 'new' | null>(null)
  const [transferring, setTransferring] = useState(false)

  const active = accounts.filter((a) => !a.archived)
  const archived = accounts.filter((a) => a.archived)
  const available = active
    .filter((a) => a.type !== 'tarjeta_credito')
    .reduce((sum, a) => sum + accountBalance(a, activity), 0)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.invalidateQueries({ queryKey: ['account-activity'] })
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['month-summary'] })
    queryClient.invalidateQueries({ queryKey: ['debts'] })
    queryClient.invalidateQueries({ queryKey: ['debt-payments'] })
    queryClient.invalidateQueries({ queryKey: ['goals'] })
  }

  const save = useMutation({
    mutationFn: async (form: AccountForm) => {
      if (!session) return
      // solo una default: desmarcar la actual antes de marcar la nueva
      if (form.is_default) {
        const { error } = await supabase
          .from('accounts')
          .update({ is_default: false })
          .eq('is_default', true)
        if (error) throw error
      }
      const row = {
        name: form.name.trim(),
        type: form.type,
        icon: form.icon.trim() || '💳',
        color: form.color,
        initial_balance: form.initial_balance,
        is_default: form.is_default,
        debt_id: form.type === 'tarjeta_credito' ? form.debt_id : null,
      }
      if (editing === 'new') {
        const { error } = await supabase
          .from('accounts')
          .insert({ user_id: session.user.id, ...row })
        if (error) throw error
      } else if (editing) {
        const { error } = await supabase.from('accounts').update(row).eq('id', editing.id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      setEditing(null)
      invalidate()
    },
  })

  const setArchived = useMutation({
    mutationFn: async ({ account, value }: { account: Account; value: boolean }) => {
      const { error } = await supabase
        .from('accounts')
        .update({ archived: value, is_default: value ? false : account.is_default })
        .eq('id', account.id)
      if (error) throw error
    },
    onSuccess: () => {
      setEditing(null)
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: async (account: Account) => {
      const { error } = await supabase.from('accounts').delete().eq('id', account.id)
      if (error) throw error
    },
    onSuccess: () => {
      setEditing(null)
      invalidate()
    },
  })

  const transfer = useMutation({
    mutationFn: saveTransfer,
    onSuccess: () => {
      setTransferring(false)
      invalidate()
    },
  })

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
          <h1 className="text-lg font-bold">Cuentas</h1>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-500 transition active:scale-95"
        >
          <Plus className="size-3.5" /> Nueva cuenta
        </button>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
          Total disponible
        </p>
        <p className={`tnum mt-2 text-4xl font-bold ${available >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {formatCOP(available)}
        </p>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Suma de cuentas activas, sin tarjetas de crédito.
        </p>
      </section>

      <button
        type="button"
        onClick={() => setTransferring(true)}
        disabled={active.length < 2}
        className="flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold shadow-sm transition active:scale-95 disabled:opacity-40 dark:bg-card"
      >
        <ArrowRightLeft className="size-4 text-zinc-400" /> Transferir entre cuentas
      </button>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-zinc-500">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              balance={accountBalance(a, activity)}
              debtBalance={a.debt_id ? debts.find((d) => d.id === a.debt_id)?.current_balance ?? null : null}
              onEdit={() => setEditing(a)}
            />
          ))}
          {archived.length > 0 && (
            <>
              <h2 className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Archivadas
              </h2>
              {archived.map((a) => (
                <AccountCard
                  key={a.id}
                  account={a}
                  balance={accountBalance(a, activity)}
                  debtBalance={null}
                  onEdit={() => setEditing(a)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {editing && (
        <AccountFormSheet
          account={editing === 'new' ? null : editing}
          debts={debts.filter((d) => !d.archived)}
          hasMovements={editing !== 'new' && (activity?.get(editing.id)?.movements ?? 0) > 0}
          saving={save.isPending || setArchived.isPending || remove.isPending}
          onCancel={() => setEditing(null)}
          onSave={(form) => save.mutate(form)}
          onArchive={
            editing === 'new'
              ? undefined
              : (value) => setArchived.mutate({ account: editing, value })
          }
          onDelete={editing === 'new' ? undefined : () => remove.mutate(editing)}
        />
      )}

      {transferring && (
        <TransferSheet
          accounts={active}
          activity={activity}
          saving={transfer.isPending}
          onCancel={() => setTransferring(false)}
          onConfirm={(input) => {
            if (!session) return
            transfer.mutate({ user_id: session.user.id, ...input })
          }}
        />
      )}
    </div>
  )
}

function AccountCard({
  account,
  balance,
  debtBalance,
  onEdit,
}: {
  account: Account
  balance: number
  debtBalance: number | null
  onEdit: () => void
}) {
  const isCard = account.type === 'tarjeta_credito'
  return (
    <button
      type="button"
      onClick={onEdit}
      className={`flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition active:scale-[0.99] dark:bg-card ${
        account.archived ? 'opacity-60' : ''
      }`}
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-xl"
        style={{ backgroundColor: `${account.color}26` }}
      >
        {account.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{account.name}</span>
          {account.is_default && (
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
              Default
            </span>
          )}
        </span>
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
          {TYPE_LABEL[account.type]}
        </span>
      </span>
      {isCard && debtBalance !== null ? (
        <span className="text-right">
          <span className="tnum block text-sm font-bold text-rose-400">{formatCOP(debtBalance)}</span>
          <span className="block text-[10px] text-zinc-500 dark:text-zinc-400">deuda</span>
        </span>
      ) : (
        <span className={`tnum text-sm font-bold ${balance >= 0 ? '' : 'text-rose-400'}`}>
          {formatCOP(balance)}
        </span>
      )}
    </button>
  )
}

function AccountFormSheet({
  account,
  debts,
  hasMovements,
  saving,
  onCancel,
  onSave,
  onArchive,
  onDelete,
}: {
  account: Account | null
  debts: { id: string; name: string }[]
  hasMovements: boolean
  saving: boolean
  onCancel: () => void
  onSave: (form: AccountForm) => void
  onArchive?: (value: boolean) => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? 'ahorros')
  const [icon, setIcon] = useState(account?.icon ?? '💳')
  const [color, setColor] = useState(account?.color ?? '#34d399')
  const [initialStr, setInitialStr] = useState(
    account && account.initial_balance !== 0 ? String(account.initial_balance) : '',
  )
  const [isDefault, setIsDefault] = useState(account?.is_default ?? false)
  const [debtId, setDebtId] = useState(account?.debt_id ?? '')

  const initialBalance = parseAmountInput(initialStr)
  const valid = name.trim().length > 0

  return (
    <div className="sheet-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onCancel}>
      <div
        className="sheet-panel max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-safe dark:bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold">{account ? 'Editar cuenta' : 'Nueva cuenta'}</h2>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Nombre
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ahorros Bancolombia"
              className="rounded-xl bg-zinc-100 px-3 py-2.5 text-sm text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Tipo
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="rounded-xl bg-zinc-100 px-3 py-2.5 text-sm text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100"
            >
              {(Object.keys(TYPE_LABEL) as AccountType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>

          {type === 'tarjeta_credito' && (
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Deuda vinculada (los gastos con esta TC suben su saldo)
              <select
                value={debtId}
                onChange={(e) => setDebtId(e.target.value)}
                className="rounded-xl bg-zinc-100 px-3 py-2.5 text-sm text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100"
              >
                <option value="">Sin vincular</option>
                {debts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex gap-3">
            <label className="flex w-24 flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Ícono
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="rounded-xl bg-zinc-100 px-3 py-2.5 text-center text-lg outline-none dark:bg-card-hover"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Color
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-11 w-full rounded-xl bg-zinc-100 px-1 dark:bg-card-hover"
              />
            </label>
          </div>

          {type !== 'tarjeta_credito' && (
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Saldo inicial
              <input
                type="text"
                inputMode="numeric"
                value={initialBalance > 0 ? formatCOP(initialBalance) : ''}
                onChange={(e) => setInitialStr(e.target.value)}
                placeholder="$0"
                className="tnum rounded-xl bg-zinc-100 px-3 py-2.5 text-sm font-bold text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100"
              />
            </label>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="size-4 accent-emerald-500"
            />
            Cuenta predeterminada (preseleccionada al registrar)
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
                name,
                type,
                icon,
                color,
                initial_balance: type === 'tarjeta_credito' ? 0 : initialBalance,
                is_default: isDefault,
                debt_id: debtId || null,
              })
            }
            className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 transition active:scale-95 disabled:opacity-40"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>

        {account && (
          <div className="mt-3 flex gap-2">
            {onArchive && (
              <button
                type="button"
                disabled={saving}
                onClick={() => onArchive(!account.archived)}
                className="flex-1 rounded-xl bg-zinc-100 py-2.5 text-xs font-semibold text-zinc-500 transition active:scale-95 dark:bg-card-hover dark:text-zinc-400"
              >
                {account.archived ? 'Desarchivar' : 'Archivar (se oculta de los selectores)'}
              </button>
            )}
            {onDelete && !hasMovements && (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (confirm('¿Eliminar esta cuenta?')) onDelete()
                }}
                className="flex-1 rounded-xl bg-rose-500/10 py-2.5 text-xs font-semibold text-rose-500 transition active:scale-95"
              >
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TransferSheet({
  accounts,
  activity,
  saving,
  onCancel,
  onConfirm,
}: {
  accounts: Account[]
  activity?: Map<string, AccountActivity>
  saving: boolean
  onCancel: () => void
  onConfirm: (input: { from: Account; to: Account; amount: number; date: string }) => void
}) {
  const [fromId, setFromId] = useState(accounts.find((a) => a.is_default)?.id ?? accounts[0]?.id ?? '')
  const [toId, setToId] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  const from = accounts.find((a) => a.id === fromId)
  const to = accounts.find((a) => a.id === toId)
  const amount = parseAmountInput(amountStr)
  const valid = from && to && from.id !== to.id && amount > 0

  return (
    <div className="sheet-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onCancel}>
      <div
        className="sheet-panel w-full max-w-md rounded-t-3xl bg-white p-5 pb-safe dark:bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold">Transferir entre cuentas</h2>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Desde
            <select
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              className="rounded-xl bg-zinc-100 px-3 py-2.5 text-sm text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100"
            >
              {accounts
                .filter((a) => a.type !== 'tarjeta_credito')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon} {a.name} ({formatCOP(accountBalance(a, activity))})
                  </option>
                ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Hacia
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="rounded-xl bg-zinc-100 px-3 py-2.5 text-sm text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100"
            >
              <option value="">Elegir cuenta…</option>
              {accounts
                .filter((a) => a.id !== fromId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon} {a.name}
                  </option>
                ))}
            </select>
          </label>

          {to?.debt_id && (
            <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
              {to.name} está vinculada a una deuda: esta transferencia se registra como pago de la
              deuda desde {from?.name ?? 'la cuenta origen'}.
            </p>
          )}

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
            disabled={!valid || saving}
            onClick={() => valid && onConfirm({ from: from!, to: to!, amount, date })}
            className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 transition active:scale-95 disabled:opacity-40"
          >
            {saving ? 'Transfiriendo…' : 'Transferir'}
          </button>
        </div>
      </div>
    </div>
  )
}
