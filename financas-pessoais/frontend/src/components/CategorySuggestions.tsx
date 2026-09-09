import { useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../api'
import { useData } from '../context/DataContext'
import { buildMonthOptions, currentMonth, formatMonthLabel } from '../utils/month'
import type { TransactionSuggestion } from '../types'

interface Props {
  onCancel: () => void
  onApplied: () => void
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const ALL_MONTHS = ''

export default function CategorySuggestions({ onCancel, onApplied }: Props) {
  const { categories } = useData()
  const [month, setMonth] = useState(ALL_MONTHS)
  const [items, setItems] = useState<TransactionSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [choice, setChoice] = useState<Map<number, number | ''>>(new Map())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (month) params.set('month', month)
    api
      .get<{ items: TransactionSuggestion[] }>(`/transactions/suggestions?${params.toString()}`)
      .then((res) => {
        if (!active) return
        setItems(res.items)
        const nextChoice = new Map<number, number | ''>()
        const nextSelected = new Set<number>()
        for (const item of res.items) {
          if (item.suggestion) {
            nextChoice.set(item.id, item.suggestion.categoryId)
            nextSelected.add(item.id)
          } else {
            nextChoice.set(item.id, '')
          }
        }
        setChoice(nextChoice)
        setSelected(nextSelected)
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : 'Erro ao buscar sugestões')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [month])

  const suggestedCount = useMemo(() => items.filter((i) => i.suggestion).length, [items])

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setCategoryChoice(id: number, categoryId: number | '') {
    setChoice((prev) => {
      const next = new Map(prev)
      next.set(id, categoryId)
      return next
    })
    setSelected((prev) => {
      const next = new Set(prev)
      if (categoryId === '') next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleApply() {
    const toApply = Array.from(selected)
      .map((id) => ({ id, categoryId: choice.get(id) }))
      .filter((it): it is { id: number; categoryId: number } => it.categoryId !== '' && it.categoryId !== undefined)

    if (!toApply.length) {
      setError('Selecione ao menos um lançamento com categoria escolhida')
      return
    }

    setApplying(true)
    setError(null)
    try {
      await api.put('/transactions/bulk-categorize', { items: toApply })
      onApplied()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao aplicar categorias')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-brand-dark">Sugerir categorias</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100">
          <label className="block text-xs font-medium text-gray-600 mb-1">Período</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full md:w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value={ALL_MONTHS}>Todos os períodos</option>
            {buildMonthOptions(currentMonth()).map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && <p className="text-gray-500 text-sm">Buscando lançamentos sem categoria...</p>}

          {!loading && items.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-6">
              Nenhum lançamento sem categoria neste período. 🎉
            </p>
          )}

          {!loading && items.length > 0 && (
            <>
              <p className="text-xs text-gray-500 mb-3">
                {suggestedCount} de {items.length} lançamento(s) sem categoria tiveram uma sugestão automática.
                Revise e ajuste antes de aplicar.
              </p>
              <div className="space-y-2">
                {items.map((item) => {
                  const options = categories.filter((c) => c.type === item.type)
                  const value = choice.get(item.id) ?? ''
                  const isSelected = selected.has(item.id)
                  return (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 ${
                        isSelected ? 'border-brand-lime bg-brand-lime/5' : 'border-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={value === ''}
                        onChange={() => toggleSelected(item.id)}
                        className="h-4 w-4 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {item.description || 'Sem descrição'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(item.date)} ·{' '}
                          <span className={item.type === 'receita' ? 'text-emerald-600' : 'text-red-600'}>
                            {formatCurrency(item.value)}
                          </span>
                          {item.suggestion && (
                            <span className="ml-1 text-gray-400">
                              · sugestão {item.suggestion.source === 'historico' ? 'pelo histórico' : 'por palavra-chave'}
                            </span>
                          )}
                        </p>
                      </div>
                      <select
                        value={value}
                        onChange={(e) =>
                          setCategoryChoice(item.id, e.target.value ? Number(e.target.value) : '')
                        }
                        className="w-full sm:w-48 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">Sem sugestão</option>
                        {options.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        </div>

        {!loading && items.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
            <button
              onClick={handleApply}
              disabled={applying || selected.size === 0}
              className="flex-1 bg-brand-dark text-white font-semibold rounded-lg py-2.5 hover:bg-brand-dark/90 disabled:opacity-60"
            >
              {applying ? 'Aplicando...' : `Aplicar a ${selected.size} selecionado(s)`}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 rounded-lg border border-gray-300 text-gray-600 font-medium"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
