import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Star } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { useCategories } from '../hooks/useCategories'
import EmojiPicker from '../components/EmojiPicker'
import type { Category, CategoryType } from '../types'

interface CategoryForm {
  name: string
  icon: string
  color: string
  type: CategoryType
  is_frequent: boolean
}

export default function CategoriesPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const { data: categories = [], isLoading } = useCategories()
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['categories'] })

  const save = useMutation({
    mutationFn: async (form: CategoryForm) => {
      if (!session) return
      if (editing === 'new') {
        const maxOrder = Math.max(
          0,
          ...categories.filter((c) => c.type === form.type).map((c) => c.sort_order),
        )
        const { error } = await supabase
          .from('categories')
          .insert({ user_id: session.user.id, ...form, sort_order: maxOrder + 1 })
        if (error) throw error
      } else if (editing) {
        const { error } = await supabase.from('categories').update(form).eq('id', editing.id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      setEditing(null)
      invalidate()
    },
  })

  const setArchived = useMutation({
    mutationFn: async ({ category, value }: { category: Category; value: boolean }) => {
      const { error } = await supabase
        .from('categories')
        .update({ archived: value, is_frequent: value ? false : category.is_frequent })
        .eq('id', category.id)
      if (error) throw error
    },
    onSuccess: () => {
      setEditing(null)
      invalidate()
    },
  })

  const toggleFrequent = useMutation({
    mutationFn: async (c: Category) => {
      const { error } = await supabase
        .from('categories')
        .update({ is_frequent: !c.is_frequent })
        .eq('id', c.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  // reordenar: intercambia sort_order con el vecino dentro del mismo tipo
  const move = useMutation({
    mutationFn: async ({ list, index, dir }: { list: Category[]; index: number; dir: -1 | 1 }) => {
      const a = list[index]
      const b = list[index + dir]
      if (!a || !b) return
      const { error: e1 } = await supabase
        .from('categories')
        .update({ sort_order: b.sort_order })
        .eq('id', a.id)
      if (e1) throw e1
      const { error: e2 } = await supabase
        .from('categories')
        .update({ sort_order: a.sort_order })
        .eq('id', b.id)
      if (e2) throw e2
    },
    onSuccess: invalidate,
  })

  const groups: [string, CategoryType][] = [
    ['Gastos', 'expense'],
    ['Ingresos', 'income'],
  ]
  const archived = categories.filter((c) => c.archived)

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
          <h1 className="text-lg font-bold">Categorías</h1>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-500 transition active:scale-95"
        >
          <Plus className="size-3.5" /> Nueva
        </button>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Las marcadas con ⭐ aparecen como botones grandes en el registro rápido.
      </p>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-zinc-500">Cargando…</p>
      ) : (
        <>
          {groups.map(([label, type]) => {
            const list = categories
              .filter((c) => c.type === type && !c.archived)
              .sort((a, b) => a.sort_order - b.sort_order)
            return (
              <section key={type}>
                <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {label}
                </h2>
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-card">
                  {list.map((c, i) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5 last:border-b-0 dark:border-zinc-800"
                    >
                      <button
                        type="button"
                        onClick={() => setEditing(c)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-full text-base"
                          style={{ backgroundColor: `${c.color}26` }}
                        >
                          {c.icon}
                        </span>
                        <span className="truncate text-sm font-medium">{c.name}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={c.is_frequent ? 'Quitar de frecuentes' : 'Marcar frecuente'}
                        onClick={() => toggleFrequent.mutate(c)}
                        className="rounded-full p-1.5 transition active:scale-95"
                      >
                        <Star
                          className={`size-4 ${
                            c.is_frequent ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 dark:text-zinc-600'
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        aria-label="Subir"
                        disabled={i === 0 || move.isPending}
                        onClick={() => move.mutate({ list, index: i, dir: -1 })}
                        className="rounded-full p-1.5 text-zinc-400 transition active:scale-95 disabled:opacity-30"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Bajar"
                        disabled={i === list.length - 1 || move.isPending}
                        onClick={() => move.mutate({ list, index: i, dir: 1 })}
                        className="rounded-full p-1.5 text-zinc-400 transition active:scale-95 disabled:opacity-30"
                      >
                        <ArrowDown className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}

          {archived.length > 0 && (
            <section>
              <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Archivadas
              </h2>
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-card">
                {archived.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setEditing(c)}
                    className="flex w-full items-center gap-3 border-b border-zinc-100 px-3 py-2.5 text-left opacity-60 last:border-b-0 dark:border-zinc-800"
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-base"
                      style={{ backgroundColor: `${c.color}26` }}
                    >
                      {c.icon}
                    </span>
                    <span className="truncate text-sm font-medium">{c.name}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {editing && (
        <CategoryFormSheet
          category={editing === 'new' ? null : editing}
          saving={save.isPending || setArchived.isPending}
          onCancel={() => setEditing(null)}
          onSave={(form) => save.mutate(form)}
          onArchive={
            editing === 'new'
              ? undefined
              : (value) => setArchived.mutate({ category: editing, value })
          }
        />
      )}
    </div>
  )
}

function CategoryFormSheet({
  category,
  saving,
  onCancel,
  onSave,
  onArchive,
}: {
  category: Category | null
  saving: boolean
  onCancel: () => void
  onSave: (form: CategoryForm) => void
  onArchive?: (value: boolean) => void
}) {
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? '📦')
  const [color, setColor] = useState(category?.color ?? '#71717a')
  const [type, setType] = useState<CategoryType>(category?.type ?? 'expense')
  const [isFrequent, setIsFrequent] = useState(category?.is_frequent ?? false)

  const valid = name.trim().length > 0

  return (
    <div className="sheet-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onCancel}>
      <div
        className="sheet-panel w-full max-w-md rounded-t-3xl bg-white p-5 pb-safe dark:bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold">{category ? 'Editar categoría' : 'Nueva categoría'}</h2>

        <div className="mt-4 flex flex-col gap-3">
          {!category && (
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
                  onClick={() => setType(value)}
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
          )}

          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Nombre
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mascotas"
              className="rounded-xl bg-zinc-100 px-3 py-2.5 text-sm text-zinc-900 outline-none dark:bg-card-hover dark:text-zinc-100"
            />
          </label>

          <EmojiPicker value={icon} onChange={setIcon} />

          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Color
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-11 w-full rounded-xl bg-zinc-100 px-1 dark:bg-card-hover"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isFrequent}
              onChange={(e) => setIsFrequent(e.target.checked)}
              className="size-4 accent-emerald-500"
            />
            Frecuente (botón grande en el registro rápido)
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
                icon: icon.trim() || '📦',
                color,
                type,
                is_frequent: isFrequent,
              })
            }
            className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 transition active:scale-95 disabled:opacity-40"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>

        {category && onArchive && (
          <button
            type="button"
            disabled={saving}
            onClick={() => onArchive(!category.archived)}
            className="mt-3 w-full rounded-xl bg-zinc-100 py-2.5 text-xs font-semibold text-zinc-500 transition active:scale-95 dark:bg-card-hover dark:text-zinc-400"
          >
            {category.archived
              ? 'Desarchivar'
              : 'Archivar (se oculta; sus movimientos se conservan)'}
          </button>
        )}
      </div>
    </div>
  )
}
