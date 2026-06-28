'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'

interface Commission {
  id: string
  paymentId: string
  amount: string
  paid: boolean
  createdAt: string
}

interface PaginatedCommissions {
  data: Commission[]
  total: number
  page: number
  totalPages: number
}

export default function ResellerCommissionsPage() {
  const { resellerId } = useAuth()
  const [result, setResult] = useState<PaginatedCommissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const load = useCallback((p = 1) => {
    if (!resellerId) return
    setLoading(true)
    api.get<PaginatedCommissions>(`/resellers/${resellerId}/commissions?page=${p}&limit=20`)
      .then((r) => { setResult(r.data); setPage(p) })
      .catch(() => toast.error('Erro ao carregar comissões'))
      .finally(() => setLoading(false))
  }, [resellerId])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Minhas Comissões</h2>

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
                  <th className="px-4 py-3 font-medium">ID Pagamento</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Pago</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((c) => (
                  <tr key={c.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{c.paymentId}</td>
                    <td className="px-4 py-3 text-white font-semibold">R$ {Number(c.amount).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-1 rounded-full', c.paid ? 'bg-emerald-900/40 text-emerald-400' : 'bg-yellow-900/40 text-yellow-400')}>
                        {c.paid ? 'Pago' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                      Nenhuma comissão registrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result && result.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{result.total} comissões</span>
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
