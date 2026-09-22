import { useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../api'
import { useData } from '../context/DataContext'
import { buildMonthOptions, currentMonth, formatMonthLabel } from '../utils/month'
import type { DuplicateGroup } from '../types'

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

export default function DuplicateTransactions({ onCancel, onApplied }: Props) {
  const { categories, banks } = useData()
  const [month, setMonth] = useState(ALL_MONTHS)
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (month) params.set('month', month)
    api
      .get<{ groups: DuplicateGroup[] }>(`/transactions/duplicates?${params.toString()}`)
      .then((res) => {
        if (!active) return
        setGroups(res.groups)
        const nextSelected = new Set<number>()
        for (const group of res.groups) {
          for (const t of group.transactions) {
            if (!t.suggestedKeep) nextSelected.add(t.id)
          }
        }
        setSelected(nextSelected)
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : 'Erro ao buscar duplicados')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [month])

  const totalTransactions = useMemo(() => groups.reduce((sum, g) => sum + g.transactions.length, 0), [groups])

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleApply() {
    if (!selected.size) {
      setError('Selecione ao menos um lançamento para excluir')
      return
    }
    setApplying(true)
    setError(null)
    try {
      await api.del('/transactions/bulk', { ids: Array.from(selected) })
      onApplied()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir duplicados')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-brand-dark">Remover duplicados</h2>
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
          {loading && <p className="text-gray-500 text-sm">Procurando lançamentos duplicados...</p>}

          {!loading && groups.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-6">
              Nenhum duplicado encontrado neste período. 🎉
            </p>
          )}

          {!loading && groups.length > 0 && (
            <>
              <p className="text-xs text-gray-500 mb-3">
                {groups.length} grupo(s) com {totalTransactions} lançamento(s) iguais em data, valor e descrição.
                O lançamento mais antigo de cada grupo vem desmarcado (sugestão de manter); revise antes de excluir.
              </p>
              <div className="space-y-4">
                {groups.map((group, gi) => {
                  const first = group.transactions[0]
                  return (
                    <div key={gi} className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm font-medium text-gray-800 mb-2">
                        {first.description || 'Sem descrição'} ·{' '}
                        <span className={first.type === 'receita' ? 'text-emerald-600' : 'text-red-600'}>
                          {formatCurrency(first.value)}
                        </span>{' '}
                        · {formatDate(first.date)}
                      </p>
                      <div className="space-y-1.5">
                        {group.transactions.map((t) => (
                          <label
                            key={t.id}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer ${
                              selected.has(t.id) ? 'bg-red-50' : 'bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(t.id)}
                              onChange={() => toggleSelected(t.id)}
                              className="h-4 w-4 shrink-0"
                            />
                            <span className="flex-1 text-gray-600">
                              Categoria: {t.categoryId ? categories.find((c) => c.id === t.categoryId)?.name ?? '-' : 'Sem categoria'}
                              {' · '}
                              Banco: {t.bankId ? banks.find((b) => b.id === t.bankId)?.name ?? '-' : 'Sem banco'}
                              {' · '}
                              Parcela {t.installment}/{t.installmentTotal}
                            </span>
                            {t.suggestedKeep && (
                              <span className="text-emerald-600 font-medium whitespace-nowrap">Sugestão: manter</span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        </div>

        {!loading && groups.length > 0 && (
          <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
            <button
              onClick={handleApply}
              disabled={applying || selected.size === 0}
              className="flex-1 bg-red-600 text-white font-semibold rounded-lg py-2.5 hover:bg-red-700 disabled:opacity-60"
            >
              {applying ? 'Excluindo...' : `Excluir ${selected.size} selecionado(s)`}
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
