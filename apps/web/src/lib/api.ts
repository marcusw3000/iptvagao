import axios from 'axios'

export const api = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth:unauthorized'))
      const pathname = window.location.pathname
      if (pathname !== '/login' && pathname !== '/signup' && pathname !== '/signup/complete') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)
