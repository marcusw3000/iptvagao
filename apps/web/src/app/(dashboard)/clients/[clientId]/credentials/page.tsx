'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, KeyRound, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'

interface Credentials {
  username: string
  password?: string
}

export default function CredentialsPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [newCredentials, setNewCredentials] = useState<Credentials | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    api.get<Credentials>(`/clients/${clientId}/credentials`)
      .then((r) => setCredentials(r.data))
      .catch(() => toast.error('Erro ao carregar credenciais'))
      .finally(() => setLoading(false))
  }, [clientId])

  async function handleReset() {
    setResetting(true)
    try {
      const r = await api.post<Credentials>(`/clients/${clientId}/reset-credentials`)
      setNewCredentials(r.data)
      setCredentials({ username: r.data.username })
      toast.success('Credenciais redefinidas')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? 'Erro ao redefinir credenciais')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clients" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <Link href={`/clients/${clientId}/devices`} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">Dispositivos</Link>
        <Link href={`/clients/${clientId}/channels`} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">Canais</Link>
        <Link href={`/clients/${clientId}/subscription`} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">Assinatura</Link>
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-indigo-400" />
          <h2 className="text-2xl font-bold text-white">Credenciais</h2>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <div className="max-w-md">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-4">
            <h3 className="text-sm text-gray-400 mb-4">Credenciais atuais</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Usuário</p>
                <p className="text-white font-mono text-lg">{credentials?.username ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Senha</p>
                <p className="text-gray-400 text-sm">••••••  (não é possível visualizar)</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={resetting ? 'animate-spin' : ''} />
            {resetting ? 'Redefinindo...' : 'Redefinir Credenciais'}
          </button>

          {newCredentials && (
            <div className="mt-6 bg-emerald-900/20 border border-emerald-800 rounded-xl p-6">
              <p className="text-emerald-400 text-sm font-semibold mb-3">
                Novas credenciais geradas — anote antes de fechar!
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Usuário</p>
                  <p className="text-white font-mono text-lg">{newCredentials.username}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Senha</p>
                  <p className="text-white font-mono text-lg">{newCredentials.password}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
