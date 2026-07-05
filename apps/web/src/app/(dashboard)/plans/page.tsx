'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Pencil, Ban, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Plan {
  id: string
  name: string
  type: string
  price: string
  maxDevices: number
  maxChannels: number
  active: boolean
}

const planSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  type: z.enum(['basic', 'premium']),
  price: z.coerce.number().min(0, 'Mínimo 0'),
  maxDevices: z.coerce.number().int().min(1, 'Mínimo 1'),
  maxChannels: z.coerce.number().int().min(0, 'Mínimo 0'),
})

type PlanForm = z.infer<typeof planSchema>

const defaultValues: PlanForm = {
  name: '',
  type: 'basic',
  price: 0,
  maxDevices: 1,
  maxChannels: 10,
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [saving, setSaving] = useState(false)

  const form = useForm<PlanForm>({ resolver: zodResolver(planSchema), defaultValues })

  function loadPlans() {
    setLoading(true)
    api.get<Plan[]>('/plans?all=true')
      .then((r) => setPlans(r.data))
      .catch(() => toast.error('Erro ao carregar planos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadPlans() }, [])

  function openCreate() {
    form.reset(defaultValues)
    setEditingPlan(null)
    setShowCreate(true)
  }

  function openEdit(plan: Plan) {
    form.reset({
      name: plan.name,
      type: plan.type as 'basic' | 'premium',
      price: Number(plan.price),
      maxDevices: plan.maxDevices,
      maxChannels: plan.maxChannels,
    })
    setEditingPlan(plan)
    setShowCreate(true)
  }

  async function onSubmit(data: PlanForm) {
    setSaving(true)
    try {
      if (editingPlan) {
        await api.patch(`/plans/${editingPlan.id}`, data)
        toast.success('Plano atualizado')
      } else {
        await api.post('/plans', data)
        toast.success('Plano criado')
      }
      setShowCreate(false)
      setEditingPlan(null)
      form.reset(defaultValues)
      loadPlans()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao salvar plano')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(plan: Plan) {
    try {
      const endpoint = plan.active ? `/plans/${plan.id}/deactivate` : `/plans/${plan.id}/activate`
      await api.patch(endpoint)
      loadPlans()
      toast.success(plan.active ? 'Plano desativado' : 'Plano ativado')
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  if (loading) return <p className="text-gray-400">Carregando...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Planos</h2>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Novo Plano
        </button>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Preço/mês</th>
              <th className="px-4 py-3 font-medium">Dispositivos</th>
              <th className="px-4 py-3 font-medium">Canais</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-gray-800 last:border-0">
                <td className="px-4 py-3 text-white font-medium">{plan.name}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded-full uppercase">
                    {plan.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-white">R$ {Number(plan.price).toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-400">{plan.maxDevices}</td>
                <td className="px-4 py-3 text-gray-400">{plan.maxChannels}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'text-xs px-2 py-1 rounded-full',
                    plan.active ? 'bg-emerald-900/40 text-emerald-400' : 'bg-gray-800 text-gray-500',
                  )}>
                    {plan.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(plan)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => toggleActive(plan)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                      title={plan.active ? 'Desativar' : 'Ativar'}
                    >
                      {plan.active ? <Ban size={14} /> : <CheckCircle size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Nenhum plano cadastrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingPlan ? 'Editar Plano' : 'Novo Plano'}
            </h3>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Nome *</label>
                  <input {...form.register('name')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
                  {form.formState.errors.name && <p className="text-red-400 text-xs mt-1">{form.formState.errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Tipo *</label>
                  <select {...form.register('type')} disabled={!!editingPlan} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50">
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Preço mensal (R$) *</label>
                <input {...form.register('price')} type="number" step="0.01" min="0" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
                {form.formState.errors.price && <p className="text-red-400 text-xs mt-1">{form.formState.errors.price.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Dispositivos *</label>
                  <input {...form.register('maxDevices')} type="number" min="1" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Canais *</label>
                  <input {...form.register('maxChannels')} type="number" min="0" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setEditingPlan(null) }} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">
                  {saving ? 'Salvando...' : editingPlan ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
