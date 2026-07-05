import type { MutableRefObject } from 'react'
import type { Channel } from '../types'
import { ChannelCard } from './ChannelCard'
import { GRID_COLUMNS } from '../lib/gridConfig'

interface ChannelGridProps {
  channels: Channel[]
  focusedIndex: number | null
  itemRefs: MutableRefObject<(HTMLButtonElement | null)[]>
  favorites: string[]
  onPlay: (channel: Channel) => void
  onToggleFavorite: (channelId: string) => void
}

export function ChannelGrid({ channels, focusedIndex, itemRefs, favorites, onPlay, onToggleFavorite }: ChannelGridProps) {
  if (channels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500 text-2xl">Nenhum canal disponível</p>
      </div>
    )
  }

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))` }}
    >
      {channels.map((ch, idx) => (
        <ChannelCard
          key={ch.id}
          ref={(el) => { itemRefs.current[idx] = el }}
          channel={ch}
          focused={focusedIndex === idx}
          favorite={favorites.includes(ch.id)}
          onPlay={() => onPlay(ch)}
          onToggleFavorite={() => onToggleFavorite(ch.id)}
        />
      ))}
    </div>
  )
}
