import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../api'
import { useData } from '../context/DataContext'
import TransactionForm from '../components/TransactionForm'
import type { Transaction, TransactionInput } from '../types'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split('-').map(Number)
  const abbrev = new Date(year, month - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '')
  return `${abbrev.charAt(0).toUpperCase() + abbrev.slice(1)}/${year}`
}

function buildMonthOptions(selected: string) {
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

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function Transactions() {
  const { categories, banks } = useData()
  const [month, setMonth] = useState(currentMonth())
  const [categoryFilter, setCategoryFilter] = useState('')
  const [bankFilter, setBankFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-brand-dark">Lançamentos</h1>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
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
          {/* Tabela (desktop) */}
          <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-dark text-white text-left">
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
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
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
            {transactions.map((t) => (
              <div key={t.id} className="bg-white rounded-xl shadow p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">{formatDate(t.date)}</span>
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
    </div>
  )
}
