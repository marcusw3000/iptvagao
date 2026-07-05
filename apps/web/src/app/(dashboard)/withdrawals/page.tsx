'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle, XCircle, BadgeCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface Withdrawal {
  id: string
  amount: string
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  pixKey: string | null
  processedAt: string | null
  createdAt: string
  reseller: { id: string; name: string }
}

interface PaginatedWithdrawals {
  data: Withdrawal[]
  total: number
  page: number
  totalPages: number
}

const STATUS_LABELS: Record<Withdrawal['status'], string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  paid: 'Pago',
  rejected: 'Rejeitado',
}

const STATUS_COLORS: Record<Withdrawal['status'], string> = {
  pending: 'bg-yellow-900/40 text-yellow-400',
  approved: 'bg-blue-900/40 text-blue-400',
  paid: 'bg-emerald-900/40 text-emerald-400',
  rejected: 'bg-red-900/40 text-red-400',
}

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'approved', label: 'Aprovados' },
  { value: 'paid', label: 'Pagos' },
  { value: 'rejected', label: 'Rejeitados' },
]

export default function WithdrawalsPage() {
  const [result, setResult] = useState<PaginatedWithdrawals | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')

  function loadWithdrawals(p = 1, status = statusFilter) {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(p), limit: '20' })
    if (status) qs.set('status', status)
    api.get<PaginatedWithdrawals>(`/resellers/all-withdrawals?${qs}`)
      .then((r) => { setResult(r.data); setPage(p) })
      .catch(() => toast.error('Erro ao carregar saques'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadWithdrawals(1, statusFilter) }, [statusFilter])

  async function handleApprove(resellerId: string, wdId: string) {
    try {
      await api.patch(`/resellers/${resellerId}/withdrawals/${wdId}/approve`)
      loadWithdrawals(page)
      toast.success('Saque aprovado')
    } catch {
      toast.error('Erro ao aprovar saque')
    }
  }

  async function handleReject(resellerId: string, wdId: string) {
    try {
      await api.patch(`/resellers/${resellerId}/withdrawals/${wdId}/reject`)
      loadWithdrawals(page)
      toast.success('Saque rejeitado')
    } catch {
      toast.error('Erro ao rejeitar saque')
    }
  }

  async function handlePay(resellerId: string, wdId: string) {
    try {
      await api.patch(`/resellers/${resellerId}/withdrawals/${wdId}/pay`)
      loadWithdrawals(page)
      toast.success('Saque marcado como pago')
    } catch {
      toast.error('Erro ao marcar saque como pago')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Saques</h2>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                statusFilter === f.value
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Revendedor</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Chave PIX</th>
                  <th className="px-4 py-3 font-medium">Solicitado em</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((wd) => (
                  <tr key={wd.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3 text-white font-medium">{wd.reseller.name}</td>
                    <td className="px-4 py-3 text-white">R$ {Number(wd.amount).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-1 rounded-full', STATUS_COLORS[wd.status])}>
                        {STATUS_LABELS[wd.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{wd.pixKey ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(wd.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      {wd.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleApprove(wd.reseller.id, wd.id)}
                            className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-gray-800 rounded transition-colors"
                            title="Aprovar"
                          >
                            <CheckCircle size={14} />
                          </button>
                          <button
                            onClick={() => handleReject(wd.reseller.id, wd.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                            title="Rejeitar"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      )}
                      {wd.status === 'approved' && (
                        <button
                          onClick={() => handlePay(wd.reseller.id, wd.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-900/30 hover:bg-emerald-900/60 text-emerald-400 rounded transition-colors"
                        >
                          <BadgeCheck size={12} />
                          Marcar como Pago
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Nenhum saque encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result && result.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{result.total} saques</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => loadWithdrawals(page - 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Anterior</button>
                <span className="px-3 py-1">{page} / {result.totalPages}</span>
                <button disabled={page >= result.totalPages} onClick={() => loadWithdrawals(page + 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Próximo</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
