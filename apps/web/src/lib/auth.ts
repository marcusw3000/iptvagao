import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from './api'

interface AuthState {
  token: string | null
  isAuthenticated: boolean
  _hasHydrated: boolean
  role: string | null
  clientId: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,
      role: null,
      clientId: null,

      async login(username, password) {
        const { data } = await api.post<{ accessToken: string }>('/auth/login', {
          username,
          password,
        })
        localStorage.setItem('access_token', data.accessToken)
        const payload = JSON.parse(atob(data.accessToken.split('.')[1]))
        set({
          token: data.accessToken,
          isAuthenticated: true,
          role: payload.role ?? null,
          clientId: payload.clientId ?? null,
        })
      },

      logout() {
        localStorage.removeItem('access_token')
        set({ token: null, isAuthenticated: false, role: null, clientId: null })
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
        let role: string | null = null
        let clientId: string | null = null
        if (state?.token) {
          localStorage.setItem('access_token', state.token)
          try {
            const payload = JSON.parse(atob(state.token.split('.')[1]))
            role = payload.role ?? null
            clientId = payload.clientId ?? null
          } catch {
            // malformed token — treat as unauthenticated
          }
        }
        useAuth.setState({ _hasHydrated: true, isAuthenticated, role, clientId })
      },
    },
  ),
)
