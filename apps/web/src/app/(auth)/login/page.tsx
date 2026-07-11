'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'

const schema = z.object({
  username: z.string().min(1, 'Obrigatório'),
  password: z.string().min(4, 'Mínimo 4 caracteres'),
})

type LoginForm = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: LoginForm) {
    setLoading(true)
    try {
      await login(data.username, data.password)
      // role is now populated synchronously by the store after await
      const { role: currentRole } = useAuth.getState()
      if (currentRole === 'client_admin' || currentRole === 'client_user') {
        router.push('/portal')
      } else if (currentRole === 'reseller') {
        router.push('/reseller-portal')
      } else {
        router.push('/dashboard')
      }
    } catch {
      toast.error('Credenciais inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md p-8 bg-gray-900 rounded-2xl border border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-2">IPTV Agão</h1>
        <p className="text-gray-400 mb-8">Faça login para continuar</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              {...register('username')}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-brand"
              placeholder="Digite seu email"
              autoComplete="off"
            />
            {errors.username && (
              <p className="text-red-400 text-sm mt-1">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Senha</label>
            <input
              {...register('password')}
              type="password"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-brand"
              placeholder="••••••"
              autoComplete="off"
            />
            {errors.password && (
              <p className="text-red-400 text-sm mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand hover:bg-brand-dark text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <Link
            href="/signup"
            className="flex w-full items-center justify-center rounded-lg border border-gray-700 py-2.5 font-medium text-gray-200 transition-colors hover:bg-gray-800"
          >
            Registrar
          </Link>
        </form>
      </div>
    </div>
  )
}

