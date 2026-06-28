'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Wifi, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface ClientRef {
  id: string
  name: string
}

interface MonitorDevice {
  id: string
  clientId: string
  name: string
  activated: boolean
  lastSeenAt: string | null
  ipAddress: string | null
  online: boolean
  client: ClientRef
}

interface MonitoringResult {
  data: MonitorDevice[]
  total: number
  page: number
  totalPages: number
  onlineCount: number
}

const REFRESH_INTERVAL = 30_000

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s atrás`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}min atrás`
  const hr = Math.floor(min / 60)
  return `${hr}h atrás`
}

export default function MonitoringPage() {
  const [result, setResult] = useState<MonitoringResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback((p = 1, silent = false) => {
    if (!silent) setLoading(true)
    api.get<MonitoringResult>(`/devices/monitoring?page=${p}&limit=50`)
      .then((r) => { setResult(r.data); setPage(p); setLastRefresh(new Date()) })
      .catch(() => toast.error('Erro ao carregar monitoramento'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(page, true), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [load, page])

  const online = result?.onlineCount ?? 0
  const total = result?.total ?? 0
  const offline = total - online

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Monitoramento</h2>
          {lastRefresh && (
            <p className="text-xs text-gray-500 mt-1">
              Atualizado: {lastRefresh.toLocaleTimeString('pt-BR')} · auto-refresh 30s
            </p>
          )}
        </div>
        <button
          onClick={() => load(page)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4">
          <div className="bg-gray-800 p-3 rounded-lg">
            <Wifi size={22} className="text-gray-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Total TVs</p>
            <p className="text-2xl font-bold text-white">{total}</p>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4">
          <div className="bg-emerald-900/30 p-3 rounded-lg">
            <Wifi size={22} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Online</p>
            <p className="text-2xl font-bold text-emerald-400">{online}</p>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4">
          <div className="bg-red-900/30 p-3 rounded-lg">
            <WifiOff size={22} className="text-red-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Offline</p>
            <p className="text-2xl font-bold text-red-400">{offline}</p>
          </div>
        </div>
      </div>

      {loading && !result ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">TV</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                  <th className="px-4 py-3 font-medium">Último heartbeat</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((device) => (
                  <tr key={device.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3">
                      {device.online ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          Online
                        </span>
                      ) : device.activated ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                          <span className="w-2 h-2 rounded-full bg-gray-600" />
                          Offline
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-yellow-500">
                          <span className="w-2 h-2 rounded-full bg-yellow-600" />
                          Não ativado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{device.name}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients/${device.clientId}/devices`}
                        className="text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        {device.client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                      {device.ipAddress ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {timeAgo(device.lastSeenAt)}
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      Nenhum dispositivo registrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result && result.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{result.total} dispositivos</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => load(page - 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Anterior</button>
                <span className="px-3 py-1">{page} / {result.totalPages}</span>
                <button disabled={page >= result.totalPages} onClick={() => load(page + 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Próximo</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
