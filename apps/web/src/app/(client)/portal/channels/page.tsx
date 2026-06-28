'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Radio } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'

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

export default function PortalChannelsPage() {
  const { clientId } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelResult, setChannelResult] = useState<PaginatedChannels | null>(null)
  const [channelPage, setChannelPage] = useState(1)
  const [loading, setLoading] = useState(true)

  async function loadData(p = 1) {
    if (!clientId) return
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
      toast.error('Erro ao carregar canais')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [clientId])

  const uncategorized = channels.filter((c) => !c.categoryId)
  const grouped = categories.map((cat) => ({
    category: cat,
    channels: channels.filter((c) => c.categoryId === cat.id),
  }))

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Radio size={22} className="text-indigo-400" />
        <h2 className="text-2xl font-bold text-white">Meus Canais</h2>
        {channelResult && (
          <span className="text-gray-500 text-sm ml-2">{channelResult.total} canais</span>
        )}
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
              <ChannelList channels={catChannels} />
            </div>
          ))}

          {uncategorized.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Sem categoria
              </h3>
              <ChannelList channels={uncategorized} />
            </div>
          )}

          {channels.length === 0 && (
            <p className="text-gray-500 text-center py-12">Nenhum canal disponível</p>
          )}
        </div>
      )}

      {channelResult && channelResult.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
          <span>{channelResult.total} canais</span>
          <div className="flex gap-2">
            <button
              disabled={channelPage <= 1}
              onClick={() => loadData(channelPage - 1)}
              className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="px-3 py-1">{channelPage} / {channelResult.totalPages}</span>
            <button
              disabled={channelPage >= channelResult.totalPages}
              onClick={() => loadData(channelPage + 1)}
              className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ChannelList({ channels }: { channels: Channel[] }) {
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
        </div>
      ))}
    </div>
  )
}
