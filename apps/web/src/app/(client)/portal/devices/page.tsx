'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MonitorPlay } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'

const ONLINE_MS = 5 * 60 * 1000

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_MS
}

interface Device {
  id: string
  clientId: string
  name: string
  activationCode: string
  activated: boolean
  lastSeenAt: string | null
  ipAddress: string | null
}

interface PaginatedDevices {
  data: Device[]
  total: number
  page: number
  totalPages: number
}

export default function PortalDevicesPage() {
  const { clientId } = useAuth()
  const [result, setResult] = useState<PaginatedDevices | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  function loadDevices(p = 1) {
    if (!clientId) return
    setLoading(true)
    api.get<PaginatedDevices>(`/devices/by-client/${clientId}?page=${p}&limit=20`)
      .then((r) => { setResult(r.data); setPage(p) })
      .catch(() => toast.error('Erro ao carregar dispositivos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadDevices() }, [clientId])

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <MonitorPlay size={22} className="text-indigo-400" />
        <h2 className="text-2xl font-bold text-white">Meus Dispositivos</h2>
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Online</th>
                  <th className="px-4 py-3 font-medium">Visto por último</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((device) => (
                  <tr key={device.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3 text-white font-medium">{device.name}</td>
                    <td className="px-4 py-3">
                      <code className="text-indigo-400 font-mono">{device.activationCode}</code>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full',
                        device.activated
                          ? 'bg-emerald-900/40 text-emerald-400'
                          : 'bg-yellow-900/40 text-yellow-400',
                      )}>
                        {device.activated ? 'Ativado' : 'Aguardando'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <span className={cn(
                          'w-2 h-2 rounded-full',
                          isOnline(device.lastSeenAt) ? 'bg-emerald-400' : 'bg-gray-600',
                        )} />
                        <span className={cn('text-xs', isOnline(device.lastSeenAt) ? 'text-emerald-400' : 'text-gray-600')}>
                          {isOnline(device.lastSeenAt) ? 'Online' : 'Offline'}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {device.lastSeenAt
                        ? new Date(device.lastSeenAt).toLocaleString('pt-BR')
                        : '—'}
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
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
                <button
                  disabled={page <= 1}
                  onClick={() => loadDevices(page - 1)}
                  className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="px-3 py-1">{page} / {result.totalPages}</span>
                <button
                  disabled={page >= result.totalPages}
                  onClick={() => loadDevices(page + 1)}
                  className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
                >
                  Próximo
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
