import { useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useData } from '../context/DataContext'
import { parseBrDate, parseBrNumber, parseInstallment } from '../utils/parse'
import type { TransactionInput, TransactionType } from '../types'

interface PreviewResponse {
  headers: string[]
  rows: string[][]
  totalRows: number
  truncated: boolean
}

interface Mapping {
  date: string
  description: string
  value: string
  installmentCol: string
  categoryCol: string
}

type ForceType = 'auto' | 'despesa' | 'receita'

const NONE = '__none__'

interface PreviewRow {
  raw: string[]
  ok: boolean
  errorMsg?: string
  transaction?: TransactionInput
}

export default function ImportCsv() {
  const navigate = useNavigate()
  const { categories, banks, reloadBanks } = useData()

  const [step, setStep] = useState<'upload' | 'mapping' | 'result'>('upload')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const [mapping, setMapping] = useState<Mapping>({
    date: '',
    description: '',
    value: '',
    installmentCol: '',
    categoryCol: '',
  })
  const [forceType, setForceType] = useState<ForceType>('auto')
  const [invertSign, setInvertSign] = useState(false)
  const [bankId, setBankId] = useState<number | ''>('')
  const [newBankName, setNewBankName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState(0)

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    setFileName(file.name)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.postForm<PreviewResponse>('/import/preview', form)
      setPreview(res)
      const guessedDate = res.headers.findIndex((h) => /data|date/i.test(h))
      const guessedValue = res.headers.findIndex((h) => /valor|value|montante/i.test(h))
      const guessedDesc = res.headers.findIndex((h) => /desc|hist[oó]rico|memo/i.test(h))
      setMapping({
        date: guessedDate >= 0 ? res.headers[guessedDate] : '',
        value: guessedValue >= 0 ? res.headers[guessedValue] : '',
        description: guessedDesc >= 0 ? res.headers[guessedDesc] : '',
        installmentCol: '',
        categoryCol: '',
      })
      setStep('mapping')
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Erro ao ler o arquivo CSV')
    } finally {
      setUploading(false)
    }
  }

  const previewRows: PreviewRow[] = useMemo(() => {
    if (!preview || !mapping.date || !mapping.value) return []
    const dateIdx = preview.headers.indexOf(mapping.date)
    const valueIdx = preview.headers.indexOf(mapping.value)
    const descIdx = mapping.description ? preview.headers.indexOf(mapping.description) : -1
    const instIdx = mapping.installmentCol ? preview.headers.indexOf(mapping.installmentCol) : -1
    const catIdx = mapping.categoryCol ? preview.headers.indexOf(mapping.categoryCol) : -1

    return preview.rows.map((row) => {
      const dateRaw = row[dateIdx] ?? ''
      const valueRaw = row[valueIdx] ?? ''
      const date = parseBrDate(dateRaw)
      let value = parseBrNumber(valueRaw)

      if (date === null) return { raw: row, ok: false, errorMsg: `Data inválida: "${dateRaw}"` }
      if (value === null) return { raw: row, ok: false, errorMsg: `Valor inválido: "${valueRaw}"` }

      if (invertSign) value = -value

      let type: TransactionType
      if (forceType === 'despesa') type = 'despesa'
      else if (forceType === 'receita') type = 'receita'
      else type = value < 0 ? 'despesa' : 'receita'

      let installment = 1
      let installmentTotal = 1
      if (instIdx >= 0) {
        const parsed = parseInstallment(row[instIdx] ?? '')
        if (parsed) {
          installment = parsed.installment
          installmentTotal = parsed.total
        }
      }

      let categoryId: number | null = null
      if (catIdx >= 0) {
        const catName = (row[catIdx] ?? '').trim().toLowerCase()
        const match = categories.find((c) => c.type === type && c.name.toLowerCase() === catName)
        if (match) categoryId = match.id
      }

      const transaction: TransactionInput = {
        date,
        description: descIdx >= 0 ? (row[descIdx] ?? '').trim() : '',
        value: Math.abs(value),
        type,
        installment,
        installmentTotal,
        categoryId,
        bankId: bankId === '' ? null : bankId,
      }

      return { raw: row, ok: true, transaction }
    })
  }, [preview, mapping, forceType, invertSign, categories, bankId])

  const validCount = previewRows.filter((r) => r.ok).length
  const invalidCount = previewRows.length - validCount

  async function handleCreateBank() {
    if (!newBankName.trim()) return
    const res = await api.post<{ bank: { id: number } }>('/banks', { name: newBankName.trim() })
    await reloadBanks()
    setBankId(res.bank.id)
    setNewBankName('')
  }

  async function handleImport() {
    setImportError(null)
    const valid = previewRows.filter((r) => r.ok).map((r) => r.transaction!)
    if (!valid.length) {
      setImportError('Não há lançamentos válidos para importar')
      return
    }
    setImporting(true)
    try {
      const res = await api.post<{ count: number }>('/transactions/bulk', { transactions: valid })
      setImportedCount(res.count)
      setStep('result')
    } catch (err) {
      setImportError(err instanceof ApiError ? err.message : 'Erro ao importar lançamentos')
    } finally {
      setImporting(false)
    }
  }

  function resetAll() {
    setStep('upload')
    setPreview(null)
    setFileName('')
    setMapping({ date: '', description: '', value: '', installmentCol: '', categoryCol: '' })
    setForceType('auto')
    setInvertSign(false)
    setBankId('')
    setImportError(null)
    setImportedCount(0)
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-brand-dark mb-4">Importar CSV do banco</h1>

      {step === 'upload' && (
        <div className="bg-white rounded-xl shadow p-6 max-w-lg">
          <p className="text-sm text-gray-600 mb-4">
            Selecione o arquivo CSV exportado pelo internet banking do seu banco. Aceitamos arquivos com
            separador vírgula ou ponto e vírgula.
          </p>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-10 cursor-pointer hover:border-brand-lime transition-colors">
            <span className="text-3xl">📄</span>
            <span className="text-sm text-gray-600">
              {uploading ? 'Lendo arquivo...' : fileName || 'Clique para selecionar o arquivo .csv'}
            </span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} disabled={uploading} />
          </label>
          {uploadError && <p className="text-red-600 text-sm mt-3">{uploadError}</p>}
        </div>
      )}

      {step === 'mapping' && preview && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold text-brand-dark mb-3">1. Diga o que é cada coluna</h2>
            <div className="grid md:grid-cols-3 gap-3">
              <MappingSelect
                label="Data *"
                value={mapping.date}
                headers={preview.headers}
                onChange={(v) => setMapping((m) => ({ ...m, date: v }))}
              />
              <MappingSelect
                label="Valor *"
                value={mapping.value}
                headers={preview.headers}
                onChange={(v) => setMapping((m) => ({ ...m, value: v }))}
              />
              <MappingSelect
                label="Descrição"
                value={mapping.description}
                headers={preview.headers}
                onChange={(v) => setMapping((m) => ({ ...m, description: v }))}
              />
              <MappingSelect
                label="Parcela (ex: 1/3)"
                value={mapping.installmentCol}
                headers={preview.headers}
                onChange={(v) => setMapping((m) => ({ ...m, installmentCol: v }))}
              />
              <MappingSelect
                label="Categoria"
                value={mapping.categoryCol}
                headers={preview.headers}
                onChange={(v) => setMapping((m) => ({ ...m, categoryCol: v }))}
              />
            </div>

            <div className="grid md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo dos lançamentos</label>
                <select
                  value={forceType}
                  onChange={(e) => setForceType(e.target.value as ForceType)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="auto">Automático (sinal do valor)</option>
                  <option value="despesa">Marcar tudo como despesa</option>
                  <option value="receita">Marcar tudo como receita</option>
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={invertSign} onChange={(e) => setInvertSign(e.target.checked)} />
                  Inverter sinal dos valores
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Banco deste extrato</label>
                <div className="flex gap-2">
                  <select
                    value={bankId}
                    onChange={(e) => setBankId(e.target.value ? Number(e.target.value) : '')}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Sem banco</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    placeholder="Novo banco..."
                    className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleCreateBank}
                    className="text-xs bg-brand-dark text-white rounded-lg px-2.5"
                  >
                    Criar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-brand-dark">
                2. Confira a pré-visualização ({previewRows.length} linha(s) do arquivo
                {preview.truncated ? `, mostrando as ${preview.rows.length} primeiras` : ''})
              </h2>
              <span className="text-xs text-gray-500">
                <span className="text-emerald-600 font-medium">{validCount} válidas</span>
                {invalidCount > 0 && <span className="text-red-600 font-medium ml-2">{invalidCount} com erro</span>}
              </span>
            </div>

            {!mapping.date || !mapping.value ? (
              <p className="text-sm text-gray-500">Selecione ao menos as colunas de Data e Valor.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-left">
                      <th className="px-2 py-1.5">Status</th>
                      <th className="px-2 py-1.5">Data</th>
                      <th className="px-2 py-1.5">Descrição</th>
                      <th className="px-2 py-1.5">Valor</th>
                      <th className="px-2 py-1.5">Tipo</th>
                      <th className="px-2 py-1.5">Parcela</th>
                      <th className="px-2 py-1.5">Categoria</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.slice(0, 50).map((r, i) => (
                      <tr key={i} className={r.ok ? '' : 'bg-red-50'}>
                        {r.ok && r.transaction ? (
                          <>
                            <td className="px-2 py-1.5 text-emerald-600">OK</td>
                            <td className="px-2 py-1.5">{r.transaction.date}</td>
                            <td className="px-2 py-1.5">{r.transaction.description || '-'}</td>
                            <td className="px-2 py-1.5">
                              {r.transaction.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="px-2 py-1.5 capitalize">{r.transaction.type}</td>
                            <td className="px-2 py-1.5">
                              {r.transaction.installment}/{r.transaction.installmentTotal}
                            </td>
                            <td className="px-2 py-1.5">
                              {categories.find((c) => c.id === r.transaction!.categoryId)?.name ?? '-'}
                            </td>
                          </>
                        ) : (
                          <td className="px-2 py-1.5 text-red-600" colSpan={7}>
                            Erro: {r.errorMsg}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewRows.length > 50 && (
                  <p className="text-xs text-gray-400 mt-2">Mostrando as primeiras 50 linhas.</p>
                )}
              </div>
            )}

            {importError && <p className="text-red-600 text-sm mt-3">{importError}</p>}

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="bg-brand-dark text-white font-semibold rounded-lg px-4 py-2 text-sm hover:bg-brand-dark/90 disabled:opacity-50"
              >
                {importing ? 'Importando...' : `Importar ${validCount} lançamento(s)`}
              </button>
              <button onClick={resetAll} className="text-sm text-gray-600 underline px-2">
                Cancelar / escolher outro arquivo
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'result' && (
        <div className="bg-white rounded-xl shadow p-6 max-w-md text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="font-semibold text-brand-dark mb-1">{importedCount} lançamento(s) importado(s)!</p>
          <p className="text-sm text-gray-500 mb-4">
            Eles já aparecem sincronizados na sua lista de lançamentos, em qualquer dispositivo.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => navigate('/')}
              className="bg-brand-lime text-brand-dark font-semibold rounded-lg px-4 py-2 text-sm"
            >
              Ver lançamentos
            </button>
            <button onClick={resetAll} className="text-sm text-gray-600 underline px-2">
              Importar outro arquivo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MappingSelect({
  label,
  value,
  headers,
  onChange,
}: {
  label: string
  value: string
  headers: string[]
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        value={value || NONE}
        onChange={(e) => onChange(e.target.value === NONE ? '' : e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        <option value={NONE}>Não usar</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  )
}
