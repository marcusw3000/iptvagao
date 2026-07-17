'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Radio, Star } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'

interface Category {
  id: string
  name: string
  order: number
}

interface Channel {
  id: string
  categoryId: string | null
  name: string
  url: string
  logoUrl: string | null
  order: number
  active: boolean
  isFavorite: boolean
}

export default function PortalChannelsPage() {
  const { clientId } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingFavoriteIds, setPendingFavoriteIds] = useState<string[]>([])

  async function loadData() {
    if (!clientId) return
    setLoading(true)
    try {
      const [catRes, chRes] = await Promise.all([
        api.get<Category[]>('/categories'),
        api.get<Channel[]>(`/channels/for-client/${clientId}`),
      ])
      setCategories(catRes.data)
      setChannels(chRes.data)
    } catch {
      toast.error('Erro ao carregar canais')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [clientId])

  function updateFavorite(channelId: string, isFavorite: boolean) {
    setChannels((current) =>
      current.map((channel) => (
        channel.id === channelId ? { ...channel, isFavorite } : channel
      )),
    )
  }

  async function toggleFavorite(channelId: string, nextValue: boolean) {
    if (!clientId || pendingFavoriteIds.includes(channelId)) return

    setPendingFavoriteIds((current) => [...current, channelId])
    updateFavorite(channelId, nextValue)

    try {
      if (nextValue) {
        await api.post(`/channels/favorites/${channelId}`)
      } else {
        await api.delete(`/channels/favorites/${channelId}`)
      }
    } catch {
      updateFavorite(channelId, !nextValue)
      toast.error('Erro ao atualizar favorito')
    } finally {
      setPendingFavoriteIds((current) => current.filter((id) => id !== channelId))
    }
  }

  const favorites = channels.filter((c) => c.isFavorite)
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
        {!loading && (
          <span className="text-gray-500 text-sm ml-2">{channels.length} canais</span>
        )}
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <div className="space-y-6">
          {favorites.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-2">
                Favoritos
              </h3>
              <ChannelList
                channels={favorites}
                pendingFavoriteIds={pendingFavoriteIds}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          )}

          {grouped.map(({ category, channels: catChannels }) => (
            catChannels.length > 0 && (
              <div key={category.id}>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {category.name}
                </h3>
                <ChannelList
                  channels={catChannels}
                  pendingFavoriteIds={pendingFavoriteIds}
                  onToggleFavorite={toggleFavorite}
                />
              </div>
            )
          ))}

          {uncategorized.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Sem categoria
              </h3>
              <ChannelList
                channels={uncategorized}
                pendingFavoriteIds={pendingFavoriteIds}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          )}

          {channels.length === 0 && (
            <p className="text-gray-500 text-center py-12">Nenhum canal disponível</p>
          )}
        </div>
      )}
    </div>
  )
}

function ChannelList({
  channels,
  pendingFavoriteIds,
  onToggleFavorite,
}: {
  channels: Channel[]
  pendingFavoriteIds: string[]
  onToggleFavorite: (channelId: string, nextValue: boolean) => void
}) {
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
            type="button"
            disabled={pendingFavoriteIds.includes(ch.id)}
            onClick={() => onToggleFavorite(ch.id, !ch.isFavorite)}
            className="p-2 rounded-lg transition-colors disabled:opacity-50 hover:bg-gray-800"
            aria-label={ch.isFavorite ? `Remover ${ch.name} dos favoritos` : `Favoritar ${ch.name}`}
            title={ch.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Star
              size={18}
              className={ch.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-gray-500'}
            />
          </button>
        </div>
      ))}
    </div>
  )
}
