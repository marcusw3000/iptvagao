'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CreditCard } from 'lucide-react'
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

export default function PortalSubscriptionPage() {
  const { clientId } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return
    api.get<Subscription>(`/subscriptions/by-client/${clientId}`)
      .then((r) => { setSubscription(r.data); setNotFound(false) })
      .catch((e: unknown) => {
        const err = e as { response?: { status?: number } }
        if (err?.response?.status === 404) setNotFound(true)
        else toast.error('Erro ao carregar assinatura')
      })
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) return <p className="text-gray-400">Carregando...</p>

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Minha Assinatura</h2>

      {notFound && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
          <CreditCard size={40} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400">Você não possui assinatura ativa.</p>
          <p className="text-gray-500 text-sm mt-1">
            Entre em contato com o suporte para contratar um plano.
          </p>
        </div>
      )}

      {subscription && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
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
              <div className="mt-4 space-y-1 text-sm text-gray-500">
                <p>
                  <span className="text-gray-400">Tipo:</span>{' '}
                  {subscription.plan.type}
                </p>
                <p>
                  <span className="text-gray-400">Início:</span>{' '}
                  {new Date(subscription.startDate).toLocaleDateString('pt-BR')}
                </p>
                {subscription.endDate && (
                  <p>
                    <span className="text-gray-400">Vencimento:</span>{' '}
                    {new Date(subscription.endDate).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            </div>
          </div>
          <p className="mt-6 text-xs text-gray-600">
            Para renovar ou cancelar sua assinatura entre em contato com o suporte.
          </p>
        </div>
      )}
    </div>
  )
}
