'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  DollarSign,
  BadgeCheck,
} from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface ResellerDetail {
  id: string
  name: string
  email: string
  commissionPct: string
  active: boolean
  referralCode: string
  clientCount: number
  totalCommissions: string
  pendingWithdrawalAmount: string
  createdAt: string
}

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

const WITHDRAWAL_STATUS_LABELS: Record<Withdrawal['status'], string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  paid: 'Pago',
  rejected: 'Rejeitado',
}

const WITHDRAWAL_STATUS_COLORS: Record<Withdrawal['status'], string> = {
  pending: 'bg-yellow-900/40 text-yellow-400',
  approved: 'bg-blue-900/40 text-blue-400',
  paid: 'bg-emerald-900/40 text-emerald-400',
  rejected: 'bg-red-900/40 text-red-400',
}

const withdrawalSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Valor mínimo R$ 0,01'),
  pixKey: z.string().optional(),
})

type WithdrawalForm = z.infer<typeof withdrawalSchema>

type TabId = 'commissions' | 'withdrawals' | 'clients'

interface ResellerClient {
  id: string
  name: string
  email: string
  active: boolean
  createdAt: string
}

interface PaginatedClients {
  data: ResellerClient[]
  total: number
  page: number
  totalPages: number
}

export default function ResellerDetailPage() {
  const params = useParams()
  const resellerId = params.resellerId as string

  const [reseller, setReseller] = useState<ResellerDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<TabId>('commissions')

  const [commissions, setCommissions] = useState<PaginatedCommissions | null>(null)
  const [commPage, setCommPage] = useState(1)

  const [withdrawals, setWithdrawals] = useState<PaginatedWithdrawals | null>(null)
  const [wdPage, setWdPage] = useState(1)

  const [clients, setClients] = useState<PaginatedClients | null>(null)
  const [clientsPage, setClientsPage] = useState(1)

  const [showWithdrawal, setShowWithdrawal] = useState(false)
  const [saving, setSaving] = useState(false)

  const wdForm = useForm<WithdrawalForm>({
    resolver: zodResolver(withdrawalSchema),
  })

  async function loadReseller() {
    try {
      const r = await api.get<ResellerDetail>(`/resellers/${resellerId}`)
      setReseller(r.data)
    } catch {
      toast.error('Erro ao carregar revendedor')
    }
  }

  async function loadCommissions(p = 1) {
    try {
      const r = await api.get<PaginatedCommissions>(
        `/resellers/${resellerId}/commissions?page=${p}&limit=20`,
      )
      setCommissions(r.data)
      setCommPage(p)
    } catch {
      toast.error('Erro ao carregar comissões')
    }
  }

  async function loadWithdrawals(p = 1) {
    try {
      const r = await api.get<PaginatedWithdrawals>(
        `/resellers/${resellerId}/withdrawals?page=${p}&limit=20`,
      )
      setWithdrawals(r.data)
      setWdPage(p)
    } catch {
      toast.error('Erro ao carregar saques')
    }
  }

  async function loadClients(p = 1) {
    try {
      const r = await api.get<PaginatedClients>(
        `/clients?resellerId=${resellerId}&page=${p}&limit=20`,
      )
      setClients(r.data)
      setClientsPage(p)
    } catch {
      toast.error('Erro ao carregar clientes')
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([loadReseller(), loadCommissions(), loadWithdrawals(), loadClients()])
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resellerId])

  async function handleRequestWithdrawal(data: WithdrawalForm) {
    setSaving(true)
    try {
      await api.post(`/resellers/${resellerId}/withdrawals`, data)
      setShowWithdrawal(false)
      wdForm.reset()
      await Promise.all([loadReseller(), loadWithdrawals(wdPage)])
      toast.success('Solicitação de saque registrada')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? 'Erro ao solicitar saque')
    } finally {
      setSaving(false)
    }
  }

  async function handleApproveWithdrawal(wdId: string) {
    try {
      await api.patch(`/resellers/${resellerId}/withdrawals/${wdId}/approve`)
      await Promise.all([loadReseller(), loadWithdrawals(wdPage)])
      toast.success('Saque aprovado')
    } catch {
      toast.error('Erro ao aprovar saque')
    }
  }

  async function handleRejectWithdrawal(wdId: string) {
    try {
      await api.patch(`/resellers/${resellerId}/withdrawals/${wdId}/reject`)
      await loadWithdrawals(wdPage)
      toast.success('Saque rejeitado')
    } catch {
      toast.error('Erro ao rejeitar saque')
    }
  }

  async function handlePayWithdrawal(wdId: string) {
    try {
      await api.patch(`/resellers/${resellerId}/withdrawals/${wdId}/pay`)
      await Promise.all([loadReseller(), loadWithdrawals(wdPage)])
      toast.success('Saque marcado como pago')
    } catch {
      toast.error('Erro ao marcar saque como pago')
    }
  }

  if (loading) return <p className="text-gray-400">Carregando...</p>
  if (!reseller) return <p className="text-gray-400">Revendedor não encontrado</p>

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/resellers"
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-white">{reseller.name}</h2>
          <p className="text-gray-500 text-sm">{reseller.email}</p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Código de Indicação</p>
            <p className="text-white font-mono text-sm">{reseller.referralCode}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Comissão</p>
            <p className="text-white font-semibold">
              {Number(reseller.commissionPct).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Clientes</p>
            <p className="text-white font-semibold">{reseller.clientCount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Status</p>
            <span
              className={cn(
                'text-xs px-2 py-1 rounded-full',
                reseller.active
                  ? 'bg-emerald-900/40 text-emerald-400'
                  : 'bg-red-900/40 text-red-400',
              )}
            >
              {reseller.active ? 'Ativo' : 'Suspenso'}
            </span>
          </div>
        </div>
        <div className="mt-6 flex gap-6 border-t border-gray-800 pt-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Comissões Geradas</p>
            <p className="text-white font-semibold text-lg">
              R$ {Number(reseller.totalCommissions).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Saques Pendentes</p>
            <p className="text-yellow-400 font-semibold text-lg">
              R$ {Number(reseller.pendingWithdrawalAmount).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab('commissions')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'commissions'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white',
          )}
        >
          Comissões
        </button>
        <button
          onClick={() => setActiveTab('withdrawals')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'withdrawals'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white',
          )}
        >
          Saques
        </button>
        <button
          onClick={() => setActiveTab('clients')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'clients'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white',
          )}
        >
          Clientes
        </button>

        {activeTab === 'withdrawals' && (
          <button
            onClick={() => setShowWithdrawal(true)}
            className="ml-auto flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
          >
            <DollarSign size={14} />
            Solicitar Saque
          </button>
        )}
      </div>

      {activeTab === 'commissions' && (
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
                {commissions?.data.map((c) => (
                  <tr key={c.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{c.paymentId}</td>
                    <td className="px-4 py-3 text-white font-medium">
                      R$ {Number(c.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-1 rounded-full', c.paid ? 'bg-emerald-900/40 text-emerald-400' : 'bg-yellow-900/40 text-yellow-400')}>
                        {c.paid ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
                {commissions?.data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      Nenhuma comissão registrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {commissions && commissions.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{commissions.total} comissões</span>
              <div className="flex gap-2">
                <button disabled={commPage <= 1} onClick={() => loadCommissions(commPage - 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Anterior</button>
                <span className="px-3 py-1">{commPage} / {commissions.totalPages}</span>
                <button disabled={commPage >= commissions.totalPages} onClick={() => loadCommissions(commPage + 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Próximo</button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'withdrawals' && (
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
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals?.data.map((wd) => (
                  <tr key={wd.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3 text-white font-medium">
                      R$ {Number(wd.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-1 rounded-full', WITHDRAWAL_STATUS_COLORS[wd.status])}>
                        {WITHDRAWAL_STATUS_LABELS[wd.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{wd.pixKey ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {wd.processedAt ? new Date(wd.processedAt).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(wd.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      {wd.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleApproveWithdrawal(wd.id)} className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-gray-800 rounded transition-colors" title="Aprovar">
                            <CheckCircle size={14} />
                          </button>
                          <button onClick={() => handleRejectWithdrawal(wd.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors" title="Rejeitar">
                            <XCircle size={14} />
                          </button>
                        </div>
                      )}
                      {wd.status === 'approved' && (
                        <button
                          onClick={() => handlePayWithdrawal(wd.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-900/30 hover:bg-emerald-900/60 text-emerald-400 rounded transition-colors"
                          title="Marcar como pago"
                        >
                          <BadgeCheck size={12} />
                          Marcar como Pago
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {withdrawals?.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Nenhum saque solicitado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {withdrawals && withdrawals.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{withdrawals.total} saques</span>
              <div className="flex gap-2">
                <button disabled={wdPage <= 1} onClick={() => loadWithdrawals(wdPage - 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Anterior</button>
                <span className="px-3 py-1">{wdPage} / {withdrawals.totalPages}</span>
                <button disabled={wdPage >= withdrawals.totalPages} onClick={() => loadWithdrawals(wdPage + 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Próximo</button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'clients' && (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Desde</th>
                </tr>
              </thead>
              <tbody>
                {clients?.data.map((c) => (
                  <tr key={c.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-gray-400">{c.email}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-1 rounded-full', c.active ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400')}>
                        {c.active ? 'Ativo' : 'Suspenso'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
                {clients?.data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      Nenhum cliente vinculado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {clients && clients.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{clients.total} clientes</span>
              <div className="flex gap-2">
                <button disabled={clientsPage <= 1} onClick={() => loadClients(clientsPage - 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Anterior</button>
                <span className="px-3 py-1">{clientsPage} / {clients.totalPages}</span>
                <button disabled={clientsPage >= clients.totalPages} onClick={() => loadClients(clientsPage + 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Próximo</button>
              </div>
            </div>
          )}
        </>
      )}

      {showWithdrawal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Solicitar Saque</h3>
            <form onSubmit={wdForm.handleSubmit(handleRequestWithdrawal)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Valor (R$) *</label>
                <input
                  {...wdForm.register('amount')}
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="50.00"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {wdForm.formState.errors.amount && (
                  <p className="text-red-400 text-xs mt-1">{wdForm.formState.errors.amount.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Chave PIX</label>
                <input
                  {...wdForm.register('pixKey')}
                  placeholder="CPF, email, telefone ou chave aleatória"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowWithdrawal(false); wdForm.reset() }}
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
