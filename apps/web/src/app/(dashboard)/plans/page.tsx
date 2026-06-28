'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Plan {
  id: string
  name: string
  type: string
  price: string
  maxDevices: number
  maxChannels: number
  maxUsers: number
  storageGB: number
  active: boolean
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Plan[]>('/plans')
      .then((r) => setPlans(r.data))
      .catch(() => toast.error('Erro ao carregar planos'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-gray-400">Carregando...</p>
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Planos</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <span className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded-full uppercase">
                {plan.type}
              </span>
            </div>
            <p className="text-3xl font-bold text-white mb-4">
              R$ {Number(plan.price).toFixed(2)}
              <span className="text-sm font-normal text-gray-400">/mês</span>
            </p>
            <ul className="space-y-1.5 text-sm text-gray-400">
              <li>{plan.maxDevices} dispositivos</li>
              <li>{plan.maxChannels} canais</li>
              <li>{plan.maxUsers} usuários</li>
              <li>{plan.storageGB} GB armazenamento</li>
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
