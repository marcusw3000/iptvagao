import { forwardRef } from 'react'
import type { Channel } from '../types'

interface ChannelCardProps {
  channel: Channel
  focused: boolean
  favorite: boolean
  onPlay: () => void
  onToggleFavorite: () => void
}

export const ChannelCard = forwardRef<HTMLButtonElement, ChannelCardProps>(
  ({ channel, focused, favorite, onPlay, onToggleFavorite }, ref) => (
    <button
      ref={ref}
      tabIndex={-1}
      onClick={onPlay}
      className={`relative flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all ${
        focused
          ? 'border-indigo-500 bg-indigo-600/20 scale-105'
          : 'border-gray-800 bg-gray-900 hover:border-gray-600 hover:bg-gray-800'
      }`}
    >
      {/* Favorite indicator */}
      {(favorite || focused) && (
        <button
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
          className={`absolute top-2 right-2 text-lg leading-none transition-colors ${
            favorite ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'
          }`}
          title={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          {favorite ? '★' : '☆'}
        </button>
      )}

      {channel.logoUrl ? (
        <img
          src={channel.logoUrl}
          alt={channel.name}
          className="w-24 h-24 object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <div className="w-24 h-24 bg-gray-800 rounded-xl flex items-center justify-center">
          <span className="text-4xl text-gray-500">📺</span>
        </div>
      )}
      <span className="text-white text-base font-medium text-center leading-tight line-clamp-2">
        {channel.name}
      </span>
    </button>
  ),
)

ChannelCard.displayName = 'ChannelCard'
