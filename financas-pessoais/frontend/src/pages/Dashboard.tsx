import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useData } from '../context/DataContext'
import { buildMonthOptions, currentMonth, formatMonthLabel } from '../utils/month'
import type { Transaction, TransactionType } from '../types'

// Paleta categórica validada (ordem fixa, nunca repetida por índice) — ver skill de dataviz.
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const MUTED = '#898781'
const MAX_SLOTS = 7

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface CategoryRow {
  id: number | null
  name: string
  value: number
  color: string
  isOthers: boolean
}

export default function Dashboard() {
  const { categories } = useData()
  const navigate = useNavigate()
  const [month, setMonth] = useState(currentMonth())
  const [type, setType] = useState<TransactionType>('despesa')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ month, type })
    api
      .get<{ transactions: Transaction[] }>(`/transactions?${params.toString()}`)
      .then((res) => {
        if (active) setTransactions(res.transactions)
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : 'Erro ao carregar dados')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [month, type])

  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const { rows, total } = useMemo(() => {
    const totalsById = new Map<number | null, number>()
    for (const t of transactions) {
      totalsById.set(t.categoryId, (totalsById.get(t.categoryId) ?? 0) + t.value)
    }

    const entries = Array.from(totalsById.entries())
      .map(([id, value]) => ({
        id,
        name: id === null ? 'Sem categoria' : categoryNameById.get(id) ?? 'Categoria removida',
        value,
      }))
      .sort((a, b) => b.value - a.value)

    const top = entries.slice(0, MAX_SLOTS)
    const rest = entries.slice(MAX_SLOTS)
    const restTotal = rest.reduce((sum, e) => sum + e.value, 0)

    const rows: CategoryRow[] = top.map((e, i) => ({ ...e, color: PALETTE[i], isOthers: false }))
    if (restTotal > 0) {
      rows.push({ id: null, name: `Outras (${rest.length})`, value: restTotal, color: MUTED, isOthers: true })
    }

    const total = entries.reduce((sum, e) => sum + e.value, 0)
    return { rows, total }
  }, [transactions, categoryNameById])

  const maxValue = rows.length > 0 ? rows[0].value : 0

  function goToCategory(row: CategoryRow) {
    const params = new URLSearchParams({ month, type })
    params.set('categoryId', row.id === null ? 'none' : String(row.id))
    navigate(`/?${params.toString()}`)
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-brand-dark mb-4">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 mb-6 max-w-md">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Período</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {buildMonthOptions(month).map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setType('despesa')}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                type === 'despesa' ? 'bg-brand-dark text-white' : 'text-gray-600'
              }`}
            >
              Despesas
            </button>
            <button
              onClick={() => setType('receita')}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                type === 'receita' ? 'bg-brand-lime text-brand-dark' : 'text-gray-600'
              }`}
            >
              Receitas
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading && <p className="text-gray-500 text-sm">Carregando...</p>}

      {!loading && rows.length === 0 && (
        <p className="text-gray-500 text-sm bg-white rounded-xl shadow p-6 text-center max-w-2xl">
          Nenhum lançamento de {type === 'despesa' ? 'despesa' : 'receita'} em {formatMonthLabel(month)}.
        </p>
      )}

      {!loading && rows.length > 0 && (
        <div className="bg-white rounded-xl shadow p-5 max-w-2xl">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-semibold text-brand-dark">
              {type === 'despesa' ? 'Despesas' : 'Receitas'} por categoria
            </h2>
            <span className="text-sm text-gray-500">Total: {formatCurrency(total)}</span>
          </div>

          <div className="space-y-3">
            {rows.map((row) => {
              const pct = maxValue > 0 ? (row.value / maxValue) * 100 : 0
              const shareOfTotal = total > 0 ? (row.value / total) * 100 : 0
              return (
                <button
                  key={row.id ?? `others-${row.name}`}
                  onClick={() => !row.isOthers && goToCategory(row)}
                  disabled={row.isOthers}
                  className={`w-full text-left group ${row.isOthers ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="flex items-center gap-2 text-sm text-gray-700">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className={row.isOthers ? '' : 'group-hover:underline'}>{row.name}</span>
                      <span className="text-xs text-gray-400">{shareOfTotal.toFixed(0)}%</span>
                    </span>
                    <span className="text-sm font-semibold text-gray-800">{formatCurrency(row.value)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-r-full transition-all"
                      style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: row.color }}
                    />
                  </div>
                </button>
              )
            })}
          </div>

          <p className="text-xs text-gray-400 mt-4">Clique numa categoria para ver os lançamentos dela.</p>
        </div>
      )}
    </div>
  )
}
