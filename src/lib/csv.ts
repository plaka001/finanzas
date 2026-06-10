/**
 * CSV con separador ';' (convencion regional es-CO en Excel) y BOM UTF-8
 * para que los acentos y emojis abran bien en Excel.
 */
export function buildCsv(rows: string[][]): string {
  const body = rows
    .map((row) => row.map((field) => `"${field.replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')
  return String.fromCharCode(0xfeff) + body
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
