import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from './api'

interface AuthState {
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,

      async login(username, password) {
        const { data } = await api.post<{ accessToken: string }>('/auth/login', {
          username,
          password,
        })
        localStorage.setItem('access_token', data.accessToken)
        set({ token: data.accessToken })
      },

      logout() {
        localStorage.removeItem('access_token')
        set({ token: null })
        window.location.href = '/login'
      },
    }),
    { name: 'auth-storage', partialize: (s) => ({ token: s.token }) },
  ),
)
