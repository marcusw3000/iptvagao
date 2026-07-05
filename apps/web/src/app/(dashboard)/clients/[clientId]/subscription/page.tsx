'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, CreditCard, CheckCircle, XCircle, RefreshCw, ArrowRightLeft } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface Plan {
  id: string
  name: string
  type: string
  price: string
}

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
  subscriptionId: string
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

const createSubSchema = z.object({
  planId: z.string().min(1, 'Selecione um plano'),
  endDate: z.string().min(1, 'Data obrigatória'),
})

const activateSchema = z.object({
  endDate: z.string().min(1, 'Data obrigatória'),
})

const paymentSchema = z.object({
  amount: z.string().min(1, 'Obrigatório'),
  method: z.enum(['pix', 'credit_card']),
  reference: z.string().optional(),
})

type CreateSubForm = z.infer<typeof createSubSchema>
type ActivateForm = z.infer<typeof activateSchema>
type PaymentForm = z.infer<typeof paymentSchema>

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

export default function SubscriptionPage() {
  const params = useParams()
  const clientId = params.clientId as string
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [payments, setPayments] = useState<PaginatedPayments | null>(null)
  const [loading, setLoading] = useState(true)
  const [payPage, setPayPage] = useState(1)

  const [showCreate, setShowCreate] = useState(false)
  const [showActivate, setShowActivate] = useState(false)
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [showChangePlan, setShowChangePlan] = useState(false)
  const [changingPlan, setChangingPlan] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [saving, setSaving] = useState(false)
  const [generatingCheckout, setGeneratingCheckout] = useState(false)

  const createForm = useForm<CreateSubForm>({ resolver: zodResolver(createSubSchema) })
  const activateForm = useForm<ActivateForm>({ resolver: zodResolver(activateSchema) })
  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { method: 'pix' },
  })

  async function loadSubscription() {
    try {
      const r = await api.get<Subscription>(`/subscriptions/by-client/${clientId}`)
      setSubscription(r.data)
      setNotFound(false)
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } }
      if (err?.response?.status === 404) {
        setNotFound(true)
        setSubscription(null)
      } else {
        toast.error('Erro ao carregar assinatura')
      }
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
    async function init() {
      setLoading(true)
      const [plansRes] = await Promise.all([
        api.get<Plan[]>('/plans').catch(() => ({ data: [] as Plan[] })),
        loadSubscription(),
      ])
      setPlans(plansRes.data)
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  useEffect(() => {
    if (subscription) {
      loadPayments(subscription)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription?.id])

  async function handleCreate(data: CreateSubForm) {
    setSaving(true)
    try {
      await api.post('/subscriptions', { ...data, clientId })
      setShowCreate(false)
      createForm.reset()
      await loadSubscription()
      toast.success('Assinatura criada')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? 'Erro ao criar assinatura')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    if (!subscription) return
    setSaving(true)
    try {
      await api.patch(`/subscriptions/${subscription.id}/cancel`)
      await loadSubscription()
      toast.success('Assinatura cancelada')
    } catch {
      toast.error('Erro ao cancelar assinatura')
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate(data: ActivateForm) {
    if (!subscription) return
    setSaving(true)
    try {
      await api.patch(`/subscriptions/${subscription.id}/activate`, { endDate: data.endDate })
      setShowActivate(false)
      activateForm.reset()
      await loadSubscription()
      toast.success('Assinatura ativada')
    } catch {
      toast.error('Erro ao ativar assinatura')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddPayment(data: PaymentForm) {
    if (!subscription) return
    setSaving(true)
    try {
      await api.post('/payments', {
        subscriptionId: subscription.id,
        amount: data.amount,
        method: data.method,
        reference: data.reference || undefined,
      })
      setShowAddPayment(false)
      paymentForm.reset({ method: 'pix' })
      await loadPayments(subscription, payPage)
      toast.success('Pagamento registrado')
    } catch {
      toast.error('Erro ao registrar pagamento')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePlan() {
    if (!subscription || !selectedPlanId) return
    setChangingPlan(true)
    try {
      await api.patch(`/subscriptions/${subscription.id}/change-plan`, { planId: selectedPlanId })
      setShowChangePlan(false)
      setSelectedPlanId('')
      await loadSubscription()
      toast.success('Plano alterado')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? 'Erro ao alterar plano')
    } finally {
      setChangingPlan(false)
    }
  }

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

  async function handleConfirmPayment(paymentId: string) {
    if (!subscription) return
    try {
      await api.patch(`/payments/${paymentId}/confirm`)
      await Promise.all([loadSubscription(), loadPayments(subscription, payPage)])
      toast.success('Pagamento confirmado')
    } catch {
      toast.error('Erro ao confirmar pagamento')
    }
  }

  if (loading) return <p className="text-gray-400">Carregando...</p>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clients" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <Link href={`/clients/${clientId}/devices`} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">Dispositivos</Link>
        <Link href={`/clients/${clientId}/credentials`} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">Credenciais</Link>
        <h2 className="text-2xl font-bold text-white">Assinatura</h2>
      </div>

      {/* No subscription state */}
      {notFound && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
          <CreditCard size={40} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400 mb-4">Este cliente não possui assinatura</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
          >
            Criar Assinatura
          </button>
        </div>
      )}

      {/* Subscription info */}
      {subscription && (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-semibold text-white">{subscription.plan.name}</h3>
                  <span className={cn('text-xs px-2 py-1 rounded-full', STATUS_COLORS[subscription.status])}>
                    {STATUS_LABELS[subscription.status]}
                  </span>
                </div>
                <p className="text-gray-400 text-sm">
                  R$ {Number(subscription.plan.price).toFixed(2)}/mês
                </p>
                <div className="mt-3 text-sm text-gray-500 space-y-1">
                  <p>Início: {new Date(subscription.startDate).toLocaleDateString('pt-BR')}</p>
                  {subscription.endDate && (
                    <p>Vencimento: {new Date(subscription.endDate).toLocaleDateString('pt-BR')}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setSelectedPlanId(subscription.planId); setShowChangePlan(true) }}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
                  title="Trocar plano"
                >
                  <ArrowRightLeft size={14} />
                  Trocar Plano
                </button>
                <button
                  onClick={() => setShowActivate(true)}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  title="Ativar / Renovar"
                >
                  <RefreshCw size={14} />
                  Renovar
                </button>
                {subscription.status !== 'cancelled' && (
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-red-400 text-sm rounded-lg transition-colors disabled:opacity-50"
                    title="Cancelar assinatura"
                  >
                    <XCircle size={14} />
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Payments section */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">Pagamentos</h3>
            <div className="flex gap-2">
              <button
                onClick={handleGenerateCheckout}
                disabled={generatingCheckout}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                {generatingCheckout ? 'Gerando...' : 'Gerar Cobrança'}
              </button>
              <button
                onClick={() => setShowAddPayment(true)}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
              >
                Registrar Pagamento
              </button>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Método</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Referência</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {payments?.data.map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3 text-white font-medium">
                      R$ {Number(payment.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 uppercase text-xs">
                      {payment.method === 'pix' ? 'PIX' : 'Cartão'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-1 rounded-full', PAYMENT_STATUS_COLORS[payment.status])}>
                        {PAYMENT_STATUS_LABELS[payment.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                      {payment.reference ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(payment.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      {payment.status === 'pending' && (
                        <button
                          onClick={() => handleConfirmPayment(payment.id)}
                          className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-gray-800 rounded transition-colors"
                          title="Confirmar pagamento"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {payments?.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
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
        </>
      )}

      {/* Change Plan Modal */}
      {showChangePlan && subscription && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Trocar Plano</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Novo plano *</label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Selecione...</option>
                  {plans.filter((p) => p.id !== subscription.planId).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — R$ {Number(p.price).toFixed(2)}/mês
                    </option>
                  ))}
                </select>
                <p className="text-gray-500 text-xs mt-1">
                  Atual: <span className="text-gray-400">{subscription.plan.name}</span>
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowChangePlan(false); setSelectedPlanId('') }} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button onClick={handleChangePlan} disabled={changingPlan || !selectedPlanId} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">{changingPlan ? 'Salvando...' : 'Confirmar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Subscription Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Nova Assinatura</h3>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Plano *</label>
                <select
                  {...createForm.register('planId')}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Selecione...</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — R$ {Number(p.price).toFixed(2)}/mês
                    </option>
                  ))}
                </select>
                {createForm.formState.errors.planId && (
                  <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.planId.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Vencimento *</label>
                <input
                  {...createForm.register('endDate')}
                  type="date"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {createForm.formState.errors.endDate && (
                  <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.endDate.message}</p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); createForm.reset() }} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">{saving ? 'Criando...' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activate / Renew Modal */}
      {showActivate && subscription && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Renovar Assinatura</h3>
            <form onSubmit={activateForm.handleSubmit(handleActivate)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Novo vencimento *</label>
                <input
                  {...activateForm.register('endDate')}
                  type="date"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {activateForm.formState.errors.endDate && (
                  <p className="text-red-400 text-xs mt-1">{activateForm.formState.errors.endDate.message}</p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowActivate(false); activateForm.reset() }} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50">{saving ? 'Salvando...' : 'Renovar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPayment && subscription && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Registrar Pagamento</h3>
            <form onSubmit={paymentForm.handleSubmit(handleAddPayment)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Valor (R$) *</label>
                <input
                  {...paymentForm.register('amount')}
                  placeholder="99.90"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {paymentForm.formState.errors.amount && (
                  <p className="text-red-400 text-xs mt-1">{paymentForm.formState.errors.amount.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Método *</label>
                <select
                  {...paymentForm.register('method')}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="pix">PIX</option>
                  <option value="credit_card">Cartão de Crédito</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Referência</label>
                <input
                  {...paymentForm.register('reference')}
                  placeholder="ID da transação, código PIX..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddPayment(false); paymentForm.reset({ method: 'pix' }) }} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">{saving ? 'Salvando...' : 'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
