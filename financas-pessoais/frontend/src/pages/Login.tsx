import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../api'
import type { LoginResult, User } from '../types'

type Step = 'form' | 'totp' | 'pending' | 'forgot'

export default function Login() {
  const { completeAuth } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [step, setStep] = useState<Step>('form')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [totpCode, setTotpCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')

  const [deviceLabel, setDeviceLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [forgotSent, setForgotSent] = useState(false)

  const attemptLoginRef = useRef<(silent?: boolean) => Promise<void>>(async () => {})

  async function attemptLogin(silent = false) {
    if (!silent) {
      setError(null)
      setLoading(true)
    }
    try {
      const body: Record<string, string> = { email, password }
      if (useRecovery && recoveryCode) body.recoveryCode = recoveryCode
      else if (totpCode) body.totpCode = totpCode

      const res = await api.post<LoginResult>('/auth/login', body)

      if (res.token && res.user) {
        completeAuth(res.token, res.user)
        return
      }
      if (res.requires2fa) {
        setStep('totp')
        return
      }
      if (res.devicePending) {
        setDeviceLabel(res.deviceLabel ?? '')
        setStep('pending')
        return
      }
    } catch (err) {
      if (!silent) setError(err instanceof ApiError ? err.message : 'Não foi possível conectar ao servidor')
    } finally {
      if (!silent) setLoading(false)
    }
  }
  attemptLoginRef.current = attemptLogin

  // Enquanto aguarda aprovação do dispositivo, tenta de novo automaticamente a cada 5s.
  useEffect(() => {
    if (step !== 'pending') return
    const interval = setInterval(() => {
      attemptLoginRef.current(true)
    }, 5000)
    return () => clearInterval(interval)
  }, [step])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'register') {
      setLoading(true)
      try {
        const res = await api.post<{ token: string; user: User }>('/auth/register', {
          name,
          email,
          password,
        })
        completeAuth(res.token, res.user)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Não foi possível conectar ao servidor')
      } finally {
        setLoading(false)
      }
      return
    }

    await attemptLogin()
  }

  async function handleTotpSubmit(e: FormEvent) {
    e.preventDefault()
    await attemptLogin()
  }

  function backToForm() {
    setStep('form')
    setTotpCode('')
    setRecoveryCode('')
    setUseRecovery(false)
    setForgotSent(false)
    setError(null)
  }

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setForgotSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível conectar ao servidor')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
          <p className="text-4xl mb-3">🔒</p>
          <h1 className="text-lg font-bold text-brand-dark mb-2">Aprovação necessária</h1>
          <p className="text-gray-600 text-sm mb-1">
            Este dispositivo{deviceLabel ? ` (${deviceLabel})` : ''} ainda não é confiável.
          </p>
          <p className="text-gray-600 text-sm mb-6">
            Abra o app em um dispositivo que já usa esta conta, vá em <strong>Segurança → Dispositivos</strong> e
            aprove este acesso. Isso é verificado automaticamente a cada poucos segundos.
          </p>
          <button
            onClick={() => attemptLogin()}
            disabled={loading}
            className="w-full bg-brand-dark text-white font-semibold rounded-lg py-2.5 hover:bg-brand-dark/90 disabled:opacity-60 mb-3"
          >
            {loading ? 'Verificando...' : 'Verificar agora'}
          </button>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <button type="button" onClick={backToForm} className="text-sm text-gray-500 underline">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  if (step === 'forgot') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-lg font-bold text-brand-dark mb-1">Esqueci minha senha</h1>

          {forgotSent ? (
            <>
              <p className="text-gray-600 text-sm mb-6">
                Se <strong>{email}</strong> tiver uma conta aqui, enviamos um link para redefinir a senha. Confira
                também a caixa de spam.
              </p>
              <button type="button" onClick={backToForm} className="text-sm text-brand-dark underline w-full text-center">
                Voltar para o login
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 text-sm mb-6">
                Informe o e-mail da sua conta para receber um link de redefinição.
              </p>
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-lime"
                />
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-dark text-white font-semibold rounded-lg py-2.5 hover:bg-brand-dark/90 disabled:opacity-60"
                >
                  {loading ? 'Enviando...' : 'Enviar link de redefinição'}
                </button>
              </form>
              <button type="button" onClick={backToForm} className="mt-4 text-sm text-gray-500 underline w-full text-center">
                Voltar
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (step === 'totp') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-lg font-bold text-brand-dark mb-1">Verificação em duas etapas</h1>
          <p className="text-gray-500 text-sm mb-6">
            {useRecovery
              ? 'Informe um dos seus códigos de recuperação.'
              : 'Digite o código de 6 dígitos do seu app autenticador.'}
          </p>

          <form onSubmit={handleTotpSubmit} className="space-y-4">
            {useRecovery ? (
              <input
                type="text"
                required
                autoFocus
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="XXXXX-XXXXX"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-lime"
              />
            ) : (
              <input
                type="text"
                inputMode="numeric"
                required
                autoFocus
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-2xl tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-brand-lime"
              />
            )}

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-dark text-white font-semibold rounded-lg py-2.5 hover:bg-brand-dark/90 disabled:opacity-60"
            >
              {loading ? 'Verificando...' : 'Confirmar'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setUseRecovery((v) => !v)
              setError(null)
            }}
            className="mt-4 text-sm text-brand-dark underline w-full text-center"
          >
            {useRecovery ? 'Usar código do app autenticador' : 'Usar código de recuperação'}
          </button>
          <button type="button" onClick={backToForm} className="mt-2 text-sm text-gray-500 underline w-full text-center">
            Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-brand-dark mb-1">Finanças Pessoais</h1>
        <p className="text-gray-500 text-sm mb-6">
          {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta gratuita'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-lime"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-lime"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Senha</label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setStep('forgot')
                    setError(null)
                  }}
                  className="text-xs text-brand-dark underline"
                >
                  Esqueci minha senha
                </button>
              )}
            </div>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-lime"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-dark text-white font-semibold rounded-lg py-2.5 hover:bg-brand-dark/90 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError(null)
          }}
          className="mt-4 text-sm text-brand-dark underline w-full text-center"
        >
          {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
      </div>
    </div>
  )
}
