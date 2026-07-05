'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'

interface ResellerClient {
  id: string
  name: string
  email: string
  active: boolean
  createdAt: string
  subscription: {
    status: 'active' | 'suspended' | 'cancelled' | 'past_due'
    plan: { name: string }
  } | null
}

interface PaginatedClients {
  data: ResellerClient[]
  total: number
  page: number
  totalPages: number
}

const SUB_STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  suspended: 'Suspensa',
  cancelled: 'Cancelada',
  past_due: 'Em atraso',
}

const SUB_STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-900/40 text-emerald-400',
  suspended: 'bg-yellow-900/40 text-yellow-400',
  cancelled: 'bg-red-900/40 text-red-400',
  past_due: 'bg-orange-900/40 text-orange-400',
}

export default function ResellerClientsPage() {
  const { resellerId } = useAuth()
  const [result, setResult] = useState<PaginatedClients | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const load = useCallback((p = 1) => {
    if (!resellerId) return
    setLoading(true)
    api.get<PaginatedClients>(`/clients?resellerId=${resellerId}&page=${p}&limit=20`)
      .then((r) => { setResult(r.data); setPage(p) })
      .catch(() => toast.error('Erro ao carregar clientes'))
      .finally(() => setLoading(false))
  }, [resellerId])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Users size={22} className="text-indigo-400" />
        <h2 className="text-2xl font-bold text-white">Meus Clientes</h2>
        {result && (
          <span className="text-gray-500 text-sm ml-1">{result.total} clientes</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Assinatura</th>
                  <th className="px-4 py-3 font-medium">Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((client) => (
                  <tr key={client.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3 text-white font-medium">{client.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{client.email}</td>
                    <td className="px-4 py-3">
                      {client.subscription
                        ? <span className="text-xs px-2 py-0.5 bg-indigo-900/40 text-indigo-400 rounded-full">{client.subscription.plan.name}</span>
                        : <span className="text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {client.subscription
                        ? (
                          <span className={cn('text-xs px-2 py-1 rounded-full', SUB_STATUS_COLORS[client.subscription.status])}>
                            {SUB_STATUS_LABELS[client.subscription.status]}
                          </span>
                        )
                        : <span className="text-gray-600 text-xs">Sem assinatura</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(client.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      Nenhum cliente indicado ainda
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result && result.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{result.total} clientes</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => load(page - 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Anterior</button>
                <span className="px-3 py-1">{page} / {result.totalPages}</span>
                <button disabled={page >= result.totalPages} onClick={() => load(page + 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Próximo</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
