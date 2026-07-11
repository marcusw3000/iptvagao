'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { toast } from 'sonner'
import { CheckCircle2, Copy, ExternalLink, Loader2, Ticket } from 'lucide-react'
import { api } from '@/lib/api'

interface PublicPlan {
  id: string
  name: string
  type: string
  price: string
}

interface ReferralResolution {
  valid: boolean
  resellerId?: string
  resellerName?: string
  referralCode: string
}

interface SignupSuccess {
  clientId: string
  subscriptionId: string
  paymentId: string
  checkoutUrl: string
  credentials: {
    username: string
    password: string
  }
  plan: PublicPlan
  reseller: {
    id: string
    name: string
    referralCode: string
  }
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '')
}

function isValidCpf(value: string) {
  const digits = normalizeDigits(value)
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) {
    return false
  }

  const numbers = digits.split('').map(Number)
  const calcCheckDigit = (sliceLength: number) => {
    const sum = numbers
      .slice(0, sliceLength)
      .reduce((acc, digit, index) => acc + digit * (sliceLength + 1 - index), 0)
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  return calcCheckDigit(9) === numbers[9] && calcCheckDigit(10) === numbers[10]
}

function formatCpf(value: string) {
  const digits = normalizeDigits(value).slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

const signupSchema = z.object({
  referralCode: z
    .string()
    .trim()
    .min(4, 'Informe um codigo valido'),
  name: z.string().min(2, 'Minimo 2 caracteres'),
  email: z.string().email('Email invalido'),
  phone: z.string().min(8, 'Informe seu WhatsApp'),
  document: z.string().refine((value) => isValidCpf(value), 'Informe um CPF valido'),
  password: z.string().min(6, 'Minimo 6 caracteres'),
  confirmPassword: z.string().min(6, 'Confirme a senha'),
  planId: z.string().min(1, 'Escolha um plano'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas precisam ser iguais',
  path: ['confirmPassword'],
})

type SignupForm = z.infer<typeof signupSchema>

type ReferralState = 'idle' | 'loading' | 'valid' | 'invalid'

export function SignupContent() {
  const searchParams = useSearchParams()
  const refFromUrl = searchParams.get('ref') ?? ''

  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [referralState, setReferralState] = useState<ReferralState>('idle')
  const [referral, setReferral] = useState<ReferralResolution | null>(null)
  const [success, setSuccess] = useState<SignupSuccess | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      referralCode: refFromUrl.toUpperCase(),
      name: '',
      email: '',
      phone: '',
      document: '',
      password: '',
      confirmPassword: '',
      planId: '',
    },
  })

  const documentRegistration = register('document')
  const referralCode = watch('referralCode')

  useEffect(() => {
    api.get<PublicPlan[]>('/public/signup/plans')
      .then((response) => setPlans(response.data))
      .catch(() => toast.error('Erro ao carregar planos'))
      .finally(() => setPlansLoading(false))
  }, [])

  useEffect(() => {
    if (refFromUrl) {
      setValue('referralCode', refFromUrl.toUpperCase())
    }
  }, [refFromUrl, setValue])

  useEffect(() => {
    const normalized = referralCode?.trim().toUpperCase() ?? ''
    if (!normalized) {
      setReferral(null)
      setReferralState('idle')
      return
    }

    if (normalized.length < 4) {
      setReferral(null)
      setReferralState('invalid')
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setReferralState('loading')
      try {
        const response = await api.get<ReferralResolution>(`/public/signup/referral-code/${normalized}`)
        setReferral(response.data)
        setReferralState(response.data.valid ? 'valid' : 'invalid')
      } catch {
        setReferral(null)
        setReferralState('invalid')
      }
    }, 350)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [referralCode])

  async function onSubmit(data: SignupForm) {
    if (!referral?.valid) {
      toast.error('Valide um codigo de indicacao antes de continuar')
      return
    }

    setSubmitting(true)
    try {
      const { confirmPassword, ...payload } = data
      const response = await api.post<SignupSuccess>('/public/signup/onboard', {
        ...payload,
        document: normalizeDigits(payload.document),
        referralCode: payload.referralCode.trim().toUpperCase(),
      })

      setSuccess(response.data)
      const checkoutWindow = window.open(response.data.checkoutUrl, '_blank', 'noopener,noreferrer')
      if (!checkoutWindow) {
        toast.message('Cadastro concluido. Use o botao abaixo para abrir o checkout.')
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string | string[] } } }
      const message = err.response?.data?.message
      toast.error(Array.isArray(message) ? message.join(', ') : message ?? 'Erro ao concluir cadastro')
    } finally {
      setSubmitting(false)
    }
  }

  function copyCredentials(value: string) {
    navigator.clipboard.writeText(value).then(() => {
      toast.success('Copiado')
    })
  }

  if (success) {
    return (
      <main className="min-h-screen bg-gray-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-emerald-800/60 bg-emerald-950/40 p-8">
            <div className="mb-6 flex items-center gap-3">
              <CheckCircle2 className="text-emerald-400" size={28} />
              <div>
                <h1 className="text-3xl font-bold">Cadastro concluido</h1>
                <p className="text-sm text-emerald-200/80">
                  Seu acesso foi criado e o checkout do plano ja foi iniciado.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-gray-500">Credenciais</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Login</p>
                    <div className="mt-1 flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2">
                      <span className="font-mono">{success.credentials.username}</span>
                      <button onClick={() => copyCredentials(success.credentials.username)} className="text-gray-400 hover:text-white">
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Senha</p>
                    <div className="mt-1 flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2">
                      <span className="font-mono">{success.credentials.password}</span>
                      <button onClick={() => copyCredentials(success.credentials.password)} className="text-gray-400 hover:text-white">
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-gray-500">Resumo</p>
                <div className="space-y-2 text-sm text-gray-300">
                  <p><span className="text-gray-500">Plano:</span> {success.plan.name}</p>
                  <p><span className="text-gray-500">Valor:</span> R$ {Number(success.plan.price).toFixed(2)}</p>
                  <p><span className="text-gray-500">Revendedor:</span> {success.reseller.name}</p>
                  <p><span className="text-gray-500">Codigo:</span> {success.reseller.referralCode}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={success.checkoutUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white transition-colors hover:bg-indigo-500"
              >
                <ExternalLink size={16} />
                Abrir checkout
              </a>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-700 px-5 py-3 font-medium text-gray-200 transition-colors hover:bg-gray-900"
              >
                Ir para login
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-10 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-gray-800 bg-gray-900/70 p-8">
          <div className="mb-8 max-w-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
              <Ticket size={14} />
              Cadastro por indicacao
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Entre pelo codigo do seu revendedor</h1>
            <p className="mt-3 text-gray-400">
              Valide seu codigo, escolha o plano e siga direto para o pagamento. Suas credenciais aparecem no final.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="mb-1 block text-sm text-gray-300">Codigo de indicacao</label>
              <input
                {...register('referralCode')}
                className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 uppercase tracking-[0.2em] text-white outline-none transition-colors focus:border-indigo-500"
                placeholder="VIP123"
              />
              <div className="mt-2 min-h-5 text-sm">
                {referralState === 'loading' && (
                  <span className="inline-flex items-center gap-2 text-gray-400">
                    <Loader2 size={14} className="animate-spin" />
                    Validando codigo...
                  </span>
                )}
                {referralState === 'valid' && referral?.valid && (
                  <span className="text-emerald-400">Codigo valido. Revendedor: {referral.resellerName}</span>
                )}
                {referralState === 'invalid' && (
                  <span className="text-red-400">Codigo de indicacao invalido.</span>
                )}
              </div>
              {errors.referralCode && <p className="mt-1 text-xs text-red-400">{errors.referralCode.message}</p>}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-300">Nome</label>
                <input
                  {...register('name')}
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none transition-colors focus:border-indigo-500"
                />
                {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">Email</label>
                <input
                  {...register('email')}
                  type="email"
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none transition-colors focus:border-indigo-500"
                />
                {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-300">Senha de acesso</label>
                <input
                  {...register('password')}
                  type="password"
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none transition-colors focus:border-indigo-500"
                  placeholder="Minimo 6 caracteres"
                />
                {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">Confirmar senha</label>
                <input
                  {...register('confirmPassword')}
                  type="password"
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none transition-colors focus:border-indigo-500"
                  placeholder="Repita a senha"
                />
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-300">WhatsApp</label>
                <input
                  {...register('phone')}
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none transition-colors focus:border-indigo-500"
                  placeholder="11999999999"
                />
                {errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-300">CPF</label>
                <input
                  name={documentRegistration.name}
                  ref={documentRegistration.ref}
                  onBlur={documentRegistration.onBlur}
                  inputMode="numeric"
                  maxLength={14}
                  onChange={(event) => {
                    const formatted = formatCpf(event.target.value)
                    event.target.value = formatted
                    setValue('document', formatted, { shouldDirty: true, shouldValidate: true })
                  }}
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none transition-colors focus:border-indigo-500"
                  placeholder="123.456.789-01"
                />
                {errors.document && <p className="mt-1 text-xs text-red-400">{errors.document.message}</p>}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-300">Plano</label>
              {plansLoading ? (
                <div className="inline-flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 size={14} className="animate-spin" />
                  Carregando planos...
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {plans.map((plan) => (
                    <label
                      key={plan.id}
                      className="flex cursor-pointer flex-col rounded-2xl border border-gray-800 bg-gray-950 p-4 transition-colors hover:border-indigo-500/60"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-white">{plan.name}</span>
                        <input type="radio" value={plan.id} {...register('planId')} className="h-4 w-4 accent-indigo-500" />
                      </div>
                      <span className="mt-2 text-sm uppercase tracking-[0.18em] text-gray-500">{plan.type}</span>
                      <span className="mt-4 text-2xl font-bold">R$ {Number(plan.price).toFixed(2)}</span>
                    </label>
                  ))}
                </div>
              )}
              {errors.planId && <p className="mt-1 text-xs text-red-400">{errors.planId.message}</p>}
            </div>

            <button
              type="submit"
              disabled={submitting || referralState !== 'valid' || plansLoading}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Criando cadastro...' : 'Continuar para pagamento'}
            </button>
          </form>
        </section>

        <aside className="rounded-[2rem] border border-gray-800 bg-gradient-to-br from-gray-900 via-gray-950 to-indigo-950/70 p-8">
          <h2 className="text-2xl font-bold">Como funciona</h2>
          <div className="mt-6 space-y-5 text-sm text-gray-300">
            <div>
              <p className="font-semibold text-white">1. Valide o codigo</p>
              <p className="mt-1 text-gray-400">O codigo identifica o revendedor responsavel pela sua indicacao.</p>
            </div>
            <div>
              <p className="font-semibold text-white">2. Escolha o plano</p>
              <p className="mt-1 text-gray-400">Selecione o plano ativo que faz sentido para a sua operacao.</p>
            </div>
            <div>
              <p className="font-semibold text-white">3. Pague e receba acesso</p>
              <p className="mt-1 text-gray-400">O checkout abre em seguida e as suas credenciais aparecem ao concluir o cadastro.</p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
