export function parseBrDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null

  // AAAA-MM-DD (já no formato ISO)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // DD/MM/AAAA ou DD-MM-AAAA (com ano de 2 ou 4 dígitos)
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (br) {
    let [, d, m, y] = br
    if (y.length === 2) y = `20${y}`
    const dd = d.padStart(2, '0')
    const mm = m.padStart(2, '0')
    if (Number(dd) > 31 || Number(mm) > 12) return null
    return `${y}-${mm}-${dd}`
  }

  return null
}

export function parseBrNumber(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null
  s = s.replace(/[Rr]\$/g, '').trim()

  const negative = /^\(.*\)$/.test(s) || s.includes('-')
  s = s.replace(/[()-]/g, '').trim()

  // Formato BR: milhar com ponto, decimal com vírgula (1.234,56)
  if (/,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    // Já em formato com ponto decimal ou número inteiro
    s = s.replace(/,/g, '')
  }

  const n = Number(s)
  if (Number.isNaN(n)) return null
  return negative ? -Math.abs(n) : n
}

export function parseInstallment(raw: string): { installment: number; total: number } | null {
  const match = raw.trim().match(/(\d{1,3})\s*[/de]\s*(\d{1,3})/i)
  if (!match) return null
  const installment = Number(match[1])
  const total = Number(match[2])
  if (!installment || !total) return null
  return { installment, total }
}
