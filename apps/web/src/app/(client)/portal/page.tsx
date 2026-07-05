'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CreditCard, MonitorPlay, Radio } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'

interface Subscription {
  status: 'active' | 'suspended' | 'cancelled' | 'past_due'
  plan: { name: string; price: string }
}

interface PaginatedMeta {
  total: number
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

export default function PortalPage() {
  const { clientId } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [subNotFound, setSubNotFound] = useState(false)
  const [deviceCount, setDeviceCount] = useState<number | null>(null)
  const [channelCount, setChannelCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return

    async function load() {
      setLoading(true)
      try {
        const [subRes, devRes, chRes] = await Promise.allSettled([
          api.get<Subscription>(`/subscriptions/by-client/${clientId}`),
          api.get<PaginatedMeta>(`/devices/by-client/${clientId}?page=1&limit=1`),
          api.get<unknown[]>(`/channels/for-client/${clientId}`),
        ])

        if (subRes.status === 'fulfilled') {
          setSubscription(subRes.value.data)
          setSubNotFound(false)
        } else {
          const err = subRes.reason as { response?: { status?: number } }
          if (err?.response?.status === 404) setSubNotFound(true)
          else toast.error('Erro ao carregar assinatura')
        }

        if (devRes.status === 'fulfilled') setDeviceCount(devRes.value.data.total)
        if (chRes.status === 'fulfilled') setChannelCount(chRes.value.data.length)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [clientId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Meu Painel</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-900/40 rounded-lg">
              <CreditCard size={20} className="text-indigo-400" />
            </div>
            <span className="text-gray-400 text-sm font-medium">Assinatura</span>
          </div>
          {subNotFound || !subscription ? (
            <p className="text-gray-500 text-sm">Sem assinatura</p>
          ) : (
            <>
              <p className="text-white font-semibold text-lg">{subscription.plan.name}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={cn('text-xs px-2 py-1 rounded-full', STATUS_COLORS[subscription.status])}>
                  {STATUS_LABELS[subscription.status]}
                </span>
                <span className="text-gray-500 text-xs">
                  R$ {Number(subscription.plan.price).toFixed(2)}/mês
                </span>
              </div>
            </>
          )}
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-900/40 rounded-lg">
              <MonitorPlay size={20} className="text-indigo-400" />
            </div>
            <span className="text-gray-400 text-sm font-medium">Dispositivos</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {deviceCount === null ? '—' : deviceCount}
          </p>
          <p className="text-gray-500 text-xs mt-1">dispositivos registrados</p>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-900/40 rounded-lg">
              <Radio size={20} className="text-indigo-400" />
            </div>
            <span className="text-gray-400 text-sm font-medium">Canais</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {channelCount === null ? '—' : channelCount}
          </p>
          <p className="text-gray-500 text-xs mt-1">canais disponíveis</p>
        </div>
      </div>
    </div>
  )
}
