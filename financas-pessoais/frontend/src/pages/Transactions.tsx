import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useData } from '../context/DataContext'
import TransactionForm from '../components/TransactionForm'
import BulkEditForm from '../components/BulkEditForm'
import CategorySuggestions from '../components/CategorySuggestions'
import { buildMonthOptions, currentMonth, formatMonthLabel } from '../utils/month'
import type { Transaction, TransactionInput } from '../types'

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

type SortOption = 'data-desc' | 'data-asc' | 'descricao-asc' | 'descricao-desc' | 'categoria-asc' | 'sem-categoria'

const SORT_LABELS: Record<SortOption, string> = {
  'data-desc': 'Data (mais recente)',
  'data-asc': 'Data (mais antiga)',
  'descricao-asc': 'Descrição (A-Z)',
  'descricao-desc': 'Descrição (Z-A)',
  'categoria-asc': 'Categoria (A-Z)',
  'sem-categoria': 'Sem categoria primeiro',
}

export default function Transactions() {
  const { categories, banks } = useData()
  const [searchParams] = useSearchParams()
  const [month, setMonth] = useState(searchParams.get('month') || currentMonth())
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('categoryId') || '')
  const [bankFilter, setBankFilter] = useState(searchParams.get('bankId') || '')
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('data-desc')

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const bankMap = useMemo(() => new Map(banks.map((b) => [b.id, b])), [banks])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (month) params.set('month', month)
      if (categoryFilter) params.set('categoryId', categoryFilter)
      if (bankFilter) params.set('bankId', bankFilter)
      if (typeFilter) params.set('type', typeFilter)
      const res = await api.get<{ transactions: Transaction[] }>(`/transactions?${params.toString()}`)
      setTransactions(res.transactions)
      setSelectedIds(new Set())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar lançamentos')
    } finally {
      setLoading(false)
    }
  }, [month, categoryFilter, bankFilter, typeFilter])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => {
    let receitas = 0
    let despesas = 0
    for (const t of transactions) {
      if (t.type === 'receita') receitas += t.value
      else despesas += t.value
    }
    return { receitas, despesas, saldo: receitas - despesas }
  }, [transactions])

  const sortedTransactions = useMemo(() => {
    const list = [...transactions]
    const categoryName = (t: Transaction) => (t.categoryId ? categoryMap.get(t.categoryId)?.name ?? '' : '')
    switch (sortBy) {
      case 'data-asc':
        return list.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
      case 'descricao-asc':
        return list.sort((a, b) => a.description.localeCompare(b.description, 'pt-BR'))
      case 'descricao-desc':
        return list.sort((a, b) => b.description.localeCompare(a.description, 'pt-BR'))
      case 'categoria-asc':
        return list.sort((a, b) => {
          const nameA = categoryName(a)
          const nameB = categoryName(b)
          if (!nameA && nameB) return 1
          if (nameA && !nameB) return -1
          return nameA.localeCompare(nameB, 'pt-BR') || b.date.localeCompare(a.date)
        })
      case 'sem-categoria':
        return list.sort((a, b) => {
          const aNone = a.categoryId ? 1 : 0
          const bNone = b.categoryId ? 1 : 0
          return aNone - bNone || b.date.localeCompare(a.date)
        })
      case 'data-desc':
      default:
        return list.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    }
  }, [transactions, sortBy, categoryMap])

  const allVisibleSelected = transactions.length > 0 && selectedIds.size === transactions.length

  function toggleSelectAll() {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(transactions.map((t) => t.id)))
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleCreateOrUpdate(input: TransactionInput) {
    if (editing) {
      await api.put(`/transactions/${editing.id}`, input)
    } else {
      await api.post('/transactions', input)
    }
    setShowForm(false)
    setEditing(null)
    await load()
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir este lançamento?')) return
    await api.del(`/transactions/${id}`)
    await load()
  }

  async function handleBulkSubmit(input: { categoryId?: number | null; bankId?: number | null; date?: string }) {
    await api.put('/transactions/bulk', { ids: Array.from(selectedIds), ...input })
    setShowBulkForm(false)
    await load()
  }

  async function handleBulkDelete() {
    if (!confirm(`Excluir ${selectedIds.size} lançamento(s) selecionado(s)? Essa ação não pode ser desfeita.`))
      return
    await api.del('/transactions/bulk', { ids: Array.from(selectedIds) })
    await load()
  }

  async function handleSuggestionsApplied() {
    setShowSuggestions(false)
    await load()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-brand-dark">Lançamentos</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowSuggestions(true)}
            className="bg-white border border-gray-300 text-brand-dark font-semibold text-sm rounded-lg px-4 py-2 hover:bg-gray-50"
          >
            Sugerir categorias
          </button>
          <button
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
            className="bg-brand-lime text-brand-dark font-semibold text-sm rounded-lg px-4 py-2 hover:brightness-95"
          >
            + Novo lançamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Mês</label>
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
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            <option value="none">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Banco</label>
          <select
            value={bankFilter}
            onChange={(e) => setBankFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Ordenar por</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow p-3">
          <p className="text-xs text-gray-500">Receitas</p>
          <p className="text-sm md:text-base font-bold text-emerald-600">{formatCurrency(totals.receitas)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-3">
          <p className="text-xs text-gray-500">Despesas</p>
          <p className="text-sm md:text-base font-bold text-red-600">{formatCurrency(totals.despesas)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-3">
          <p className="text-xs text-gray-500">Saldo</p>
          <p className={`text-sm md:text-base font-bold ${totals.saldo >= 0 ? 'text-brand-dark' : 'text-red-600'}`}>
            {formatCurrency(totals.saldo)}
          </p>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading && <p className="text-gray-500 text-sm">Carregando...</p>}

      {!loading && transactions.length === 0 && (
        <p className="text-gray-500 text-sm bg-white rounded-xl shadow p-6 text-center">
          Nenhum lançamento neste período. Clique em "Novo lançamento" ou importe um extrato em CSV.
        </p>
      )}

      {!loading && transactions.length > 0 && (
        <>
          <label className="flex items-center gap-2 text-xs text-gray-500 mb-2 select-none">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} className="h-4 w-4" />
            Selecionar todos os {transactions.length} lançamento(s) desta lista
          </label>

          {/* Tabela (desktop) */}
          <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-dark text-white text-left">
                  <th className="px-4 py-2 w-8"></th>
                  <th className="px-4 py-2 font-semibold">Data</th>
                  <th className="px-4 py-2 font-semibold">Descrição</th>
                  <th className="px-4 py-2 font-semibold">Valor</th>
                  <th className="px-4 py-2 font-semibold">Parcela</th>
                  <th className="px-4 py-2 font-semibold">Categoria</th>
                  <th className="px-4 py-2 font-semibold">Banco</th>
                  <th className="px-4 py-2 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedTransactions.map((t) => (
                  <tr key={t.id} className={selectedIds.has(t.id) ? 'bg-brand-lime/10' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="px-4 py-2">{t.description || '-'}</td>
                    <td className={`px-4 py-2 font-medium ${t.type === 'receita' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {t.type === 'despesa' ? '-' : '+'}
                      {formatCurrency(t.value)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {t.installment}/{t.installmentTotal}
                    </td>
                    <td className="px-4 py-2">
                      {t.categoryId ? categoryMap.get(t.categoryId)?.name ?? '-' : '-'}
                    </td>
                    <td className="px-4 py-2">{t.bankId ? bankMap.get(t.bankId)?.name ?? '-' : '-'}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEditing(t)
                          setShowForm(true)
                        }}
                        className="text-brand-dark underline text-xs mr-3"
                      >
                        Alterar
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="text-red-600 underline text-xs">
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards (mobile) */}
          <div className="md:hidden space-y-3">
            {sortedTransactions.map((t) => (
              <div
                key={t.id}
                className={`bg-white rounded-xl shadow p-4 ${selectedIds.has(t.id) ? 'ring-2 ring-brand-lime' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleSelect(t.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-xs text-gray-500">{formatDate(t.date)}</span>
                  </div>
                  <span className={`font-bold ${t.type === 'receita' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {t.type === 'despesa' ? '-' : '+'}
                    {formatCurrency(t.value)}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-800 mb-1">{t.description || 'Sem descrição'}</p>
                <p className="text-xs text-gray-500 mb-2">
                  Parcela {t.installment}/{t.installmentTotal} ·{' '}
                  {t.categoryId ? categoryMap.get(t.categoryId)?.name ?? '-' : 'Sem categoria'} ·{' '}
                  {t.bankId ? bankMap.get(t.bankId)?.name ?? '-' : 'Sem banco'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditing(t)
                      setShowForm(true)
                    }}
                    className="text-brand-dark underline text-xs"
                  >
                    Alterar
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="text-red-600 underline text-xs">
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-16 md:bottom-4 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 z-40 bg-brand-dark text-white shadow-xl px-4 py-3 md:py-2.5 md:rounded-full text-sm">
          <div className="flex items-center justify-between md:justify-start md:gap-3">
            <span className="font-medium whitespace-nowrap">{selectedIds.size} selecionado(s)</span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-white/70 underline whitespace-nowrap md:order-last"
            >
              Cancelar
            </button>
            <button
              onClick={() => setShowBulkForm(true)}
              className="hidden md:inline bg-brand-lime text-brand-dark font-semibold rounded-full px-3 py-1.5 whitespace-nowrap"
            >
              Alterar selecionados
            </button>
            <button
              onClick={handleBulkDelete}
              className="hidden md:inline bg-red-600 text-white font-semibold rounded-full px-3 py-1.5 whitespace-nowrap"
            >
              Excluir selecionados
            </button>
          </div>
          <div className="md:hidden flex gap-2 mt-2">
            <button
              onClick={() => setShowBulkForm(true)}
              className="flex-1 bg-brand-lime text-brand-dark font-semibold rounded-lg py-2"
            >
              Alterar
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex-1 bg-red-600 text-white font-semibold rounded-lg py-2"
            >
              Excluir
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <TransactionForm
          initial={editing}
          onCancel={() => {
            setShowForm(false)
            setEditing(null)
          }}
          onSubmit={handleCreateOrUpdate}
        />
      )}

      {showBulkForm && (
        <BulkEditForm
          count={selectedIds.size}
          onCancel={() => setShowBulkForm(false)}
          onSubmit={handleBulkSubmit}
        />
      )}

      {showSuggestions && (
        <CategorySuggestions onCancel={() => setShowSuggestions(false)} onApplied={handleSuggestionsApplied} />
      )}
    </div>
  )
}
