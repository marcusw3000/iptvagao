'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'

interface Credentials {
  username: string
  password: string | null
}

export default function PortalCredentialsPage() {
  const { clientId } = useAuth()
  const [creds, setCreds] = useState<Credentials | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [newCreds, setNewCreds] = useState<Credentials | null>(null)

  useEffect(() => {
    if (!clientId) return
    api.get<Credentials>(`/clients/${clientId}/credentials`)
      .then((r) => setCreds(r.data))
      .catch(() => toast.error('Erro ao carregar credenciais'))
      .finally(() => setLoading(false))
  }, [clientId])

  async function handleReset() {
    if (!clientId) return
    if (!confirm('Gerar novas credenciais? As credenciais atuais deixarão de funcionar na TV.')) return
    setResetting(true)
    try {
      const r = await api.post<Credentials>(`/clients/${clientId}/reset-credentials`)
      setNewCreds(r.data)
      setCreds({ username: r.data.username, password: null })
      setShowPassword(true)
      toast.success('Credenciais geradas com sucesso')
    } catch {
      toast.error('Erro ao gerar credenciais')
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-md space-y-6">
      <div className="flex items-center gap-3">
        <KeyRound size={22} className="text-indigo-400" />
        <h2 className="text-2xl font-bold text-white">Credenciais de Acesso</h2>
      </div>

      <p className="text-gray-400 text-sm">
        Use essas credenciais para fazer login no aplicativo Smart TV.
      </p>

      {/* New credentials banner */}
      {newCreds && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl p-4">
          <p className="text-emerald-400 text-sm font-medium mb-1">Novas credenciais geradas!</p>
          <p className="text-gray-300 text-sm">
            Anote a senha agora — ela não será exibida novamente.
          </p>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">
        {/* Username */}
        <div>
          <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Usuário</label>
          <div className="flex items-center gap-2">
            <code className="text-xl font-bold text-white tracking-widest font-mono">
              {creds?.username ?? '—'}
            </code>
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Senha</label>
          {newCreds?.password ? (
            <div className="flex items-center gap-3">
              <code className="text-xl font-bold text-white tracking-widest font-mono">
                {showPassword ? newCreds.password : '••••••'}
              </code>
              <button
                onClick={() => setShowPassword((v) => !v)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              A senha atual não pode ser exibida por segurança. Gere novas credenciais para obter uma nova senha.
            </p>
          )}
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={resetting ? 'animate-spin' : ''} />
          {resetting ? 'Gerando...' : 'Gerar Novas Credenciais'}
        </button>
        <p className="text-gray-600 text-xs mt-2">
          Ao gerar novas credenciais, os logins ativos no app TV serão encerrados.
        </p>
      </div>
    </div>
  )
}
