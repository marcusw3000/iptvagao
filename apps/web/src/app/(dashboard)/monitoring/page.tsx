'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Wifi, WifiOff, Clock3 } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

type OperationalStatus = 'pending' | 'online' | 'offline'

interface ClientRef {
  id: string
  name: string
}

interface MonitorDevice {
  id: string
  clientId: string
  name: string
  activationCode: string
  activated: boolean
  lastSeenAt: string | null
  ipAddress: string | null
  userAgent: string | null
  online: boolean
  operationalStatus: OperationalStatus
  appVersion: string | null
  deviceModel: string | null
  appEnvironment: string | null
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
  if (!dateStr) return 'Nunca'
  const diff = Date.now() - new Date(dateStr).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s atras`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}min atras`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h atras`
  return `${Math.floor(hr / 24)}d atras`
}

function statusMeta(device: MonitorDevice) {
  if (device.operationalStatus === 'online') {
    return {
      label: 'Online',
      className: 'text-emerald-400',
      dotClass: 'bg-emerald-400 animate-pulse',
    }
  }
  if (device.operationalStatus === 'pending') {
    return {
      label: 'Aguardando ativacao',
      className: 'text-amber-400',
      dotClass: 'bg-amber-500',
    }
  }
  return {
    label: 'Offline',
    className: 'text-gray-400',
    dotClass: 'bg-gray-600',
  }
}

export default function MonitoringPage() {
  const [result, setResult] = useState<MonitoringResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback((p = 1, silent = false) => {
    if (!silent) setLoading(true)
    api.get<MonitoringResult>(`/devices/monitoring?page=${p}&limit=50`)
      .then((r) => {
        setResult(r.data)
        setPage(p)
        setLastRefresh(new Date())
      })
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
  const pending = result?.data.filter((device) => device.operationalStatus === 'pending').length ?? 0
  const offline = total - online - pending

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Monitoramento</h2>
          {lastRefresh && (
            <p className="mt-1 text-xs text-gray-500">
              Atualizado: {lastRefresh.toLocaleTimeString('pt-BR')} · auto-refresh 30s
            </p>
          )}
        </div>
        <button
          onClick={() => load(page)}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        <MetricCard label="Total TVs" value={total} icon={<Wifi size={20} className="text-gray-300" />} />
        <MetricCard label="Online" value={online} icon={<Wifi size={20} className="text-emerald-400" />} />
        <MetricCard label="Offline" value={offline} icon={<WifiOff size={20} className="text-red-400" />} />
        <MetricCard label="Aguardando" value={pending} icon={<Clock3 size={20} className="text-amber-400" />} />
      </div>

      {loading && !result ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-400">
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">TV</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                  <th className="px-4 py-3 font-medium">Modelo</th>
                  <th className="px-4 py-3 font-medium">Versao</th>
                  <th className="px-4 py-3 font-medium">Ultimo heartbeat</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((device) => {
                  const status = statusMeta(device)
                  return (
                    <tr key={device.id} className="border-b border-gray-800 last:border-0">
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 text-xs', status.className)}>
                          <span className={cn('h-2 w-2 rounded-full', status.dotClass)} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{device.name}</div>
                        <code className="text-xs text-indigo-400">{device.activationCode}</code>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/clients/${device.clientId}/devices`}
                          className="text-indigo-400 transition-colors hover:text-indigo-300"
                        >
                          {device.client.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {device.ipAddress ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {device.deviceModel ?? 'Nao informado'}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        <div>{device.appVersion ?? 'Nao informada'}</div>
                        <div className="mt-1 text-xs text-gray-500">{device.appEnvironment ? `Ambiente ${device.appEnvironment}` : '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <div>{timeAgo(device.lastSeenAt)}</div>
                        <div className="mt-1">{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('pt-BR') : '-'}</div>
                      </td>
                    </tr>
                  )
                })}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      Nenhum dispositivo registrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result && result.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
              <span>{result.total} dispositivos</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => load(page - 1)} className="rounded bg-gray-800 px-3 py-1 disabled:opacity-40">Anterior</button>
                <span className="px-3 py-1">{page} / {result.totalPages}</span>
                <button disabled={page >= result.totalPages} onClick={() => load(page + 1)} className="rounded bg-gray-800 px-3 py-1 disabled:opacity-40">Proximo</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="rounded-lg bg-gray-800 p-3">{icon}</div>
      <div>
        <p className="mb-0.5 text-xs text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  )
}
