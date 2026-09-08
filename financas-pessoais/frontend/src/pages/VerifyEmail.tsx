import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useAuth } from '../context/AuthContext'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const { refreshUser } = useAuth()

  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('Link inválido.')
      return
    }
    api
      .post('/auth/verify-email', { token })
      .then(async () => {
        // Se este navegador já estiver logado com a mesma conta, atualiza o
        // status na hora para o aviso "confirme seu e-mail" sumir sem precisar relogar.
        await refreshUser().catch(() => {})
        setStatus('ok')
      })
      .catch((err) => {
        setStatus('error')
        setError(err instanceof ApiError ? err.message : 'Não foi possível conectar ao servidor')
      })
  }, [token, refreshUser])

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
        {status === 'checking' && <p className="text-gray-500 text-sm">Confirmando seu e-mail...</p>}

        {status === 'ok' && (
          <>
            <p className="text-4xl mb-3">✅</p>
            <h1 className="text-lg font-bold text-brand-dark mb-2">E-mail confirmado!</h1>
            <Link to="/" className="text-sm text-brand-dark underline">
              Ir para o app
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="text-4xl mb-3">⚠️</p>
            <h1 className="text-lg font-bold text-brand-dark mb-2">Não foi possível confirmar</h1>
            <p className="text-gray-600 text-sm mb-4">{error}</p>
            <Link to="/" className="text-sm text-brand-dark underline">
              Ir para o app
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
