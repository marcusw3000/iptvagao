'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Radio, FolderPlus, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'

interface Category {
  id: string
  name: string
  order: number
}

interface Channel {
  id: string
  clientId: string
  categoryId: string | null
  name: string
  url: string
  logoUrl: string | null
  order: number
  active: boolean
}

interface PaginatedChannels {
  data: Channel[]
  total: number
  totalPages: number
}

const categorySchema = z.object({
  name: z.string().min(1, 'Obrigatório'),
})

const channelSchema = z.object({
  name: z.string().min(1, 'Obrigatório'),
  url: z.string().min(1, 'Obrigatório'),
  categoryId: z.string().optional(),
  logoUrl: z.string().url('URL inválida').refine(
    (url) => url.startsWith('https://'),
    { message: 'Use HTTPS' }
  ).optional(),
})

type CategoryForm = z.infer<typeof categorySchema>
type ChannelForm = z.infer<typeof channelSchema>

export default function ChannelsPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const [categories, setCategories] = useState<Category[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelPage, setChannelPage] = useState(1)
  const [channelResult, setChannelResult] = useState<PaginatedChannels | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showAddChannel, setShowAddChannel] = useState(false)
  const [saving, setSaving] = useState(false)

  const catForm = useForm<CategoryForm>({ resolver: zodResolver(categorySchema) })
  const chForm = useForm<ChannelForm>({ resolver: zodResolver(channelSchema) })

  async function loadData(p = 1) {
    setLoading(true)
    try {
      const [catRes, chRes] = await Promise.all([
        api.get<Category[]>(`/categories/by-client/${clientId}`),
        api.get<PaginatedChannels>(`/channels/by-client/${clientId}?page=${p}&limit=50`),
      ])
      setCategories(catRes.data)
      setChannelResult(chRes.data)
      setChannels(chRes.data.data)
      setChannelPage(p)
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [clientId])

  async function addCategory(data: CategoryForm) {
    setSaving(true)
    try {
      await api.post('/categories', { ...data, clientId })
      catForm.reset()
      setShowAddCategory(false)
      await loadData(channelPage)
      toast.success('Categoria criada')
    } catch {
      toast.error('Erro ao criar categoria')
    } finally {
      setSaving(false)
    }
  }

  async function addChannel(data: ChannelForm) {
    setSaving(true)
    try {
      await api.post('/channels', {
        ...data,
        clientId,
        categoryId: data.categoryId || undefined,
        logoUrl: data.logoUrl || undefined,
      })
      chForm.reset()
      setShowAddChannel(false)
      await loadData(channelPage)
      toast.success('Canal adicionado')
    } catch {
      toast.error('Erro ao adicionar canal')
    } finally {
      setSaving(false)
    }
  }

  async function deleteChannel(id: string) {
    try {
      await api.delete(`/channels/${id}`)
      setChannels((prev) => prev.filter((c) => c.id !== id))
      toast.success('Canal removido')
    } catch {
      toast.error('Erro ao remover canal')
    }
  }

  const uncategorized = channels.filter((c) => !c.categoryId)
  const grouped = categories.map((cat) => ({
    category: cat,
    channels: channels.filter((c) => c.categoryId === cat.id),
  }))

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/clients/${clientId}/devices`} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <Link href={`/clients/${clientId}/devices`} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">Dispositivos</Link>
        <Link href={`/clients/${clientId}/subscription`} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">Assinatura</Link>
        <Link href={`/clients/${clientId}/credentials`} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">Credenciais</Link>
        <h2 className="text-2xl font-bold text-white">Canais</h2>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowAddCategory(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
          >
            <FolderPlus size={15} />
            Categoria
          </button>
          <button
            onClick={() => setShowAddChannel(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Radio size={15} />
            Canal
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ category, channels: catChannels }) => (
            <div key={category.id}>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {category.name}
              </h3>
              <ChannelList channels={catChannels} onDelete={deleteChannel} />
            </div>
          ))}

          {uncategorized.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Sem categoria
              </h3>
              <ChannelList channels={uncategorized} onDelete={deleteChannel} />
            </div>
          )}

          {channels.length === 0 && (
            <p className="text-gray-500 text-center py-12">Nenhum canal adicionado</p>
          )}
        </div>
      )}

      {channelResult && channelResult.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
          <span>{channelResult.total} canais</span>
          <div className="flex gap-2">
            <button disabled={channelPage <= 1} onClick={() => loadData(channelPage - 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Anterior</button>
            <span className="px-3 py-1">{channelPage} / {channelResult.totalPages}</span>
            <button disabled={channelPage >= channelResult.totalPages} onClick={() => loadData(channelPage + 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Próximo</button>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Nova Categoria</h3>
            <form onSubmit={catForm.handleSubmit(addCategory)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Nome *</label>
                <input
                  {...catForm.register('name')}
                  placeholder="ex: Filmes, Esportes"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {catForm.formState.errors.name && (
                  <p className="text-red-400 text-xs mt-1">{catForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowAddCategory(false); catForm.reset() }} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">{saving ? 'Criando...' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Channel Modal */}
      {showAddChannel && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Novo Canal</h3>
            <form onSubmit={chForm.handleSubmit(addChannel)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Nome *</label>
                <input {...chForm.register('name')} placeholder="ex: TV Globo" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
                {chForm.formState.errors.name && <p className="text-red-400 text-xs mt-1">{chForm.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">URL do Stream *</label>
                <input {...chForm.register('url')} placeholder="https://stream.example.com/canal.m3u8" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
                {chForm.formState.errors.url && <p className="text-red-400 text-xs mt-1">{chForm.formState.errors.url.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Categoria</label>
                <select {...chForm.register('categoryId')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500">
                  <option value="">Sem categoria</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">URL do Logo</label>
                <input {...chForm.register('logoUrl')} placeholder="https://..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddChannel(false); chForm.reset() }} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">{saving ? 'Salvando...' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ChannelList({ channels, onDelete }: { channels: Channel[]; onDelete: (id: string) => void }) {
  if (channels.length === 0) {
    return <p className="text-gray-600 text-sm py-2">Nenhum canal nesta categoria</p>
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {channels.map((ch, i) => (
        <div
          key={ch.id}
          className={`flex items-center gap-3 px-4 py-3 ${i < channels.length - 1 ? 'border-b border-gray-800' : ''}`}
        >
          {ch.logoUrl ? (
            <img src={ch.logoUrl} alt={ch.name} className="w-8 h-8 rounded object-cover bg-gray-800" />
          ) : (
            <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center">
              <Radio size={14} className="text-gray-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium">{ch.name}</p>
            <p className="text-gray-500 text-xs truncate">{ch.url}</p>
          </div>
          <button
            onClick={() => onDelete(ch.id)}
            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
            title="Remover canal"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
