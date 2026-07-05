import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TvState {
  token: string | null
  clientId: string | null
  deviceId: string | null
  favorites: string[]
  setToken: (token: string, clientId: string) => void
  setDevice: (deviceId: string) => void
  toggleFavorite: (channelId: string) => void
  isFavorite: (channelId: string) => boolean
  logout: () => void
}

export const useTvStore = create<TvState>()(
  persist(
    (set, get) => ({
      token: null,
      clientId: null,
      deviceId: null,
      favorites: [],

      setToken: (token, clientId) => {
        localStorage.setItem('tv_token', token)
        set({ token, clientId })
      },

      setDevice: (deviceId) => set({ deviceId }),

      toggleFavorite: (channelId) =>
        set((s) => ({
          favorites: s.favorites.includes(channelId)
            ? s.favorites.filter((id) => id !== channelId)
            : [...s.favorites, channelId],
        })),

      isFavorite: (channelId) => get().favorites.includes(channelId),

      logout: () => {
        localStorage.removeItem('tv_token')
        set({ token: null, clientId: null, deviceId: null })
      },
    }),
    {
      name: 'tv-store',
      partialize: (s) => ({
        token: s.token,
        clientId: s.clientId,
        deviceId: s.deviceId,
        favorites: s.favorites,
      }),
    },
  ),
)
