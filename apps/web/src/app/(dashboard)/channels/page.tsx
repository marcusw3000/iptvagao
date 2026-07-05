'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Tv2, Pencil, Trash2, Ban, CheckCircle, Download, Upload } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface Plan {
  id: string
  name: string
  type: string
}

interface Channel {
  id: string
  categoryId: string | null
  name: string
  url: string
  logoUrl: string | null
  order: number
  active: boolean
  plans: Plan[]
}

interface Category {
  id: string
  name: string
}

interface PaginatedChannels {
  data: Channel[]
  total: number
  page: number
  totalPages: number
}

const schema = z.object({
  name: z.string().min(1, 'Obrigatório'),
  url: z.string().url('URL inválida'),
  logoUrl: z.string().optional(),
  categoryId: z.string().optional(),
  order: z.coerce.number().int().default(0),
  planIds: z.array(z.string()).default([]),
})

type FormData = z.infer<typeof schema>

function ChannelModal({
  title,
  form,
  onSubmit,
  saving,
  onCancel,
  categories,
  plans,
}: {
  title: string
  form: ReturnType<typeof useForm<FormData>>
  onSubmit: (d: FormData) => void
  saving: boolean
  onCancel: () => void
  categories: Category[]
  plans: Plan[]
}) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoUrl = form.watch('logoUrl')
  const planIds = form.watch('planIds') ?? []

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    setUploading(true)
    try {
      const r = await api.post<{ url: string }>('/uploads/channel-logo', fd, {
        headers: { 'Content-Type': undefined },
      })
      form.setValue('logoUrl', r.data.url)
      toast.success('Logo enviada')
    } catch {
      toast.error('Erro ao enviar logo')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function togglePlan(planId: string) {
    const current = form.getValues('planIds') ?? []
    form.setValue(
      'planIds',
      current.includes(planId) ? current.filter((id) => id !== planId) : [...current, planId],
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Nome *</label>
            <input {...form.register('name')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
            {form.formState.errors.name && <p className="text-red-400 text-xs mt-1">{form.formState.errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">URL do Stream *</label>
            <input {...form.register('url')} placeholder="https://..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
            {form.formState.errors.url && <p className="text-red-400 text-xs mt-1">{form.formState.errors.url.message}</p>}
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Foto do canal</label>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-24 h-24 object-contain rounded-lg bg-gray-800" />
              ) : (
                <div className="w-24 h-24 rounded-lg bg-gray-800 flex items-center justify-center text-gray-600 text-xs">
                  sem foto
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileChange}
                disabled={uploading}
                className="flex-1 text-sm text-gray-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gray-800 file:text-gray-300 file:text-sm hover:file:bg-gray-700"
              />
            </div>
            {uploading && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Upload size={12} className="animate-pulse" /> Enviando...</p>}
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Categoria</label>
            <select {...form.register('categoryId')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500">
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2">Disponível nos planos</label>
            <div className="flex flex-wrap gap-2">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlan(p.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                    planIds.includes(p.id)
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white',
                  )}
                >
                  {p.name}
                </button>
              ))}
              {plans.length === 0 && <p className="text-xs text-gray-500">Nenhum plano cadastrado</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Ordem</label>
            <input {...form.register('order')} type="number" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const DEFAULT_M3U_URL = 'https://iptv-org.github.io/iptv/countries/br.m3u'

export default function ChannelsPage() {
  const [result, setResult] = useState<PaginatedChannels | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importUrl, setImportUrl] = useState(DEFAULT_M3U_URL)
  const [importing, setImporting] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)

  const createForm = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { planIds: [] } })
  const editForm = useForm<FormData>({ resolver: zodResolver(schema) })

  function loadChannels(p = 1) {
    setLoading(true)
    api.get<PaginatedChannels>(`/channels?page=${p}&limit=50`)
      .then((r) => { setResult(r.data); setPage(p) })
      .catch(() => toast.error('Erro ao carregar canais'))
      .finally(() => setLoading(false))
  }

  function loadCategories() {
    api.get<Category[]>('/categories').then((r) => setCategories(r.data)).catch(() => {})
  }

  useEffect(() => {
    loadChannels()
    loadCategories()
    api.get<Plan[]>('/plans?all=true').then((r) => setPlans(r.data)).catch(() => {})
  }, [])

  function openCreate() {
    createForm.reset({ planIds: plans.map((p) => p.id) })
    setShowCreate(true)
  }

  async function onCreate(data: FormData) {
    setSaving(true)
    try {
      await api.post('/channels', {
        ...data,
        categoryId: data.categoryId || undefined,
        logoUrl: data.logoUrl || undefined,
      })
      setShowCreate(false)
      createForm.reset({ planIds: [] })
      loadChannels(page)
      toast.success('Canal criado')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao criar canal')
    } finally {
      setSaving(false)
    }
  }

  function openEdit(ch: Channel) {
    setEditingChannel(ch)
    editForm.reset({
      name: ch.name,
      url: ch.url,
      logoUrl: ch.logoUrl ?? '',
      categoryId: ch.categoryId ?? '',
      order: ch.order,
      planIds: ch.plans.map((p) => p.id),
    })
  }

  async function onEdit(data: FormData) {
    if (!editingChannel) return
    setSaving(true)
    try {
      await api.patch(`/channels/${editingChannel.id}`, {
        ...data,
        categoryId: data.categoryId || undefined,
        logoUrl: data.logoUrl || undefined,
      })
      setEditingChannel(null)
      loadChannels(page)
      toast.success('Canal atualizado')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao atualizar')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(ch: Channel) {
    try {
      await api.patch(`/channels/${ch.id}`, { active: !ch.active })
      loadChannels(page)
      toast.success(ch.active ? 'Canal desativado' : 'Canal ativado')
    } catch {
      toast.error('Erro ao alterar status')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este canal?')) return
    try {
      await api.delete(`/channels/${id}`)
      loadChannels(page)
      toast.success('Canal removido')
    } catch {
      toast.error('Erro ao remover canal')
    }
  }

  async function handleImport() {
    if (!importUrl) return
    setImporting(true)
    try {
      const r = await api.post<{ total: number; created: number; updated: number }>('/channels/import-m3u', {
        url: importUrl,
      })
      toast.success(`Importação concluída: ${r.data.created} criados, ${r.data.updated} atualizados (total: ${r.data.total})`)
      setShowImport(false)
      loadChannels(1)
      loadCategories()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao importar M3U')
    } finally {
      setImporting(false)
    }
  }

  function categoryName(id: string | null) {
    if (!id) return '—'
    return categories.find((c) => c.id === id)?.name ?? '—'
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-bold text-white">Canais</h2>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
            title="Sincronizar canais com a fonte M3U configurada"
          >
            <Download size={16} />
            Sincronizar M3U
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Tv2 size={16} />
            Novo Canal
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
                  <th className="px-4 py-3 font-medium w-12">#</th>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Planos</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((ch) => (
                  <tr key={ch.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3 text-gray-500">{ch.order}</td>
                    <td className="px-4 py-3 text-white font-medium">
                      <button
                        onClick={() => openEdit(ch)}
                        className="flex items-center gap-3 hover:text-indigo-400 transition-colors text-left"
                        title="Clique para editar"
                      >
                        {ch.logoUrl ? (
                          <img
                            src={ch.logoUrl}
                            alt=""
                            className="w-10 h-10 object-contain rounded-lg bg-gray-800"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        ) : null}
                        {ch.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{categoryName(ch.categoryId)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {ch.plans.length === 0 && <span className="text-xs text-gray-600">nenhum</span>}
                        {ch.plans.map((p) => (
                          <span key={p.id} className="text-xs px-2 py-0.5 bg-gray-800 text-gray-300 rounded-full">{p.name}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full',
                        ch.active ? 'bg-emerald-900/40 text-emerald-400' : 'bg-gray-800 text-gray-500',
                      )}>
                        {ch.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(ch)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors" title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => toggleActive(ch)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors" title={ch.active ? 'Desativar' : 'Ativar'}>
                          {ch.active ? <Ban size={14} /> : <CheckCircle size={14} />}
                        </button>
                        <button onClick={() => handleDelete(ch.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors" title="Remover">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Nenhum canal cadastrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result && result.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{result.total} canais</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => loadChannels(page - 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Anterior</button>
                <span className="px-3 py-1">{page} / {result.totalPages}</span>
                <button disabled={page >= result.totalPages} onClick={() => loadChannels(page + 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Próximo</button>
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <ChannelModal
          title="Novo Canal"
          form={createForm}
          onSubmit={onCreate}
          saving={saving}
          onCancel={() => { setShowCreate(false); createForm.reset({ planIds: [] }) }}
          categories={categories}
          plans={plans}
        />
      )}

      {editingChannel && (
        <ChannelModal
          title="Editar Canal"
          form={editForm}
          onSubmit={onEdit}
          saving={saving}
          onCancel={() => setEditingChannel(null)}
          categories={categories}
          plans={plans}
        />
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold text-white mb-1">Sincronizar M3U</h3>
            <p className="text-sm text-gray-400 mb-4">
              Novos canais serão criados já disponíveis em todos os planos ativos (edite depois se quiser restringir). Canais existentes (mesma URL) serão atualizados. Categorias criadas automaticamente pelo grupo.
            </p>
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-1">URL do arquivo M3U</label>
              <input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowImport(false)}
                className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !importUrl}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {importing ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
