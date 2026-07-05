import { useRef, useState } from 'react'
import { api } from '../lib/api'
import { useTvStore } from '../store'

interface LoginResponse {
  accessToken: string
}

interface DeviceResponse {
  id: string
}

export function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { deviceId, setToken, setDevice } = useTvStore()
  const submittingRef = useRef(false)

  async function handleLogin() {
    if (submittingRef.current) return
    if (!username || !password) {
      setError('Preencha usuário e senha')
      return
    }
    submittingRef.current = true
    setLoading(true)
    setError('')
    try {
      const r = await api.post<LoginResponse>('/auth/login', { username, password })
      const payload = JSON.parse(atob(r.data.accessToken.split('.')[1]))
      setToken(r.data.accessToken, payload.clientId as string)

      if (!deviceId) {
        const dr = await api.post<DeviceResponse>('/devices/self-register', {})
        setDevice(dr.data.id)
      }
    } catch {
      setError('Usuário ou senha inválidos')
      setPassword('')
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className="w-screen h-screen bg-gray-950 flex flex-col items-center justify-center gap-10">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white mb-3">IPTV Agão</h1>
        <p className="text-gray-400 text-xl">Entre com suas credenciais</p>
      </div>

      <div className="flex flex-col gap-5 w-full max-w-sm">
        <div>
          <label className="block text-gray-400 text-lg mb-2">Usuário</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            onKeyDown={handleKeyDown}
            maxLength={4}
            autoFocus
            placeholder="xxxx"
            className="w-full px-6 py-4 text-2xl font-mono bg-gray-800 border-2 border-gray-700 focus:border-indigo-500 rounded-xl text-white placeholder-gray-600 transition-colors"
          />
        </div>

        <div>
          <label className="block text-gray-400 text-lg mb-2">Senha</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            type="password"
            maxLength={6}
            placeholder="••••••"
            className="w-full px-6 py-4 text-2xl font-mono bg-gray-800 border-2 border-gray-700 focus:border-indigo-500 rounded-xl text-white placeholder-gray-600 transition-colors"
          />
        </div>

        {error && <p className="text-red-400 text-lg text-center">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-2xl font-bold rounded-xl transition-colors"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </div>
    </div>
  )
}
