import {
  addMonths,
  differenceInCalendarMonths,
  format,
  isAfter,
  parseISO,
  startOfMonth,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { Debt, DebtPayment } from '../types'

export interface DebtSeriesPoint {
  label: string
  /** Saldo real al cierre del mes (null en el tramo proyectado) */
  real: number | null
  /** Proyección lineal a cero (null en el tramo histórico) */
  proyeccion: number | null
}

/**
 * Serie mensual del saldo total de deuda: histórico reconstruido desde los
 * pagos registrados + proyección lineal punteada hasta la fecha meta.
 */
export function buildDebtSeries(
  debts: Debt[],
  payments: Pick<DebtPayment, 'amount' | 'paid_at'>[],
  targetDate: Date,
): DebtSeriesPoint[] {
  const totalNow = debts.reduce((sum, d) => sum + d.current_balance, 0)
  const now = startOfMonth(new Date())

  const firstPaymentMonth = payments.length
    ? startOfMonth(parseISO(payments.map((p) => p.paid_at).sort()[0]))
    : now

  const points: DebtSeriesPoint[] = []
  for (let m = firstPaymentMonth; !isAfter(m, now); m = addMonths(m, 1)) {
    // saldo al cierre del mes m = saldo actual + todo lo pagado después de m
    const paidAfter = payments
      .filter((p) => isAfter(startOfMonth(parseISO(p.paid_at)), m))
      .reduce((sum, p) => sum + p.amount, 0)
    points.push({
      label: format(m, 'MMM yy', { locale: es }),
      real: totalNow + paidAfter,
      proyeccion: null,
    })
  }

  const monthsLeft = Math.max(differenceInCalendarMonths(startOfMonth(targetDate), now), 1)
  const step = totalNow / monthsLeft
  points[points.length - 1].proyeccion = totalNow // punto compartido: hoy

  for (let i = 1; i <= monthsLeft; i++) {
    points.push({
      label: format(addMonths(now, i), 'MMM yy', { locale: es }),
      real: null,
      proyeccion: Math.max(Math.round(totalNow - step * i), 0),
    })
  }

  return points
}
