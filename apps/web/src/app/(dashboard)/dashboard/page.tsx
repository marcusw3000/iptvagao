'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  CheckCircle,
  AlertCircle,
  Monitor,
  TrendingUp,
  DollarSign,
} from 'lucide-react'
import { api } from '@/lib/api'

interface DashboardMetrics {
  totalClients: number
  activeSubscriptions: number
  pastDueSubscriptions: number
  totalDevices: number
  newClientsThisMonth: number
  mrr: number
}

interface MetricCard {
  label: string
  value: string
  icon: React.ElementType
  color: string
  bg: string
}

function buildCards(m: DashboardMetrics): MetricCard[] {
  return [
    { label: 'Clientes Ativos', value: String(m.totalClients), icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-900/30' },
    { label: 'Assinaturas Ativas', value: String(m.activeSubscriptions), icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
    { label: 'Em Atraso', value: String(m.pastDueSubscriptions), icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-900/30' },
    { label: 'Dispositivos Ativos', value: String(m.totalDevices), icon: Monitor, color: 'text-blue-400', bg: 'bg-blue-900/30' },
    { label: 'Novos este Mês', value: String(m.newClientsThisMonth), icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-900/30' },
    { label: 'MRR', value: `R$ ${m.mrr.toFixed(2)}`, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-900/30' },
  ]
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    api
      .get<DashboardMetrics>('/dashboard')
      .then((r) => setMetrics(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Dashboard</h2>
        <p className="text-red-400 text-sm">Erro ao carregar métricas. Tente recarregar a página.</p>
      </div>
    )
  }

  const cards = buildCards(metrics)

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4">
            <div className={`${bg} p-3 rounded-lg`}>
              <Icon size={22} className={color} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className="text-2xl font-bold text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
