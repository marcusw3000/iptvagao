'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { UserPlus, Ban, CheckCircle, Tv, Pencil, Search } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface Client {
  id: string
  name: string
  email: string
  phone: string | null
  document: string | null
  active: boolean
  createdAt: string
  reseller: { id: string; name: string } | null
}

interface PaginatedClients {
  data: Client[]
  total: number
  page: number
  totalPages: number
}

const createSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  document: z.string().optional(),
  resellerId: z.string().optional(),
})

const editSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  document: z.string().optional(),
})

type CreateForm = z.infer<typeof createSchema>
type EditForm = z.infer<typeof editSchema>

interface Credentials {
  username: string
  password: string
}

export default function ClientsPage() {
  const [result, setResult] = useState<PaginatedClients | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCredentials, setNewCredentials] = useState<Credentials | null>(null)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [resellers, setResellers] = useState<{ id: string; name: string }[]>([])

  const [search, setSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const createForm = useForm<CreateForm>({ resolver: zodResolver(createSchema) })
  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) })

  function loadClients(p = 1, q = search) {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(p), limit: '20' })
    if (q) qs.set('search', q)
    api.get<PaginatedClients>(`/clients?${qs}`)
      .then((r) => { setResult(r.data); setPage(p) })
      .catch(() => toast.error('Erro ao carregar clientes'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadClients(1, '') }, [])

  function handleSearch(val: string) {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadClients(1, val), 400)
  }

  useEffect(() => {
    api.get<{ data: { id: string; name: string }[] }>('/resellers?limit=200')
      .then((r) => setResellers(r.data.data))
      .catch(() => {})
  }, [])

  async function onCreate(data: CreateForm) {
    setCreating(true)
    try {
      const r = await api.post<{ client: Client; credentials: Credentials }>('/clients', {
        ...data,
        resellerId: data.resellerId || undefined,
      })
      setNewCredentials(r.data.credentials)
      setShowCreate(false)
      createForm.reset()
      loadClients(page, search)
      toast.success('Cliente criado com sucesso')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao criar cliente')
    } finally {
      setCreating(false)
    }
  }

  function openEdit(client: Client) {
    setEditingClient(client)
    editForm.reset({
      name: client.name,
      email: client.email,
      phone: client.phone ?? '',
      document: client.document ?? '',
    })
  }

  async function onEdit(data: EditForm) {
    if (!editingClient) return
    setSaving(true)
    try {
      await api.patch(`/clients/${editingClient.id}`, {
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        document: data.document || undefined,
      })
      setEditingClient(null)
      loadClients(page, search)
      toast.success('Cliente atualizado')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao atualizar cliente')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(client: Client) {
    try {
      const endpoint = client.active ? `/clients/${client.id}/suspend` : `/clients/${client.id}/activate`
      await api.patch(endpoint)
      loadClients(page, search)
      toast.success(client.active ? 'Cliente suspenso' : 'Cliente ativado')
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Clientes</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-52"
            />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <UserPlus size={16} />
            Novo Cliente
          </button>
        </div>
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
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Revendedor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((client) => (
                  <tr key={client.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3 text-white font-medium">{client.name}</td>
                    <td className="px-4 py-3 text-gray-400">{client.email}</td>
                    <td className="px-4 py-3 text-gray-400">{client.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{client.reseller?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full',
                        client.active ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400',
                      )}>
                        {client.active ? 'Ativo' : 'Suspenso'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/clients/${client.id}/devices`}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                          title="Dispositivos"
                        >
                          <Tv size={14} />
                        </Link>
                        <button
                          onClick={() => openEdit(client)}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => toggleActive(client)}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                          title={client.active ? 'Suspender' : 'Ativar'}
                        >
                          {client.active ? <Ban size={14} /> : <CheckCircle size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Nenhum cliente cadastrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result && result.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{result.total} clientes</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => loadClients(page - 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Anterior</button>
                <span className="px-3 py-1">{page} / {result.totalPages}</span>
                <button disabled={page >= result.totalPages} onClick={() => loadClients(page + 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Próximo</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Novo Cliente</h3>
            <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Nome *</label>
                <input {...createForm.register('name')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
                {createForm.formState.errors.name && <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Email *</label>
                <input {...createForm.register('email')} type="email" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
                {createForm.formState.errors.email && <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Telefone</label>
                <input {...createForm.register('phone')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">CNPJ / CPF</label>
                <input {...createForm.register('document')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
              </div>
              {resellers.length > 0 && (
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Revendedor</label>
                  <select {...createForm.register('resellerId')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500">
                    <option value="">Nenhum (direto)</option>
                    {resellers.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); createForm.reset() }} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={creating} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">{creating ? 'Criando...' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Editar Cliente</h3>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Nome *</label>
                <input {...editForm.register('name')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
                {editForm.formState.errors.name && <p className="text-red-400 text-xs mt-1">{editForm.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Email *</label>
                <input {...editForm.register('email')} type="email" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
                {editForm.formState.errors.email && <p className="text-red-400 text-xs mt-1">{editForm.formState.errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Telefone</label>
                <input {...editForm.register('phone')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">CNPJ / CPF</label>
                <input {...editForm.register('document')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingClient(null)} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {newCredentials && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm text-center">
            <h3 className="text-lg font-bold text-white mb-2">Credenciais do Cliente</h3>
            <p className="text-gray-400 text-sm mb-6">Anote — a senha não será exibida novamente.</p>
            <div className="bg-gray-800 rounded-lg p-4 mb-6 space-y-2 text-left">
              <div>
                <span className="text-xs text-gray-500">Usuário</span>
                <p className="text-white font-mono text-lg">{newCredentials.username}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Senha</span>
                <p className="text-white font-mono text-lg">{newCredentials.password}</p>
              </div>
            </div>
            <button onClick={() => setNewCredentials(null)} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">Entendi</button>
          </div>
        </div>
      )}
    </div>
  )
}
