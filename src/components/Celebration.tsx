import { useEffect, useMemo } from 'react'

const COLORS = ['#34d399', '#facc15', '#60a5fa', '#fb7185', '#a78bfa', '#fb923c']
const PIECES = 60

interface Props {
  message: string
  onDone: () => void
}

/** Confetti CSS al saldar una deuda. Se cierra solo o con un tap. */
export default function Celebration({ message, onDone }: Props) {
  // pseudo-random determinista por índice: puro para React, caótico a la vista
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => {
        const r = (salt: number) => (((i + 1) * 9301 + salt * 49297) % 233280) / 233280
        return {
          id: i,
          left: r(1) * 100,
          delay: r(2) * 0.8,
          duration: 2.2 + r(3) * 1.5,
          color: COLORS[i % COLORS.length],
          size: 6 + r(4) * 6,
        }
      }),
    [],
  )

  useEffect(() => {
    const t = setTimeout(onDone, 4500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-black/60"
      onClick={onDone}
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.45,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      <div className="relative rounded-3xl bg-white px-8 py-6 text-center shadow-2xl dark:bg-card">
        <p className="text-4xl">🎉</p>
        <p className="mt-2 text-lg font-bold">{message}</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Un paso más cerca de deuda cero.</p>
      </div>
    </div>
  )
}
