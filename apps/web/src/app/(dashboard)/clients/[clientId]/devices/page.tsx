'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { MonitorPlay, ArrowLeft, Trash2, Copy, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
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

const createSchema = z.object({
  name: z.string().min(2, 'Minimo 2 caracteres'),
})

type CreateForm = z.infer<typeof createSchema>

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

export default function DevicesPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const [result, setResult] = useState<PaginatedDevices | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [page, setPage] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [createdDevice, setCreatedDevice] = useState<Device | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  })

  function loadDevices(p = 1) {
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

  async function onSubmit(data: CreateForm) {
    setCreating(true)
    try {
      const response = await api.post<Device>('/devices', { ...data, clientId })
      setCreatedDevice(response.data)
      setShowCreate(false)
      reset()
      loadDevices(1)
      toast.success('Dispositivo registrado')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message ?? 'Erro ao registrar dispositivo')
    } finally {
      setCreating(false)
    }
  }

  async function deleteDevice(deviceId: string) {
    if (!confirm('Revogar este dispositivo? A TV precisara ser ativada novamente.')) return
    setDeletingId(deviceId)
    try {
      await api.delete(`/devices/${deviceId}`)
      loadDevices(page)
      toast.success('Dispositivo revogado')
    } catch {
      toast.error('Erro ao revogar dispositivo')
    } finally {
      setDeletingId(null)
    }
  }

  async function copyActivationCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Codigo copiado')
    } catch {
      toast.error('Nao foi possivel copiar o codigo')
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/clients" className="text-gray-400 transition-colors hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <Link
          href={`/clients/${clientId}/subscription`}
          className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700"
        >
          Assinatura
        </Link>
        <Link
          href={`/clients/${clientId}/credentials`}
          className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700"
        >
          Credenciais
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => loadDevices(page)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-40"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <MonitorPlay size={16} />
            Novo Dispositivo
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Dispositivos</h2>
        <p className="mt-1 text-sm text-gray-400">Painel operacional para pareamento, revogacao e diagnostico rapido do cliente.</p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Online" value={stats.online} tone="emerald" />
        <StatCard label="Aguardando ativacao" value={stats.pending} tone="amber" />
      </div>

      {createdDevice && (
        <div className="mb-6 rounded-2xl border border-indigo-700/50 bg-indigo-950/30 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-indigo-300">Novo dispositivo criado</p>
              <h3 className="mt-1 text-lg font-semibold text-white">{createdDevice.name}</h3>
              <p className="mt-2 text-sm text-indigo-100">
                Codigo de ativacao:
                <code className="ml-2 rounded bg-gray-950 px-2 py-1 font-mono text-indigo-300">{createdDevice.activationCode}</code>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyActivationCode(createdDevice.activationCode)}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-700 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-900/40"
              >
                <Copy size={14} />
                Copiar codigo
              </button>
              <button
                onClick={() => setCreatedDevice(null)}
                className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

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
                        Codigo de ativacao:
                        <code className="ml-2 rounded bg-gray-950 px-2 py-1 font-mono text-indigo-300">{device.activationCode}</code>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => copyActivationCode(device.activationCode)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
                      >
                        <Copy size={14} />
                        Copiar codigo
                      </button>
                      <button
                        onClick={() => deleteDevice(device.id)}
                        disabled={deletingId === device.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-800/70 bg-red-950/30 px-3 py-2 text-sm text-red-300 transition-colors hover:bg-red-950/50 disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                        {deletingId === device.id ? 'Revogando...' : 'Revogar'}
                      </button>
                    </div>
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

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="mb-4 text-lg font-bold text-white">Novo Dispositivo</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-300">Nome *</label>
                <input
                  {...register('name')}
                  placeholder="ex: TV Recepcao"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                />
                {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
              </div>
              <div className="pt-2 text-xs text-gray-500">
                O sistema cria um codigo de ativacao na hora. Depois, basta abrir a TV e informar o codigo.
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); reset() }}
                  className="flex-1 rounded-lg bg-gray-800 py-2 text-gray-300 transition-colors hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 rounded-lg bg-indigo-600 py-2 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, tone = 'gray' }: { label: string; value: number; tone?: 'gray' | 'emerald' | 'amber' }) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-400'
      : tone === 'amber'
        ? 'text-amber-300'
        : 'text-white'

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className={cn('mt-2 text-2xl font-semibold', toneClass)}>{value}</p>
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
