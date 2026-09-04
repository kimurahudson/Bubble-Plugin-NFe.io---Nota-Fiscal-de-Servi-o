import { useState, type FormEvent } from 'react'
import { useData } from '../context/DataContext'
import { api, ApiError } from '../api'
import type { Category, TransactionType } from '../types'

const emptyForm = { id: null as number | null, name: '', type: 'despesa' as TransactionType, color: '#323e48' }

export default function Categories() {
  const { categories, reloadCategories } = useData()
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function startEdit(cat: Category) {
    setForm({ id: cat.id, name: cat.name, type: cat.type, color: cat.color })
    setError(null)
  }

  function cancelEdit() {
    setForm(emptyForm)
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      if (form.id) {
        await api.put(`/categories/${form.id}`, { name: form.name, type: form.type, color: form.color })
      } else {
        await api.post('/categories', { name: form.name, type: form.type, color: form.color })
      }
      await reloadCategories()
      setForm(emptyForm)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar categoria')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir esta categoria? Lançamentos que a usam ficarão sem categoria.')) return
    await api.del(`/categories/${id}`)
    await reloadCategories()
    if (form.id === id) setForm(emptyForm)
  }

  const receitas = categories.filter((c) => c.type === 'receita')
  const despesas = categories.filter((c) => c.type === 'despesa')

  return (
    <div>
      <h1 className="text-xl font-bold text-brand-dark mb-4">Categorias</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TransactionType }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime"
          >
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cor</label>
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            className="h-9 w-14 rounded border border-gray-300"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-dark text-white text-sm font-semibold rounded-lg px-4 py-2 hover:bg-brand-dark/90 disabled:opacity-60"
          >
            {form.id ? 'Salvar alteração' : 'Incluir'}
          </button>
          {form.id && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-sm text-gray-600 underline px-2"
            >
              Cancelar
            </button>
          )}
        </div>
        {error && <p className="text-red-600 text-sm w-full">{error}</p>}
      </form>

      <div className="grid md:grid-cols-2 gap-6">
        <CategoryList title="Receitas" items={receitas} onEdit={startEdit} onDelete={handleDelete} />
        <CategoryList title="Despesas" items={despesas} onEdit={startEdit} onDelete={handleDelete} />
      </div>
    </div>
  )
}

function CategoryList({
  title,
  items,
  onEdit,
  onDelete,
}: {
  title: string
  items: Category[]
  onEdit: (c: Category) => void
  onDelete: (id: number) => void
}) {
  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="bg-brand-dark text-white px-4 py-2 text-sm font-semibold">{title}</div>
      <ul className="divide-y divide-gray-100">
        {items.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">Nenhuma categoria</li>}
        {items.map((cat) => (
          <li key={cat.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm text-gray-800">
              <span className="h-3 w-3 rounded-full inline-block" style={{ backgroundColor: cat.color }} />
              {cat.name}
            </span>
            <span className="flex gap-3 text-xs">
              <button onClick={() => onEdit(cat)} className="text-brand-dark underline">
                Alterar
              </button>
              <button onClick={() => onDelete(cat.id)} className="text-red-600 underline">
                Excluir
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
