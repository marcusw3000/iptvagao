import axios from 'axios'
import { useTvStore } from '../store'

export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api/v1`,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tv_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useTvStore.getState().logout()
    }
    return Promise.reject(error)
  },
)
