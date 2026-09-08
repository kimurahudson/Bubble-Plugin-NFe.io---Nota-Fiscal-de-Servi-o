import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../api'
import type { Device } from '../types'

interface TwoFaStatus {
  enabled: boolean
  recoveryCodesRemaining: number
}

function formatDateTime(iso: string) {
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const statusLabel: Record<Device['status'], string> = {
  pending: 'Pendente de aprovação',
  trusted: 'Confiável',
  revoked: 'Revogado',
}

const statusClasses: Record<Device['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  trusted: 'bg-emerald-100 text-emerald-700',
  revoked: 'bg-gray-200 text-gray-500',
}

export default function Security() {
  const [status, setStatus] = useState<TwoFaStatus | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)

  const [setupStep, setSetupStep] = useState<'idle' | 'qr'>('idle')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [manualSecret, setManualSecret] = useState('')
  const [confirmCode, setConfirmCode] = useState('')

  const [showDisableForm, setShowDisableForm] = useState(false)
  const [disableCode, setDisableCode] = useState('')
  const [showRegenForm, setShowRegenForm] = useState(false)
  const [regenCode, setRegenCode] = useState('')

  const [codesToShow, setCodesToShow] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [statusRes, devicesRes] = await Promise.all([
      api.get<TwoFaStatus>('/2fa'),
      api.get<{ devices: Device[] }>('/devices'),
    ])
    setStatus(statusRes)
    setDevices(devicesRes.devices)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function startSetup() {
    setError(null)
    setBusy(true)
    try {
      const res = await api.post<{ secret: string; qrCodeDataUrl: string }>('/2fa/setup')
      setManualSecret(res.secret)
      setQrCodeDataUrl(res.qrCodeDataUrl)
      setSetupStep('qr')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao iniciar configuração')
    } finally {
      setBusy(false)
    }
  }

  async function confirmSetup(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api.post<{ enabled: boolean; recoveryCodes: string[] }>('/2fa/confirm', {
        code: confirmCode,
      })
      setCodesToShow(res.recoveryCodes)
      setSetupStep('idle')
      setConfirmCode('')
      setQrCodeDataUrl('')
      setManualSecret('')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao confirmar código')
    } finally {
      setBusy(false)
    }
  }

  async function disable(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api.post('/2fa/disable', { code: disableCode })
      setShowDisableForm(false)
      setDisableCode('')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao desativar')
    } finally {
      setBusy(false)
    }
  }

  async function regenerate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api.post<{ recoveryCodes: string[] }>('/2fa/recovery-codes/regenerate', {
        code: regenCode,
      })
      setCodesToShow(res.recoveryCodes)
      setShowRegenForm(false)
      setRegenCode('')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao gerar novos códigos')
    } finally {
      setBusy(false)
    }
  }

  async function approveDevice(id: number) {
    await api.post(`/devices/${id}/approve`)
    await load()
  }

  async function revokeDevice(id: number) {
    if (!confirm('Revogar este dispositivo? Ele vai precisar ser aprovado de novo para entrar.')) return
    await api.del(`/devices/${id}`)
    await load()
  }

  if (loading) return <p className="text-gray-500 text-sm">Carregando...</p>

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-brand-dark">Segurança</h1>

      {codesToShow && (
        <div className="bg-white rounded-xl shadow p-5 border-2 border-brand-lime">
          <h2 className="font-semibold text-brand-dark mb-2">Guarde estes códigos de recuperação</h2>
          <p className="text-sm text-gray-600 mb-3">
            Cada código só funciona uma vez e serve para entrar caso você perca acesso ao seu app
            autenticador. Guarde num lugar seguro — eles não serão mostrados de novo.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-4 font-mono text-sm bg-gray-50 rounded-lg p-3">
            {codesToShow.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <button
            onClick={() => setCodesToShow(null)}
            className="bg-brand-dark text-white text-sm font-semibold rounded-lg px-4 py-2"
          >
            Já salvei, fechar
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-brand-dark mb-1">Verificação em duas etapas</h2>

        {status?.enabled ? (
          <>
            <p className="text-sm text-emerald-600 font-medium mb-3">✓ Ativada</p>
            <p className="text-xs text-gray-500 mb-4">
              Códigos de recuperação restantes: {status.recoveryCodesRemaining}
            </p>

            {!showDisableForm && !showRegenForm && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowRegenForm(true)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700"
                >
                  Gerar novos códigos de recuperação
                </button>
                <button
                  onClick={() => setShowDisableForm(true)}
                  className="text-sm border border-red-300 text-red-600 rounded-lg px-3 py-1.5"
                >
                  Desativar
                </button>
              </div>
            )}

            {showRegenForm && (
              <form onSubmit={regenerate} className="space-y-2 max-w-xs">
                <label className="block text-xs font-medium text-gray-600">
                  Confirme com um código do app autenticador
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  value={regenCode}
                  onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={busy} className="bg-brand-dark text-white text-sm rounded-lg px-3 py-1.5">
                    Confirmar
                  </button>
                  <button type="button" onClick={() => setShowRegenForm(false)} className="text-sm text-gray-500 underline">
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {showDisableForm && (
              <form onSubmit={disable} className="space-y-2 max-w-xs">
                <label className="block text-xs font-medium text-gray-600">
                  Confirme com um código do app autenticador para desativar
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={busy} className="bg-red-600 text-white text-sm rounded-lg px-3 py-1.5">
                    Desativar
                  </button>
                  <button type="button" onClick={() => setShowDisableForm(false)} className="text-sm text-gray-500 underline">
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </>
        ) : setupStep === 'idle' ? (
          <>
            <p className="text-sm text-gray-500 mb-3">Desativada</p>
            <button
              onClick={startSetup}
              disabled={busy}
              className="bg-brand-lime text-brand-dark font-semibold text-sm rounded-lg px-4 py-2"
            >
              Ativar verificação em duas etapas
            </button>
          </>
        ) : (
          <form onSubmit={confirmSetup} className="space-y-3">
            <p className="text-sm text-gray-600">
              Escaneie o QR code com um app autenticador (Google Authenticator, Microsoft
              Authenticator, Authy...) e digite o código gerado.
            </p>
            {qrCodeDataUrl && (
              <img src={qrCodeDataUrl} alt="QR code para configurar o app autenticador" className="w-44 h-44" />
            )}
            <p className="text-xs text-gray-500">
              Não conseguiu escanear? Digite manualmente este código no app:{' '}
              <span className="font-mono break-all">{manualSecret}</span>
            </p>
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-gray-600 mb-1">Código de 6 dígitos</label>
              <input
                type="text"
                inputMode="numeric"
                required
                maxLength={6}
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="bg-brand-dark text-white text-sm font-semibold rounded-lg px-4 py-2">
                Confirmar e ativar
              </button>
              <button
                type="button"
                onClick={() => {
                  setSetupStep('idle')
                  setConfirmCode('')
                }}
                className="text-sm text-gray-500 underline"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="bg-brand-dark text-white px-4 py-2 text-sm font-semibold">Dispositivos</div>
        <ul className="divide-y divide-gray-100">
          {devices.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">Nenhum dispositivo</li>}
          {devices.map((d) => (
            <li key={d.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {d.label} {d.isCurrent && <span className="text-xs text-gray-400">(este dispositivo)</span>}
                </p>
                <p className="text-xs text-gray-500">Último acesso: {formatDateTime(d.lastSeenAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusClasses[d.status]}`}>
                  {statusLabel[d.status]}
                </span>
                {d.status === 'pending' && (
                  <button onClick={() => approveDevice(d.id)} className="text-xs text-brand-dark underline">
                    Aprovar
                  </button>
                )}
                {d.status !== 'revoked' && (
                  <button onClick={() => revokeDevice(d.id)} className="text-xs text-red-600 underline">
                    Revogar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
