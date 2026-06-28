import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from './api'

interface AuthState {
  token: string | null
  isAuthenticated: boolean
  _hasHydrated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,

      async login(username, password) {
        const { data } = await api.post<{ accessToken: string }>('/auth/login', {
          username,
          password,
        })
        localStorage.setItem('access_token', data.accessToken)
        set({ token: data.accessToken, isAuthenticated: true })
      },

      logout() {
        localStorage.removeItem('access_token')
        set({ token: null, isAuthenticated: false })
        window.location.href = '/login'
      },
    }),
    {
      name: 'auth-storage',
      partialize: (s) => ({ token: s.token }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('[auth] rehydration failed:', error)
          useAuth.setState({ _hasHydrated: true })
          return
        }
        const isAuthenticated = !!state?.token
        if (state?.token) {
          localStorage.setItem('access_token', state.token)
        }
        useAuth.setState({ _hasHydrated: true, isAuthenticated })
      },
    },
  ),
)
