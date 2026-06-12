// Selector de ícono por tap (reemplaza el input de texto libre que en iPhone
// se sentía roto: tocaba escribir el emoji con el teclado).
const DEFAULT_EMOJIS = [
  '🛒', '🍔', '☕', '🍕', '⛽', '🚌', '🚗', '🏍️',
  '🏠', '💡', '📺', '📱', '💊', '🏥', '🦷', '💅',
  '🎮', '🎬', '🎵', '⚽', '👕', '👟', '🎁', '🌹',
  '🎓', '📚', '✈️', '🏖️', '🐶', '🐱', '🔧', '🧾',
  '💼', '💰', '🎉', '🐷', '🎯', '🛟', '💍', '👶',
  '🏦', '💳', '💵', '👛', '🪙', '📈', '🚀', '📦',
]

export default function EmojiPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (icon: string) => void
}) {
  const list = DEFAULT_EMOJIS.includes(value) ? DEFAULT_EMOJIS : [value, ...DEFAULT_EMOJIS]
  return (
    <div className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
      Ícono
      <div className="grid max-h-36 grid-cols-8 gap-1 overflow-y-auto rounded-xl bg-zinc-100 p-2 dark:bg-card-hover">
        {list.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={`Ícono ${e}`}
            onClick={() => onChange(e)}
            className={`flex size-9 items-center justify-center rounded-lg text-lg transition active:scale-90 ${
              value === e ? 'bg-emerald-500/25 ring-2 ring-emerald-500' : ''
            }`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
