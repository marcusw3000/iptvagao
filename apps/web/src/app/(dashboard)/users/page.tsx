'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { UserPlus, RefreshCw, Shield, HeadphonesIcon, DollarSign } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface User {
  id: string
  username: string
  email: string | null
  role: string
  active: boolean
  lastLoginAt: string | null
  createdAt: string
}

interface PaginatedUsers {
  data: User[]
  total: number
  page: number
  totalPages: number
}

const INTERNAL_ROLES = ['master_admin', 'support', 'financial'] as const
type InternalRole = (typeof INTERNAL_ROLES)[number]

const ROLE_LABELS: Record<string, string> = {
  master_admin: 'Admin',
  support: 'Suporte',
  financial: 'Financeiro',
}

const ROLE_COLORS: Record<string, string> = {
  master_admin: 'bg-purple-900/40 text-purple-400',
  support: 'bg-blue-900/40 text-blue-400',
  financial: 'bg-green-900/40 text-green-400',
}

const ROLE_ICONS: Record<string, React.ElementType> = {
  master_admin: Shield,
  support: HeadphonesIcon,
  financial: DollarSign,
}

function genUsername() {
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  return Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('')
}

function genPassword() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

const createSchema = z.object({
  username: z.string().regex(/^[a-z]{4}$/, '4 letras minúsculas'),
  password: z.string().regex(/^\d{6}$/, '6 dígitos'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  role: z.enum(INTERNAL_ROLES),
})

type CreateForm = z.infer<typeof createSchema>

export default function UsersPage() {
  const [result, setResult] = useState<PaginatedUsers | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [page, setPage] = useState(1)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { username: genUsername(), password: genPassword(), role: 'support' },
  })

  const loadUsers = useCallback((p = 1) => {
    setLoading(true)
    api.get<PaginatedUsers>(`/users?page=${p}&limit=20&internalOnly=true`)
      .then((r) => { setResult(r.data); setPage(p) })
      .catch(() => toast.error('Erro ao carregar usuários'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function onSubmit(data: CreateForm) {
    setCreating(true)
    try {
      await api.post('/users', {
        username: data.username,
        password: data.password,
        email: data.email || undefined,
        role: data.role,
      })
      setShowCreate(false)
      reset({ username: genUsername(), password: genPassword(), role: 'support' })
      loadUsers(page)
      toast.success('Usuário criado')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao criar usuário')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Usuários Internos</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <UserPlus size={16} />
          Novo Usuário
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
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Perfil</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Último acesso</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((user) => {
                  const RoleIcon = ROLE_ICONS[user.role] ?? Shield
                  return (
                    <tr key={user.id} className="border-b border-gray-800 last:border-0">
                      <td className="px-4 py-3 text-white font-mono">{user.username}</td>
                      <td className="px-4 py-3 text-gray-400">{user.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full', ROLE_COLORS[user.role] ?? 'bg-gray-800 text-gray-400')}>
                          <RoleIcon size={11} />
                          {ROLE_LABELS[user.role] ?? user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-1 rounded-full', user.active ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400')}>
                          {user.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('pt-BR') : '—'}
                      </td>
                    </tr>
                  )
                })}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Nenhum usuário interno cadastrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result && result.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{result.total} usuários</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => loadUsers(page - 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Anterior</button>
                <span className="px-3 py-1">{page} / {result.totalPages}</span>
                <button disabled={page >= result.totalPages} onClick={() => loadUsers(page + 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Próximo</button>
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Novo Usuário Interno</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Perfil *</label>
                <select
                  {...register('role')}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="support">Suporte</option>
                  <option value="financial">Financeiro</option>
                  <option value="master_admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Email</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="opcional"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Usuário <span className="text-gray-500">(4 letras)</span></label>
                <div className="flex gap-2">
                  <input
                    {...register('username')}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setValue('username', genUsername())}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
                    title="Gerar novo"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                {errors.username && <p className="text-red-400 text-xs mt-1">{errors.username.message}</p>}
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Senha <span className="text-gray-500">(6 dígitos)</span></label>
                <div className="flex gap-2">
                  <input
                    {...register('password')}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setValue('password', genPassword())}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
                    title="Gerar nova"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <p className="text-xs text-gray-500">
                Anote as credenciais — a senha não será exibida novamente.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); reset({ username: genUsername(), password: genPassword(), role: 'support' }) }}
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
