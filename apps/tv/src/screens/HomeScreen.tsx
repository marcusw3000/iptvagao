import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { api } from '../lib/api'
import { useTvStore } from '../store'
import { PlayerScreen } from './PlayerScreen'
import { CategorySidebar, FAVORITES_ID } from '../components/CategorySidebar'
import { ChannelGrid } from '../components/ChannelGrid'
import { GRID_COLUMNS } from '../lib/gridConfig'
import type { Channel, Category } from '../types'

type Zone = 'sidebar' | 'grid'

const BLOCKED_CATEGORY_NAMES = new Set(['Sem Categoria', 'sem categoria', 'Compras', 'compras'])

export function HomeScreen() {
  const { clientId, logout, favorites, toggleFavorite } = useTvStore()
  const [channels, setChannels] = useState<Channel[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [zone, setZone] = useState<Zone>('grid')
  const [sidebarIndex, setSidebarIndex] = useState(0)
  const [gridIndex, setGridIndex] = useState(0)
  const [playing, setPlaying] = useState<Channel | null>(null)

  const sidebarRefs = useRef<(HTMLButtonElement | null)[]>([])
  const gridRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (!clientId) return
    Promise.all([
      api.get<Channel[]>(`/channels/for-client/${clientId}`),
      api.get<Category[]>('/categories'),
    ])
      .then(([chRes, catRes]) => {
        setChannels([...chRes.data].sort((a, b) => a.order - b.order))
        setCategories(
          [...catRes.data]
            .filter((c) => !BLOCKED_CATEGORY_NAMES.has(c.name))
            .sort((a, b) => a.order - b.order),
        )
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId])

  const channelCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const ch of channels) {
      if (ch.categoryId) map[ch.categoryId] = (map[ch.categoryId] ?? 0) + 1
    }
    return map
  }, [channels])

  const favoritesCount = favorites.length

  const showFavorites = favoritesCount > 0
  const catOffset = showFavorites ? 2 : 1
  const visibleCategories = useMemo(
    () => categories.filter((cat) => (channelCounts[cat.id] ?? 0) > 0),
    [categories, channelCounts],
  )
  const sidebarLength = catOffset + visibleCategories.length

  const visibleChannels = useMemo(() => {
    if (activeCategoryId === FAVORITES_ID) return channels.filter((c) => favorites.includes(c.id))
    if (activeCategoryId) return channels.filter((c) => c.categoryId === activeCategoryId)
    return channels
  }, [activeCategoryId, channels, favorites])

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (playing) return

      // F = toggle favorite on focused channel
      if ((e.key === 'f' || e.key === 'F') && zone === 'grid' && visibleChannels[gridIndex]) {
        toggleFavorite(visibleChannels[gridIndex].id)
        return
      }

      const cols = GRID_COLUMNS
      const total = visibleChannels.length

      if (zone === 'sidebar') {
        switch (e.key) {
          case 'ArrowDown':
            setSidebarIndex((i) => Math.min(i + 1, sidebarLength - 1))
            break
          case 'ArrowUp':
            setSidebarIndex((i) => Math.max(i - 1, 0))
            break
          case 'ArrowRight':
            if (total > 0) setZone('grid')
            break
          case 'Enter': {
            if (sidebarIndex === 0) {
              setActiveCategoryId(null)
            } else if (showFavorites && sidebarIndex === 1) {
              setActiveCategoryId(FAVORITES_ID)
            } else {
              const cat = visibleCategories[sidebarIndex - catOffset]
              if (cat) setActiveCategoryId(cat.id)
            }
            break
          }
        }
        return
      }

      // zone === 'grid'
      if (total === 0) return
      const row = Math.floor(gridIndex / cols)
      const col = gridIndex % cols
      const rowCount = Math.ceil(total / cols)

      switch (e.key) {
        case 'ArrowRight':
          setGridIndex((i) => Math.min(i + 1, total - 1))
          break
        case 'ArrowLeft':
          if (col === 0) {
            setZone('sidebar')
          } else {
            setGridIndex((i) => i - 1)
          }
          break
        case 'ArrowDown': {
          const targetRow = Math.min(row + 1, rowCount - 1)
          const rowStart = targetRow * cols
          const rowLen = Math.min(cols, total - rowStart)
          setGridIndex(rowStart + Math.min(col, rowLen - 1))
          break
        }
        case 'ArrowUp':
          if (row === 0) {
            setZone('sidebar')
          } else {
            const targetRow = row - 1
            const rowStart = targetRow * cols
            const rowLen = Math.min(cols, total - rowStart)
            setGridIndex(rowStart + Math.min(col, rowLen - 1))
          }
          break
        case 'Enter':
          if (visibleChannels[gridIndex]) setPlaying(visibleChannels[gridIndex])
          break
      }
    },
    [playing, zone, sidebarIndex, gridIndex, visibleChannels, visibleCategories, sidebarLength, catOffset, showFavorites, toggleFavorite],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  useEffect(() => {
    setGridIndex(0)
  }, [activeCategoryId])

  useEffect(() => {
    setSidebarIndex((i) => Math.min(i, sidebarLength - 1))
  }, [sidebarLength])

  useEffect(() => {
    if (playing) return
    const el = zone === 'sidebar' ? sidebarRefs.current[sidebarIndex] : gridRefs.current[gridIndex]
    el?.focus()
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [zone, sidebarIndex, gridIndex, playing])

  if (playing) {
    return <PlayerScreen channel={playing} onBack={() => setPlaying(null)} />
  }

  if (loading) {
    return (
      <div className="w-screen h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-2xl">Carregando canais...</p>
      </div>
    )
  }

  return (
    <div className="w-screen h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-10 py-5 border-b border-gray-800 shrink-0">
        <h1 className="text-3xl font-bold text-white">IPTV Agão</h1>
        <button
          onClick={logout}
          className="text-gray-400 hover:text-white text-lg transition-colors"
        >
          Sair
        </button>
      </div>

      {/* Body: sidebar + grid */}
      <div className="flex flex-row flex-1 overflow-hidden">
        <CategorySidebar
          categories={visibleCategories}
          activeCategoryId={activeCategoryId}
          focusedRowIndex={zone === 'sidebar' ? sidebarIndex : null}
          channelCounts={channelCounts}
          favoritesCount={favoritesCount}
          onSelect={setActiveCategoryId}
          itemRefs={sidebarRefs}
        />
        <div className="flex-1 overflow-y-auto px-10 py-6">
          <ChannelGrid
            channels={visibleChannels}
            focusedIndex={zone === 'grid' ? gridIndex : null}
            itemRefs={gridRefs}
            favorites={favorites}
            onPlay={setPlaying}
            onToggleFavorite={toggleFavorite}
          />
        </div>
      </div>

      {/* Footer hint */}
      <div className="px-10 py-3 border-t border-gray-800 shrink-0 flex gap-8 text-gray-600 text-sm">
        <span>← → ↑ ↓ navegar</span>
        <span>ENTER reproduzir</span>
        <span>F favoritar</span>
      </div>
    </div>
  )
}
