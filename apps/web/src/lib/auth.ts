import { create } from 'zustand'
import type { AuthSession, AuthSessionUser } from '@iptvagao/shared'
import { api } from './api'

interface AuthState {
  isAuthenticated: boolean
  _hasHydrated: boolean
  role: string | null
  clientId: string | null
  resellerId: string | null
  user: AuthSessionUser | null
  initialize: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  reset: () => void
}

function applySession(session: AuthSession | null, hydrated = true) {
  const user = session?.user ?? null
  useAuth.setState({
    user,
    isAuthenticated: !!user,
    _hasHydrated: hydrated,
    role: user?.role ?? null,
    clientId: user?.clientId ?? null,
    resellerId: user?.resellerId ?? null,
  })
}

export const useAuth = create<AuthState>()((set, get) => ({
  isAuthenticated: false,
  _hasHydrated: false,
  role: null,
  clientId: null,
  resellerId: null,
  user: null,

  async initialize() {
    if (get()._hasHydrated) return
    try {
      const { data } = await api.get<AuthSession>('/auth/me')
      applySession(data)
    } catch {
      applySession(null)
    }
  },

  async login(username, password) {
    const { data } = await api.post<AuthSession>('/auth/login', {
      username,
      password,
    })
    applySession(data)
  },

  async logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      // Best effort: clear local state even if the server-side cookie is already gone.
    }
    set({
      user: null,
      isAuthenticated: false,
      _hasHydrated: true,
      role: null,
      clientId: null,
      resellerId: null,
    })
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  },

  reset() {
    set({
      user: null,
      isAuthenticated: false,
      _hasHydrated: true,
      role: null,
      clientId: null,
      resellerId: null,
    })
  },
}))

if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    useAuth.getState().reset()
  })
}
