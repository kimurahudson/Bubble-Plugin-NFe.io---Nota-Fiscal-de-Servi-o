import { useState, type FormEvent } from 'react'
import { useData } from '../context/DataContext'
import { api, ApiError } from '../api'
import type { Bank } from '../types'

export default function Banks() {
  const { banks, reloadBanks } = useData()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function startEdit(bank: Bank) {
    setEditingId(bank.id)
    setName(bank.name)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setName('')
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      if (editingId) {
        await api.put(`/banks/${editingId}`, { name })
      } else {
        await api.post('/banks', { name })
      }
      await reloadBanks()
      cancelEdit()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar banco')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir este banco? Lançamentos que o usam ficarão sem banco.')) return
    await api.del(`/banks/${id}`)
    await reloadBanks()
    if (editingId === id) cancelEdit()
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-brand-dark mb-4">Bancos</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Nome do banco</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Nubank, Itaú, Bradesco..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-lime"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-dark text-white text-sm font-semibold rounded-lg px-4 py-2 hover:bg-brand-dark/90 disabled:opacity-60"
          >
            {editingId ? 'Salvar alteração' : 'Incluir'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="text-sm text-gray-600 underline px-2">
              Cancelar
            </button>
          )}
        </div>
        {error && <p className="text-red-600 text-sm w-full">{error}</p>}
      </form>

      <div className="bg-white rounded-xl shadow overflow-hidden max-w-md">
        <ul className="divide-y divide-gray-100">
          {banks.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">Nenhum banco cadastrado</li>}
          {banks.map((bank) => (
            <li key={bank.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
              <span className="text-sm text-gray-800">{bank.name}</span>
              <span className="flex gap-3 text-xs">
                <button onClick={() => startEdit(bank)} className="text-brand-dark underline">
                  Alterar
                </button>
                <button onClick={() => handleDelete(bank.id)} className="text-red-600 underline">
                  Excluir
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
