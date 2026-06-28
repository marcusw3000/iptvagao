'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { DollarSign } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'

interface Withdrawal {
  id: string
  amount: string
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  pixKey: string | null
  processedAt: string | null
  createdAt: string
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

const withdrawalSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Valor mínimo R$ 0,01'),
  pixKey: z.string().min(1, 'Informe a chave PIX'),
})

type WithdrawalForm = z.infer<typeof withdrawalSchema>

export default function ResellerWithdrawalsPage() {
  const { resellerId } = useAuth()
  const [result, setResult] = useState<PaginatedWithdrawals | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRequest, setShowRequest] = useState(false)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<WithdrawalForm>({
    resolver: zodResolver(withdrawalSchema),
  })

  const load = useCallback((p = 1) => {
    if (!resellerId) return
    setLoading(true)
    api.get<PaginatedWithdrawals>(`/resellers/${resellerId}/withdrawals?page=${p}&limit=20`)
      .then((r) => { setResult(r.data); setPage(p) })
      .catch(() => toast.error('Erro ao carregar saques'))
      .finally(() => setLoading(false))
  }, [resellerId])

  useEffect(() => { load() }, [load])

  async function onSubmit(data: WithdrawalForm) {
    if (!resellerId) return
    setSaving(true)
    try {
      await api.post(`/resellers/${resellerId}/withdrawals`, data)
      setShowRequest(false)
      reset()
      load(1)
      toast.success('Saque solicitado com sucesso')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao solicitar saque')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Meus Saques</h2>
        <button
          onClick={() => setShowRequest(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <DollarSign size={16} />
          Solicitar Saque
        </button>
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
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Chave PIX</th>
                  <th className="px-4 py-3 font-medium">Processado em</th>
                  <th className="px-4 py-3 font-medium">Solicitado em</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((wd) => (
                  <tr key={wd.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3 text-white font-semibold">R$ {Number(wd.amount).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-1 rounded-full', STATUS_COLORS[wd.status])}>
                        {STATUS_LABELS[wd.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{wd.pixKey ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {wd.processedAt ? new Date(wd.processedAt).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(wd.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      Nenhum saque solicitado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result && result.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{result.total} saque{result.total !== 1 ? 's' : ''}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => load(page - 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Anterior</button>
                <span className="px-3 py-1">{page} / {result.totalPages}</span>
                <button disabled={page >= result.totalPages} onClick={() => load(page + 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Próximo</button>
              </div>
            </div>
          )}
        </>
      )}

      {showRequest && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Solicitar Saque</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Valor (R$) *</label>
                <input
                  {...register('amount')}
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="50.00"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {errors.amount && <p className="text-red-400 text-xs mt-1">{errors.amount.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Chave PIX *</label>
                <input
                  {...register('pixKey')}
                  placeholder="CPF, email, telefone ou chave aleatória"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {errors.pixKey && <p className="text-red-400 text-xs mt-1">{errors.pixKey.message}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowRequest(false); reset() }}
                  className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Solicitando...' : 'Solicitar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
