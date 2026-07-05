import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { api } from './api'

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

interface AuthState {
  token: string | null
  isAuthenticated: boolean
  _hasHydrated: boolean
  role: string | null
  clientId: string | null
  resellerId: string | null
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
      resellerId: null,

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
          resellerId: payload.resellerId ?? null,
        })
      },

      logout() {
        localStorage.removeItem('access_token')
        set({ token: null, isAuthenticated: false, role: null, clientId: null, resellerId: null })
        window.location.href = '/login'
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : noopStorage)),
      partialize: (s) => ({ token: s.token }),
    },
  ),
)

function applyRehydratedToken(token: string | null) {
  const isAuthenticated = !!token
  let role: string | null = null
  let clientId: string | null = null
  let resellerId: string | null = null
  if (token) {
    localStorage.setItem('access_token', token)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      role = payload.role ?? null
      clientId = payload.clientId ?? null
      resellerId = payload.resellerId ?? null
    } catch {
      // malformed token — treat as unauthenticated
    }
  }
  useAuth.setState({ _hasHydrated: true, isAuthenticated, role, clientId, resellerId })
}

useAuth.persist.onFinishHydration((state) => applyRehydratedToken(state.token))
if (useAuth.persist.hasHydrated()) applyRehydratedToken(useAuth.getState().token)
