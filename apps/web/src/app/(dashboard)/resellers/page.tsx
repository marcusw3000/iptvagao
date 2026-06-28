'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { UserCheck, Ban, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface Reseller {
  id: string
  name: string
  email: string
  commissionPct: string
  active: boolean
  referralCode: string
  createdAt: string
  clientCount: number
}

interface PaginatedResellers {
  data: Reseller[]
  total: number
  page: number
  totalPages: number
}

const createSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  commissionPct: z.coerce
    .number()
    .min(0, 'Mínimo 0')
    .max(100, 'Máximo 100')
    .optional(),
})

type CreateForm = z.infer<typeof createSchema>

export default function ResellersPage() {
  const [result, setResult] = useState<PaginatedResellers | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [page, setPage] = useState(1)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema) })

  function loadResellers(p = 1) {
    setLoading(true)
    api
      .get<PaginatedResellers>(`/resellers?page=${p}&limit=20`)
      .then((r) => {
        setResult(r.data)
        setPage(p)
      })
      .catch(() => toast.error('Erro ao carregar revendedores'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadResellers()
  }, [])

  async function onSubmit(data: CreateForm) {
    setCreating(true)
    try {
      await api.post('/resellers', data)
      setShowCreate(false)
      reset()
      loadResellers(page)
      toast.success('Revendedor criado com sucesso')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? 'Erro ao criar revendedor')
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(reseller: Reseller) {
    try {
      const endpoint = reseller.active
        ? `/resellers/${reseller.id}/suspend`
        : `/resellers/${reseller.id}/activate`
      await api.patch(endpoint)
      loadResellers(page)
      toast.success(reseller.active ? 'Revendedor suspenso' : 'Revendedor ativado')
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Revendedores</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <UserCheck size={16} />
          Novo Revendedor
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Comissão</th>
                  <th className="px-4 py-3 font-medium">Clientes</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((reseller) => (
                  <tr
                    key={reseller.id}
                    className="border-b border-gray-800 last:border-0"
                  >
                    <td className="px-4 py-3 text-white font-medium">
                      <Link
                        href={`/resellers/${reseller.id}`}
                        className="hover:text-indigo-400 transition-colors"
                      >
                        {reseller.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{reseller.email}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {Number(reseller.commissionPct).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {reseller.clientCount}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-xs px-2 py-1 rounded-full',
                          reseller.active
                            ? 'bg-emerald-900/40 text-emerald-400'
                            : 'bg-red-900/40 text-red-400',
                        )}
                      >
                        {reseller.active ? 'Ativo' : 'Suspenso'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(reseller)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                        title={reseller.active ? 'Suspender' : 'Ativar'}
                      >
                        {reseller.active ? (
                          <Ban size={14} />
                        ) : (
                          <CheckCircle size={14} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Nenhum revendedor cadastrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result && result.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{result.total} revendedores</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => loadResellers(page - 1)}
                  className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="px-3 py-1">
                  {page} / {result.totalPages}
                </span>
                <button
                  disabled={page >= result.totalPages}
                  onClick={() => loadResellers(page + 1)}
                  className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
                >
                  Próximo
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">
              Novo Revendedor
            </h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Nome *
                </label>
                <input
                  {...register('name')}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {errors.name && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  {...register('email')}
                  type="email"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {errors.email && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Comissão (%) — padrão 10%
                </label>
                <input
                  {...register('commissionPct')}
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="10"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {errors.commissionPct && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.commissionPct.message}
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false)
                    reset()
                  }}
                  className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
