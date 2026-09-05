import { useEffect, useState, type FormEvent } from 'react'
import { useData } from '../context/DataContext'
import { parseBrDate } from '../utils/parse'
import type { Transaction, TransactionInput, TransactionType } from '../types'

interface Props {
  initial?: Transaction | null
  onCancel: () => void
  onSubmit: (input: TransactionInput) => Promise<void>
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function isoToBr(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Formata os dígitos digitados como dd/mm/aaaa (mesmo em celulares onde o
// seletor nativo de data varia de formato/tamanho conforme o idioma do aparelho).
function maskDateInput(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)
  return [day, month, year].filter(Boolean).join('/')
}

export default function TransactionForm({ initial, onCancel, onSubmit }: Props) {
  const { categories, banks } = useData()
  const [dateText, setDateText] = useState(isoToBr(initial?.date ?? today()))
  const [description, setDescription] = useState(initial?.description ?? '')
  const [value, setValue] = useState(initial ? String(initial.value) : '')
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'despesa')
  const [installment, setInstallment] = useState(initial?.installment ?? 1)
  const [installmentTotal, setInstallmentTotal] = useState(initial?.installmentTotal ?? 1)
  const [categoryId, setCategoryId] = useState<number | ''>(initial?.categoryId ?? '')
  const [bankId, setBankId] = useState<number | ''>(initial?.bankId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Se o tipo mudar, limpa categoria incompatível
    if (categoryId === '') return
    const cat = categories.find((c) => c.id === categoryId)
    if (cat && cat.type !== type) setCategoryId('')
  }, [type, categoryId, categories])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const date = parseBrDate(dateText)
    if (!date) {
      setError('Informe uma data válida no formato dd/mm/aaaa')
      return
    }
    const numValue = Number(value.replace(',', '.'))
    if (Number.isNaN(numValue) || numValue <= 0) {
      setError('Informe um valor válido maior que zero')
      return
    }
    if (installmentTotal < 1 || installment < 1 || installment > installmentTotal) {
      setError('Parcela inválida (a parcela atual não pode ser maior que o total de parcelas)')
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        date,
        description,
        value: numValue,
        type,
        installment,
        installmentTotal,
        categoryId: categoryId === '' ? null : categoryId,
        bankId: bankId === '' ? null : bankId,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar lançamento')
    } finally {
      setSaving(false)
    }
  }

  const filteredCategories = categories.filter((c) => c.type === type)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="font-bold text-brand-dark">
            {initial ? 'Alterar lançamento' : 'Novo lançamento'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('despesa')}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold border ${
                type === 'despesa'
                  ? 'bg-brand-dark text-white border-brand-dark'
                  : 'bg-white text-gray-600 border-gray-300'
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setType('receita')}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold border ${
                type === 'receita'
                  ? 'bg-brand-lime text-brand-dark border-brand-lime'
                  : 'bg-white text-gray-600 border-gray-300'
              }`}
            >
              Receita
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={dateText}
                onChange={(e) => setDateText(maskDateInput(e.target.value))}
                placeholder="dd/mm/aaaa"
                maxLength={10}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valor (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Supermercado, Salário..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Parcela</label>
              <input
                type="number"
                min={1}
                value={installment}
                onChange={(e) => setInstallment(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Parcela total</label>
              <input
                type="number"
                min={1}
                value={installmentTotal}
                onChange={(e) => setInstallmentTotal(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime"
              >
                <option value="">Sem categoria</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Banco</label>
              <select
                value={bankId}
                onChange={(e) => setBankId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime"
              >
                <option value="">Sem banco</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-brand-dark text-white font-semibold rounded-lg py-2.5 hover:bg-brand-dark/90 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 rounded-lg border border-gray-300 text-gray-600 font-medium"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
