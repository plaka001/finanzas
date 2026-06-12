import { format, parseISO, setYear, startOfDay } from 'date-fns'
import { formatCOP } from './format'
import type { RecurringPayment } from '../types'

function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

function icsDate(d: Date): string {
  return format(d, 'yyyyMMdd')
}

function nextMonthlyStart(dueDay: number, from: Date): Date {
  const today = startOfDay(from)
  // día clampeado a la longitud del mes (31 en abril → 30)
  const clamp = (year: number, month: number) =>
    new Date(year, month, Math.min(dueDay, new Date(year, month + 1, 0).getDate()))
  const thisMonth = clamp(today.getFullYear(), today.getMonth())
  return thisMonth < today ? clamp(today.getFullYear(), today.getMonth() + 1) : thisMonth
}

/**
 * Calendario .ics con los pagos activos como eventos de día completo.
 * Cada evento alerta el día anterior y a las 8 AM del día del pago.
 */
export function buildIcs(payments: RecurringPayment[]): string {
  const now = new Date()
  const stamp = format(now, "yyyyMMdd'T'HHmmss")
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//La Caleta//Pagos//ES',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Pagos La Caleta',
  ]

  for (const p of payments) {
    if (!p.active) continue

    let dtstart: Date
    let rrule: string | null = null

    if (p.frequency === 'once' && p.due_date) {
      const d = startOfDay(parseISO(p.due_date))
      if (d < startOfDay(now)) continue // ya pasó
      dtstart = d
    } else if (p.frequency === 'monthly' && p.due_day) {
      dtstart = nextMonthlyStart(p.due_day, now)
      rrule = `RRULE:FREQ=MONTHLY;BYMONTHDAY=${p.due_day}`
    } else if (p.frequency === 'yearly' && p.due_date) {
      let d = setYear(startOfDay(parseISO(p.due_date)), now.getFullYear())
      if (d < startOfDay(now)) d = setYear(d, now.getFullYear() + 1)
      dtstart = d
      rrule = 'RRULE:FREQ=YEARLY'
    } else {
      continue // yearly sin fecha ancla: no se puede ubicar el mes
    }

    const summary = icsEscape(
      p.amount ? `${p.name} — ${formatCOP(p.amount)}` : `${p.name} (monto variable)`,
    )

    lines.push(
      'BEGIN:VEVENT',
      `UID:${p.id}@panorama`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(dtstart)}`,
      `SUMMARY:💸 ${summary}`,
      ...(rrule ? [rrule] : []),
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:Mañana vence: ${summary}`,
      'TRIGGER:-PT16H', // 8 AM del día anterior (relativo a las 00:00 del evento)
      'END:VALARM',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:Hoy vence: ${summary}`,
      'TRIGGER:PT8H', // 8 AM del mismo día
      'END:VALARM',
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'la-caleta-pagos.ics'
  a.click()
  URL.revokeObjectURL(url)
}
