import type { MutableRefObject } from 'react'
import type { Category } from '../types'

export const FAVORITES_ID = '__favorites__'

interface CategorySidebarProps {
  categories: Category[]
  activeCategoryId: string | null
  focusedRowIndex: number | null
  channelCounts: Record<string, number>
  favoritesCount: number
  onSelect: (categoryId: string | null) => void
  itemRefs: MutableRefObject<(HTMLButtonElement | null)[]>
}

export function CategorySidebar({
  categories,
  activeCategoryId,
  focusedRowIndex,
  channelCounts,
  favoritesCount,
  onSelect,
  itemRefs,
}: CategorySidebarProps) {
  function rowClass(selected: boolean, focused: boolean) {
    if (focused) return 'border-indigo-500 bg-indigo-600/20 scale-[1.02] text-white'
    if (selected) return 'border-transparent bg-indigo-600 text-white'
    return 'border-transparent text-gray-400 hover:text-white hover:bg-gray-800'
  }

  function CountBadge({ count }: { count: number }) {
    return (
      <span className="ml-auto text-sm opacity-60 tabular-nums">{count}</span>
    )
  }

  // Sidebar items: Todos, Favoritos (if any), then categories with channels
  const visibleCategories = categories.filter((cat) => (channelCounts[cat.id] ?? 0) > 0)
  // row index offsets: 0=Todos, 1=Favoritos (if shown), then categories
  const showFavorites = favoritesCount > 0
  const catOffset = showFavorites ? 2 : 1

  return (
    <nav className="w-64 shrink-0 border-r border-gray-800 overflow-y-auto py-6 px-4 flex flex-col gap-2">
      {/* Todos */}
      <button
        ref={(el) => { itemRefs.current[0] = el }}
        tabIndex={-1}
        onClick={() => onSelect(null)}
        className={`w-full text-left px-5 py-3.5 rounded-xl text-xl font-medium border-2 transition-colors flex items-center ${rowClass(
          activeCategoryId === null,
          focusedRowIndex === 0,
        )}`}
      >
        Todos
      </button>

      {/* Favoritos */}
      {showFavorites && (
        <button
          ref={(el) => { itemRefs.current[1] = el }}
          tabIndex={-1}
          onClick={() => onSelect(FAVORITES_ID)}
          className={`w-full text-left px-5 py-3.5 rounded-xl text-xl font-medium border-2 transition-colors flex items-center gap-2 ${rowClass(
            activeCategoryId === FAVORITES_ID,
            focusedRowIndex === 1,
          )}`}
        >
          <span>★</span>
          <span>Favoritos</span>
          <CountBadge count={favoritesCount} />
        </button>
      )}

      {/* Categories */}
      {visibleCategories.map((cat, idx) => (
        <button
          key={cat.id}
          ref={(el) => { itemRefs.current[catOffset + idx] = el }}
          tabIndex={-1}
          onClick={() => onSelect(cat.id)}
          className={`w-full text-left px-5 py-3.5 rounded-xl text-xl font-medium border-2 transition-colors flex items-center ${rowClass(
            activeCategoryId === cat.id,
            focusedRowIndex === catOffset + idx,
          )}`}
        >
          <span className="truncate">{cat.name}</span>
          <CountBadge count={channelCounts[cat.id] ?? 0} />
        </button>
      ))}
    </nav>
  )
}
