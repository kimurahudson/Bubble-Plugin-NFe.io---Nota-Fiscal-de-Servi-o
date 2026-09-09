export function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

export function formatMonthLabel(value: string) {
  const [year, month] = value.split('-').map(Number)
  const abbrev = new Date(year, month - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '')
  return `${abbrev.charAt(0).toUpperCase() + abbrev.slice(1)}/${year}`
}

export function buildMonthOptions(selected: string) {
  const options: string[] = []
  const base = new Date()
  base.setDate(1)
  for (let i = -36; i <= 12; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1)
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  if (!options.includes(selected)) options.push(selected)
  return options.sort().reverse()
}
