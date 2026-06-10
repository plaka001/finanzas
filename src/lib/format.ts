/** Formatea pesos COP enteros: 1236529 -> "$1.236.529" */
export function formatCOP(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(Math.round(amount))
  return `${sign}$${abs.toLocaleString('es-CO')}`
}

/** Parsea dígitos a número: "15000" -> 15000 */
export function parseAmountInput(raw: string): number {
  const digits = raw.replace(/\D/g, '')
  return digits ? parseInt(digits, 10) : 0
}
