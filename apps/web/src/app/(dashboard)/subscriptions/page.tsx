'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface Plan {
  id: string
  name: string
  type: string
  price: string
}

interface ClientRef {
  id: string
  name: string
  email: string
}

interface Subscription {
  id: string
  clientId: string
  planId: string
  status: string
  startDate: string
  endDate: string | null
  createdAt: string
  plan: Plan
  client: ClientRef
}

interface PaginatedSubscriptions {
  data: Subscription[]
  total: number
  page: number
  totalPages: number
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  suspended: 'Suspensa',
  cancelled: 'Cancelada',
  past_due: 'Em atraso',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-900/40 text-emerald-400',
  suspended: 'bg-yellow-900/40 text-yellow-400',
  cancelled: 'bg-gray-800 text-gray-500',
  past_due: 'bg-red-900/40 text-red-400',
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'active', label: 'Ativas' },
  { value: 'past_due', label: 'Em atraso' },
  { value: 'suspended', label: 'Suspensas' },
  { value: 'cancelled', label: 'Canceladas' },
]

export default function SubscriptionsPage() {
  const [result, setResult] = useState<PaginatedSubscriptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')

  const loadSubscriptions = useCallback((p = 1, status = '') => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), limit: '20' })
    if (status) params.set('status', status)
    api.get<PaginatedSubscriptions>(`/subscriptions?${params}`)
      .then((r) => { setResult(r.data); setPage(p) })
      .catch(() => toast.error('Erro ao carregar assinaturas'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadSubscriptions(1, statusFilter) }, [loadSubscriptions, statusFilter])

  function handleStatusChange(s: string) {
    setStatusFilter(s)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Assinaturas</h2>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleStatusChange(value)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                statusFilter === value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white',
              )}
            >
              {label}
            </button>
          ))}
        </div>
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
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Início</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((sub) => (
                  <tr key={sub.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{sub.client.name}</p>
                      <p className="text-gray-500 text-xs">{sub.client.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white">{sub.plan.name}</p>
                      <p className="text-gray-500 text-xs">R$ {Number(sub.plan.price).toFixed(2)}/mês</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-1 rounded-full', STATUS_COLORS[sub.status] ?? 'bg-gray-800 text-gray-400')}>
                        {STATUS_LABELS[sub.status] ?? sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(sub.startDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {sub.endDate
                        ? <span className={cn(new Date(sub.endDate) < new Date() ? 'text-red-400' : '')}>
                            {new Date(sub.endDate).toLocaleDateString('pt-BR')}
                          </span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients/${sub.clientId}/subscription`}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors inline-flex"
                        title="Ver assinatura do cliente"
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      Nenhuma assinatura encontrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{result.total} assinatura{result.total !== 1 ? 's' : ''}</span>
              {result.totalPages > 1 && (
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => loadSubscriptions(page - 1, statusFilter)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Anterior</button>
                  <span className="px-3 py-1">{page} / {result.totalPages}</span>
                  <button disabled={page >= result.totalPages} onClick={() => loadSubscriptions(page + 1, statusFilter)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Próximo</button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
