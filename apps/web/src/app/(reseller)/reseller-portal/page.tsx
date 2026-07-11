'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  TrendingUp,
  DollarSign,
  Users,
  Clock,
  Copy,
  Check,
  Pencil,
  Save,
  X,
} from 'lucide-react'
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

const referralCodeSchema = z.object({
  referralCode: z
    .string()
    .trim()
    .min(4, 'Minimo 4 caracteres')
    .max(12, 'Maximo 12 caracteres')
    .regex(/^[a-zA-Z0-9]+$/, 'Use apenas letras e numeros'),
})

type ReferralCodeForm = z.infer<typeof referralCodeSchema>

export default function ResellerPortalPage() {
  const { resellerId } = useAuth()
  const [reseller, setReseller] = useState<ResellerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [editingCode, setEditingCode] = useState(false)
  const [savingCode, setSavingCode] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReferralCodeForm>({
    resolver: zodResolver(referralCodeSchema),
  })

  async function loadReseller() {
    if (!resellerId) return
    const r = await api.get<ResellerDetail>(`/resellers/${resellerId}`)
    setReseller(r.data)
    reset({ referralCode: r.data.referralCode })
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  useEffect(() => {
    if (!resellerId) return
    loadReseller()
      .catch(() => toast.error('Erro ao carregar dados'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resellerId])

  async function onSubmitCode(data: ReferralCodeForm) {
    if (!resellerId) return
    setSavingCode(true)
    try {
      const referralCode = data.referralCode.trim().toUpperCase()
      const response = await api.patch<ResellerDetail>(`/resellers/${resellerId}/referral-code`, {
        referralCode,
      })
      setReseller((current) =>
        current ? { ...current, referralCode: response.data.referralCode } : response.data,
      )
      reset({ referralCode: response.data.referralCode })
      setEditingCode(false)
      toast.success('Codigo de indicacao atualizado')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? 'Erro ao atualizar codigo')
    } finally {
      setSavingCode(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!reseller) return <p className="text-gray-400">Dados nao encontrados.</p>

  const cards = [
    { label: 'Clientes Indicados', value: String(reseller.clientCount), icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-900/30' },
    { label: 'Total de Comissoes', value: `R$ ${Number(reseller.totalCommissions).toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
    { label: 'Saques Pendentes', value: `R$ ${Number(reseller.pendingWithdrawalAmount).toFixed(2)}`, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
    { label: 'Comissao', value: `${Number(reseller.commissionPct).toFixed(1)}%`, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-900/30' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">{reseller.name}</h2>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Seu codigo de indicacao</p>
          {editingCode ? (
            <form onSubmit={handleSubmit(onSubmitCode)} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  {...register('referralCode')}
                  autoCapitalize="characters"
                  className="w-48 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono tracking-[0.22em] focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={savingCode}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                >
                  <Save size={14} />
                  {savingCode ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    reset({ referralCode: reseller.referralCode })
                    setEditingCode(false)
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
                >
                  <X size={14} />
                  Cancelar
                </button>
              </div>
              {errors.referralCode && (
                <p className="text-red-400 text-xs">{errors.referralCode.message}</p>
              )}
            </form>
          ) : (
            <>
              <p className="text-2xl font-mono font-bold text-indigo-400 tracking-[0.22em]">
                {reseller.referralCode}
              </p>
              <p className="text-gray-600 text-xs mt-1">Compartilhe para ganhar comissao em cada pagamento</p>
            </>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setEditingCode(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
          >
            <Pencil size={14} />
            Editar
          </button>
          <button
            onClick={() => copyCode(reseller.referralCode)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
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
