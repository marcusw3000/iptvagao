'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { TrendingUp, DollarSign, Users, Clock, Copy, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'

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
}

export default function ResellerPortalPage() {
  const { resellerId } = useAuth()
  const [reseller, setReseller] = useState<ResellerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  useEffect(() => {
    if (!resellerId) return
    api.get<ResellerDetail>(`/resellers/${resellerId}`)
      .then((r) => setReseller(r.data))
      .catch(() => toast.error('Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [resellerId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!reseller) return <p className="text-gray-400">Dados não encontrados.</p>

  const cards = [
    { label: 'Clientes Indicados', value: String(reseller.clientCount), icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-900/30' },
    { label: 'Total de Comissões', value: `R$ ${Number(reseller.totalCommissions).toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
    { label: 'Saques Pendentes', value: `R$ ${Number(reseller.pendingWithdrawalAmount).toFixed(2)}`, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
    { label: 'Comissão', value: `${Number(reseller.commissionPct).toFixed(1)}%`, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-900/30' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">{reseller.name}</h2>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Seu código de indicação</p>
          <p className="text-2xl font-mono font-bold text-indigo-400 tracking-widest">{reseller.referralCode}</p>
          <p className="text-gray-600 text-xs mt-1">Compartilhe para ganhar comissão em cada pagamento</p>
        </div>
        <button
          onClick={() => copyCode(reseller.referralCode)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors shrink-0"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4">
            <div className={`${bg} p-3 rounded-lg`}>
              <Icon size={22} className={color} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className="text-xl font-bold text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
