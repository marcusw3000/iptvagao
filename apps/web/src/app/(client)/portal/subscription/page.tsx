'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CreditCard, CheckCircle, ExternalLink } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'

interface SubscriptionPlan {
  id: string
  name: string
  type: string
  price: string
}

interface Subscription {
  id: string
  clientId: string
  planId: string
  status: 'active' | 'suspended' | 'cancelled' | 'past_due'
  startDate: string
  endDate: string | null
  plan: SubscriptionPlan
}

interface Payment {
  id: string
  amount: string
  method: 'pix' | 'credit_card'
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  reference: string | null
  paidAt: string | null
  createdAt: string
}

interface PaginatedPayments {
  data: Payment[]
  total: number
  page: number
  totalPages: number
}

const STATUS_LABELS: Record<Subscription['status'], string> = {
  active: 'Ativa',
  suspended: 'Suspensa',
  cancelled: 'Cancelada',
  past_due: 'Em atraso',
}

const STATUS_COLORS: Record<Subscription['status'], string> = {
  active: 'bg-emerald-900/40 text-emerald-400',
  suspended: 'bg-yellow-900/40 text-yellow-400',
  cancelled: 'bg-red-900/40 text-red-400',
  past_due: 'bg-orange-900/40 text-orange-400',
}

const PAYMENT_STATUS_LABELS: Record<Payment['status'], string> = {
  pending: 'Pendente',
  paid: 'Pago',
  failed: 'Falhou',
  refunded: 'Estornado',
}

const PAYMENT_STATUS_COLORS: Record<Payment['status'], string> = {
  pending: 'bg-yellow-900/40 text-yellow-400',
  paid: 'bg-emerald-900/40 text-emerald-400',
  failed: 'bg-red-900/40 text-red-400',
  refunded: 'bg-gray-800 text-gray-400',
}

const METHOD_LABELS: Record<string, string> = { pix: 'PIX', credit_card: 'Cartão' }

export default function PortalSubscriptionPage() {
  const { clientId } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [payments, setPayments] = useState<PaginatedPayments | null>(null)
  const [payPage, setPayPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [generatingCheckout, setGeneratingCheckout] = useState(false)

  async function loadSubscription() {
    if (!clientId) return
    try {
      const r = await api.get<Subscription>(`/subscriptions/by-client/${clientId}`)
      setSubscription(r.data)
      setNotFound(false)
      return r.data
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } }
      if (err?.response?.status === 404) setNotFound(true)
      else toast.error('Erro ao carregar assinatura')
      return null
    }
  }

  async function loadPayments(sub: Subscription, p = 1) {
    try {
      const r = await api.get<PaginatedPayments>(
        `/payments/by-subscription/${sub.id}?page=${p}&limit=10`,
      )
      setPayments(r.data)
      setPayPage(p)
    } catch {
      toast.error('Erro ao carregar pagamentos')
    }
  }

  useEffect(() => {
    if (!clientId) return
    async function init() {
      setLoading(true)
      const sub = await loadSubscription()
      if (sub) await loadPayments(sub)
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  async function handleGenerateCheckout() {
    if (!subscription) return
    setGeneratingCheckout(true)
    try {
      const r = await api.post<{ paymentId: string; checkoutUrl: string }>('/payments/checkout', {
        subscriptionId: subscription.id,
      })
      window.open(r.data.checkoutUrl, '_blank', 'noopener,noreferrer')
      await loadPayments(subscription, payPage)
      toast.success('Link de pagamento gerado')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? 'Erro ao gerar cobrança')
    } finally {
      setGeneratingCheckout(false)
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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Minha Assinatura</h2>

      {notFound && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
          <CreditCard size={40} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400">Você não possui assinatura ativa.</p>
          <p className="text-gray-500 text-sm mt-1">Entre em contato com o suporte para contratar um plano.</p>
        </div>
      )}

      {subscription && (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-semibold text-white">{subscription.plan.name}</h3>
                  <span className={cn('text-xs px-2 py-1 rounded-full', STATUS_COLORS[subscription.status])}>
                    {STATUS_LABELS[subscription.status]}
                  </span>
                </div>
                <p className="text-gray-400 text-sm">R$ {Number(subscription.plan.price).toFixed(2)}/mês</p>
                <div className="mt-3 space-y-1 text-sm text-gray-500">
                  <p><span className="text-gray-400">Início:</span>{' '}{new Date(subscription.startDate).toLocaleDateString('pt-BR')}</p>
                  {subscription.endDate && (
                    <p><span className="text-gray-400">Vencimento:</span>{' '}{new Date(subscription.endDate).toLocaleDateString('pt-BR')}</p>
                  )}
                </div>
              </div>

              {(subscription.status === 'past_due' || subscription.status === 'suspended') && (
                <button
                  onClick={handleGenerateCheckout}
                  disabled={generatingCheckout}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  <ExternalLink size={14} />
                  {generatingCheckout ? 'Gerando...' : 'Pagar Agora'}
                </button>
              )}
            </div>
          </div>

          {/* Payment history */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">Histórico de Pagamentos</h3>
              {subscription.status === 'active' && (
                <button
                  onClick={handleGenerateCheckout}
                  disabled={generatingCheckout}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
                >
                  <ExternalLink size={14} />
                  {generatingCheckout ? 'Gerando...' : 'Gerar Cobrança'}
                </button>
              )}
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-left">
                    <th className="px-4 py-3 font-medium">Valor</th>
                    <th className="px-4 py-3 font-medium">Método</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {payments?.data.map((p) => (
                    <tr key={p.id} className="border-b border-gray-800 last:border-0">
                      <td className="px-4 py-3 text-white font-medium tabular-nums">
                        R$ {Number(p.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{METHOD_LABELS[p.method] ?? p.method}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-1 rounded-full', PAYMENT_STATUS_COLORS[p.status])}>
                          {PAYMENT_STATUS_LABELS[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {p.paidAt
                          ? new Date(p.paidAt).toLocaleDateString('pt-BR')
                          : new Date(p.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                  {payments?.data.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        Nenhum pagamento registrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {payments && payments.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
                <span>{payments.total} pagamentos</span>
                <div className="flex gap-2">
                  <button disabled={payPage <= 1} onClick={() => loadPayments(subscription, payPage - 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Anterior</button>
                  <span className="px-3 py-1">{payPage} / {payments.totalPages}</span>
                  <button disabled={payPage >= payments.totalPages} onClick={() => loadPayments(subscription, payPage + 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Próximo</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
