'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { MonitorPlay, ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface Device {
  id: string
  clientId: string
  name: string
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

const createSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
})

type CreateForm = z.infer<typeof createSchema>

export default function DevicesPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const [result, setResult] = useState<PaginatedDevices | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [page, setPage] = useState(1)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  })

  function loadDevices(p = 1) {
    setLoading(true)
    api.get<PaginatedDevices>(`/devices/by-client/${clientId}?page=${p}&limit=20`)
      .then((r) => { setResult(r.data); setPage(p) })
      .catch(() => toast.error('Erro ao carregar dispositivos'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadDevices() }, [clientId])

  async function onSubmit(data: CreateForm) {
    setCreating(true)
    try {
      await api.post('/devices', { ...data, clientId })
      setShowCreate(false)
      reset()
      loadDevices(page)
      toast.success('Dispositivo registrado')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message ?? 'Erro ao registrar dispositivo')
    } finally {
      setCreating(false)
    }
  }

  async function deleteDevice(deviceId: string) {
    if (!confirm('Remover este dispositivo?')) return
    try {
      await api.delete(`/devices/${deviceId}`)
      loadDevices(page)
      toast.success('Dispositivo removido')
    } catch {
      toast.error('Erro ao remover dispositivo')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clients" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <Link
          href={`/clients/${clientId}/subscription`}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
        >
          Assinatura
        </Link>
        <Link
          href={`/clients/${clientId}/credentials`}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
        >
          Credenciais
        </Link>
        <h2 className="text-2xl font-bold text-white">Dispositivos</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <MonitorPlay size={16} />
          Novo Dispositivo
        </button>
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
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((device) => (
                  <tr key={device.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3 text-white font-medium">{device.name}</td>
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
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                      {device.ipAddress ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deleteDevice(device.id)}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                          title="Remover dispositivo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
                <button disabled={page <= 1} onClick={() => loadDevices(page - 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Anterior</button>
                <span className="px-3 py-1">{page} / {result.totalPages}</span>
                <button disabled={page >= result.totalPages} onClick={() => loadDevices(page + 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Próximo</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Device Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Novo Dispositivo</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Nome *</label>
                <input
                  {...register('name')}
                  placeholder="ex: TV Recepção"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); reset() }} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={creating} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">{creating ? 'Criando...' : 'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
