import { useState, type FormEvent } from 'react'
import { useData } from '../context/DataContext'
import { maskDateInput, parseBrDate } from '../utils/parse'

const NONE = '__none__'

interface Props {
  count: number
  onCancel: () => void
  onSubmit: (input: { categoryId?: number | null; bankId?: number | null; date?: string }) => Promise<void>
}

export default function BulkEditForm({ count, onCancel, onSubmit }: Props) {
  const { categories, banks } = useData()
  const [categoryId, setCategoryId] = useState<string>(NONE)
  const [bankId, setBankId] = useState<string>(NONE)
  const [dateText, setDateText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const receitaCategories = categories.filter((c) => c.type === 'receita')
  const despesaCategories = categories.filter((c) => c.type === 'despesa')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (categoryId === NONE && bankId === NONE && !dateText) {
      setError('Escolha ao menos uma alteração (categoria, banco ou data)')
      return
    }

    let isoDate: string | undefined
    if (dateText) {
      const parsed = parseBrDate(dateText)
      if (!parsed) {
        setError('Informe uma data válida no formato dd/mm/aaaa')
        return
      }
      isoDate = parsed
    }

    setSaving(true)
    try {
      const input: { categoryId?: number | null; bankId?: number | null; date?: string } = {}
      if (categoryId !== NONE) input.categoryId = categoryId ? Number(categoryId) : null
      if (bankId !== NONE) input.bankId = bankId ? Number(bankId) : null
      if (isoDate) input.date = isoDate
      await onSubmit(input)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar lançamentos')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-xl">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-brand-dark">Alterar {count} lançamento(s)</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-gray-500">
            Só os campos alterados abaixo serão aplicados a todos os selecionados. Deixe em "Não alterar"
            para manter o valor atual de cada lançamento.
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
            <input
              type="text"
              inputMode="numeric"
              value={dateText}
              onChange={(e) => setDateText(maskDateInput(e.target.value))}
              placeholder="Não alterar (dd/mm/aaaa)"
              maxLength={10}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime"
            >
              <option value={NONE}>Não alterar</option>
              <option value="">Sem categoria</option>
              {despesaCategories.length > 0 && (
                <optgroup label="Despesas">
                  {despesaCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {receitaCategories.length > 0 && (
                <optgroup label="Receitas">
                  {receitaCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Banco</label>
            <select
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime"
            >
              <option value={NONE}>Não alterar</option>
              <option value="">Sem banco</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-brand-dark text-white font-semibold rounded-lg py-2.5 hover:bg-brand-dark/90 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Aplicar alteração'}
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
