import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  isAfter,
  isBefore,
  lastDayOfMonth,
  parseISO,
  setDate,
  setYear,
  startOfDay,
} from 'date-fns'
import type { RecurringPayment } from '../types'

export interface UpcomingPayment {
  payment: RecurringPayment
  due: Date
  daysLeft: number
}

/** Día del mes clampeado a la longitud del mes (día 31 en abril → 30). */
function dayInMonth(base: Date, day: number): Date {
  return setDate(base, Math.min(day, lastDayOfMonth(base).getDate()))
}

function nextMonthlyDue(from: Date, dueDay: number): Date {
  const thisMonth = dayInMonth(from, dueDay)
  return isBefore(thisMonth, from) ? dayInMonth(addMonths(from, 1), dueDay) : thisMonth
}

/**
 * Próximas ocurrencias de pagos recurrentes dentro del horizonte (días).
 * - monthly: próximo due_day desde hoy.
 * - once: due_date si no ha pasado.
 * - yearly: aniversario de due_date (sin due_date no se puede ubicar el mes; se omite).
 */
export function computeUpcoming(
  payments: RecurringPayment[],
  today: Date,
  horizonDays = 7,
): UpcomingPayment[] {
  const start = startOfDay(today)
  const end = addDays(start, horizonDays)
  const out: UpcomingPayment[] = []

  for (const p of payments) {
    if (!p.active) continue
    let due: Date | null = null

    if (p.frequency === 'once' && p.due_date) {
      const d = startOfDay(parseISO(p.due_date))
      if (!isBefore(d, start)) due = d
    } else if (p.frequency === 'monthly' && p.due_day) {
      due = nextMonthlyDue(start, p.due_day)
    } else if (p.frequency === 'yearly' && p.due_date) {
      let d = setYear(startOfDay(parseISO(p.due_date)), start.getFullYear())
      if (isBefore(d, start)) d = setYear(d, start.getFullYear() + 1)
      due = d
    }

    if (!due || isAfter(due, end)) continue
    out.push({ payment: p, due, daysLeft: differenceInCalendarDays(due, start) })
  }

  return out.sort((a, b) => a.due.getTime() - b.due.getTime())
}
