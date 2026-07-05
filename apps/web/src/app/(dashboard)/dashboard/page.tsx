'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users,
  CheckCircle,
  AlertCircle,
  Monitor,
  TrendingUp,
  DollarSign,
  Wifi,
  PauseCircle,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface RecentPayment {
  id: string
  clientName: string
  amount: string
  method: string
  paidAt: string | null
}

interface RecentClient {
  id: string
  name: string
  email: string
  createdAt: string
  planName: string | null
}

interface DashboardMetrics {
  totalClients: number
  activeSubscriptions: number
  suspendedSubscriptions: number
  pastDueSubscriptions: number
  totalDevices: number
  onlineDevices: number
  newClientsThisMonth: number
  mrr: number
  recentPayments: RecentPayment[]
  recentClients: RecentClient[]
}

const METHOD_LABELS: Record<string, string> = { pix: 'PIX', credit_card: 'Cartão' }

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

  const cards = [
    { label: 'Clientes Ativos', value: metrics.totalClients, icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-900/30' },
    { label: 'Assinaturas Ativas', value: metrics.activeSubscriptions, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
    { label: 'Suspensas', value: metrics.suspendedSubscriptions, icon: PauseCircle, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
    { label: 'Em Atraso', value: metrics.pastDueSubscriptions, icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-900/30' },
    { label: 'TVs Online', value: `${metrics.onlineDevices} / ${metrics.totalDevices}`, icon: Wifi, color: 'text-blue-400', bg: 'bg-blue-900/30' },
    { label: 'Novos este Mês', value: metrics.newClientsThisMonth, icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-900/30' },
    { label: 'MRR', value: `R$ ${metrics.mrr.toFixed(2)}`, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-900/30', wide: true },
  ]

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-white">Dashboard</h2>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color, bg, wide }) => (
          <div
            key={label}
            className={cn(
              'bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4',
              wide && 'sm:col-span-2 lg:col-span-1',
            )}
          >
            <div className={cn('p-3 rounded-lg', bg)}>
              <Icon size={22} className={color} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent payments */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Últimos Pagamentos</h3>
            <Link href="/subscriptions" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Ver todos
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs text-left">
                <th className="px-5 py-2 font-medium">Cliente</th>
                <th className="px-5 py-2 font-medium">Valor</th>
                <th className="px-5 py-2 font-medium">Método</th>
                <th className="px-5 py-2 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {metrics.recentPayments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-gray-600 text-xs">
                    Nenhum pagamento ainda
                  </td>
                </tr>
              )}
              {metrics.recentPayments.map((p) => (
                <tr key={p.id} className="border-t border-gray-800/60">
                  <td className="px-5 py-3 text-gray-300 truncate max-w-[140px]">{p.clientName}</td>
                  <td className="px-5 py-3 text-white font-medium tabular-nums">
                    R$ {Number(p.amount).toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{METHOD_LABELS[p.method] ?? p.method}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {p.paidAt ? new Date(p.paidAt).toLocaleDateString('pt-BR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent clients */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Novos Clientes</h3>
            <Link href="/clients" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Ver todos
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs text-left">
                <th className="px-5 py-2 font-medium">Nome</th>
                <th className="px-5 py-2 font-medium">Plano</th>
                <th className="px-5 py-2 font-medium">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {metrics.recentClients.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-6 text-center text-gray-600 text-xs">
                    Nenhum cliente ainda
                  </td>
                </tr>
              )}
              {metrics.recentClients.map((c) => (
                <tr key={c.id} className="border-t border-gray-800/60">
                  <td className="px-5 py-3">
                    <Link href={`/clients/${c.id}/subscription`} className="text-gray-300 hover:text-white transition-colors truncate block max-w-[160px]">
                      {c.name}
                    </Link>
                    <p className="text-gray-600 text-xs truncate max-w-[160px]">{c.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    {c.planName
                      ? <span className="text-xs px-2 py-0.5 bg-indigo-900/40 text-indigo-400 rounded-full">{c.planName}</span>
                      : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
