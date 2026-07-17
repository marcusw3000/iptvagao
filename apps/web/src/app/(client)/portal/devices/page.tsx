'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MonitorPlay, Power, RefreshCw, Tv } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'

type OperationalStatus = 'pending' | 'online' | 'offline'

interface Device {
  id: string
  clientId: string
  name: string
  activationCode: string
  activated: boolean
  lastSeenAt: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  updatedAt: string
  online: boolean
  operationalStatus: OperationalStatus
  appVersion: string | null
  deviceModel: string | null
  appEnvironment: string | null
}

interface PaginatedDevices {
  data: Device[]
  total: number
  page: number
  totalPages: number
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR')
}

function timeAgo(value: string | null) {
  if (!value) return 'Nunca'
  const diff = Date.now() - new Date(value).getTime()
  const seconds = Math.max(0, Math.floor(diff / 1000))
  if (seconds < 60) return `${seconds}s atras`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}min atras`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h atras`
  const days = Math.floor(hours / 24)
  return `${days}d atras`
}

function statusMeta(status: OperationalStatus) {
  switch (status) {
    case 'online':
      return {
        label: 'Online',
        className: 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/50',
      }
    case 'offline':
      return {
        label: 'Offline',
        className: 'bg-slate-800 text-slate-300 border border-slate-700',
      }
    default:
      return {
        label: 'Aguardando ativacao',
        className: 'bg-amber-900/30 text-amber-300 border border-amber-700/50',
      }
  }
}

export default function PortalDevicesPage() {
  const { clientId } = useAuth()
  const [result, setResult] = useState<PaginatedDevices | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  function loadDevices(p = 1) {
    if (!clientId) return
    setLoading(true)
    api.get<PaginatedDevices>(`/devices/by-client/${clientId}?page=${p}&limit=20`)
      .then((r) => {
        setResult(r.data)
        setPage(p)
      })
      .catch(() => toast.error('Erro ao carregar dispositivos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadDevices()
  }, [clientId])

  const stats = useMemo(() => {
    const devices = result?.data ?? []
    return {
      total: devices.length,
      online: devices.filter((device) => device.operationalStatus === 'online').length,
      pending: devices.filter((device) => device.operationalStatus === 'pending').length,
    }
  }, [result])

  async function revokeDevice(deviceId: string) {
    if (!confirm('Revogar este dispositivo? A TV precisara ser ativada novamente.')) return
    setRevokingId(deviceId)
    try {
      await api.delete(`/devices/${deviceId}`)
      toast.success('Dispositivo revogado')
      loadDevices(page)
    } catch {
      toast.error('Erro ao revogar dispositivo')
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MonitorPlay size={22} className="text-indigo-400" />
          <div>
            <h2 className="text-2xl font-bold text-white">Meus Dispositivos</h2>
            <p className="text-sm text-gray-400">Acompanhe status, heartbeat e revogue TVs sem depender do suporte.</p>
          </div>
        </div>
        <button
          onClick={() => loadDevices(page)}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Total" value={stats.total} icon={<Tv size={18} className="text-indigo-300" />} />
        <StatCard label="Online" value={stats.online} icon={<span className="h-3 w-3 rounded-full bg-emerald-400" />} />
        <StatCard label="Aguardando ativacao" value={stats.pending} icon={<span className="h-3 w-3 rounded-full bg-amber-400" />} />
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <>
          <div className="grid gap-4">
            {result?.data.map((device) => {
              const status = statusMeta(device.operationalStatus)
              return (
                <div key={device.id} className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-white">{device.name}</h3>
                        <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-medium', status.className)}>
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-400">
                        Codigo de ativacao: <code className="rounded bg-gray-950 px-2 py-1 font-mono text-indigo-300">{device.activationCode}</code>
                      </p>
                    </div>
                    <button
                      onClick={() => revokeDevice(device.id)}
                      disabled={revokingId === device.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-800/70 bg-red-950/30 px-3 py-2 text-sm text-red-300 transition-colors hover:bg-red-950/50 disabled:opacity-40"
                    >
                      <Power size={14} />
                      {revokingId === device.id ? 'Revogando...' : 'Revogar dispositivo'}
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <InfoBlock label="Ultimo heartbeat" value={formatDate(device.lastSeenAt)} hint={timeAgo(device.lastSeenAt)} />
                    <InfoBlock label="IP" value={device.ipAddress ?? 'Nao informado'} />
                    <InfoBlock label="Modelo" value={device.deviceModel ?? 'Nao informado'} />
                    <InfoBlock label="Versao do app" value={device.appVersion ?? 'Nao informada'} hint={device.appEnvironment ? `Ambiente ${device.appEnvironment}` : undefined} />
                    <InfoBlock label="Criado em" value={formatDate(device.createdAt)} />
                  </div>
                </div>
              )
            })}

            {result?.data.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-900/50 px-6 py-12 text-center text-gray-500">
                Nenhum dispositivo registrado
              </div>
            )}
          </div>

          {result && result.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
              <span>{result.total} dispositivos</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => loadDevices(page - 1)} className="rounded bg-gray-800 px-3 py-1 disabled:opacity-40">Anterior</button>
                <span className="px-3 py-1">{page} / {result.totalPages}</span>
                <button disabled={page >= result.totalPages} onClick={() => loadDevices(page + 1)} className="rounded bg-gray-800 px-3 py-1 disabled:opacity-40">Proximo</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-800">
          {icon}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</p>
          <p className="text-2xl font-semibold text-white">{value}</p>
        </div>
      </div>
    </div>
  )
}

function InfoBlock({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-gray-950/70 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-gray-100">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  )
}
