# Plan: Client Portal (Read-Only Panel for client_admin / client_user)

**Date:** 2026-06-28  
**Branch:** `feature/client-portal`  
**Scope:** Frontend only — no backend changes; backend tests remain 59/59.

---

## Overview

Clients (`client_admin`, `client_user`) currently land on `/dashboard` after login — a page they
are not authorized to use. This plan creates a fully isolated `/portal` route group that lets
clients view their own subscription, devices, and channels in read-only mode.

Four tasks, each ending with a TypeScript gate (`cd apps/web && npx tsc --noEmit`) and a commit.

---

## Architecture recap

| Concern | Solution |
|---|---|
| Role awareness in auth store | Decode JWT on login and rehydration; store `role` + `clientId` |
| Post-login redirect | Login page reads `role` from store after `await login()` and routes accordingly |
| Admin layout protection | Extra `useEffect` that redirects client roles away from `/dashboard` |
| Portal route group | `(client)` group with its own layout guard, `ClientSidebar`, and four pages |
| Read-only enforcement | Portal pages have no create/edit/delete buttons — they only call GET endpoints |

---

## File map

### Modify
- `apps/web/src/lib/auth.ts`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(dashboard)/layout.tsx`

### Create
- `apps/web/src/components/client-sidebar.tsx`
- `apps/web/src/app/(client)/layout.tsx`
- `apps/web/src/app/(client)/portal/page.tsx`
- `apps/web/src/app/(client)/portal/subscription/page.tsx`
- `apps/web/src/app/(client)/portal/devices/page.tsx`
- `apps/web/src/app/(client)/portal/channels/page.tsx`

---

## Task 1 — Extend auth store + fix login redirect + fix admin layout guard

**Goal:** Every part of the frontend knows the current user's `role` and `clientId`. Login sends
clients to `/portal`. Admin layout bounces clients back to `/portal`.

### 1-A  `apps/web/src/lib/auth.ts`

Full replacement. Key additions:
- `role: string | null` and `clientId: string | null` in the interface.
- `login()` decodes the JWT payload and stores both fields.
- `onRehydrateStorage` also decodes the stored token so a page refresh keeps `role`/`clientId`.
- `logout()` now also clears `role` and `clientId`.
- `partialize` is **unchanged** — only `token` is persisted to localStorage.

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from './api'

interface AuthState {
  token: string | null
  isAuthenticated: boolean
  _hasHydrated: boolean
  role: string | null
  clientId: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,
      role: null,
      clientId: null,

      async login(username, password) {
        const { data } = await api.post<{ accessToken: string }>('/auth/login', {
          username,
          password,
        })
        localStorage.setItem('access_token', data.accessToken)
        const payload = JSON.parse(atob(data.accessToken.split('.')[1]))
        set({
          token: data.accessToken,
          isAuthenticated: true,
          role: payload.role ?? null,
          clientId: payload.clientId ?? null,
        })
      },

      logout() {
        localStorage.removeItem('access_token')
        set({ token: null, isAuthenticated: false, role: null, clientId: null })
        window.location.href = '/login'
      },
    }),
    {
      name: 'auth-storage',
      partialize: (s) => ({ token: s.token }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('[auth] rehydration failed:', error)
          useAuth.setState({ _hasHydrated: true })
          return
        }
        const isAuthenticated = !!state?.token
        let role: string | null = null
        let clientId: string | null = null
        if (state?.token) {
          localStorage.setItem('access_token', state.token)
          try {
            const payload = JSON.parse(atob(state.token.split('.')[1]))
            role = payload.role ?? null
            clientId = payload.clientId ?? null
          } catch {
            // malformed token — treat as unauthenticated
          }
        }
        useAuth.setState({ _hasHydrated: true, isAuthenticated, role, clientId })
      },
    },
  ),
)
```

**Why `JSON.parse(atob(token.split('.')[1]))`?**  
The JWT middle segment is Base64url-encoded JSON. `atob()` handles standard Base64 in the browser.
No extra library is needed; this is safe because we are only reading claims — not verifying the
signature on the client side.

---

### 1-B  `apps/web/src/app/(auth)/login/page.tsx`

Only two lines change: destructure `role` from `useAuth()` and use it in `onSubmit`.

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'

const schema = z.object({
  username: z.string().min(1, 'Obrigatório'),
  password: z.string().min(4, 'Mínimo 4 caracteres'),
})

type LoginForm = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const { login, role } = useAuth()
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Usuário</label>
            <input
              {...register('username')}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-brand"
              placeholder="admin"
              autoComplete="username"
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
              autoComplete="current-password"
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
        </form>
      </div>
    </div>
  )
}
```

**Note on `useAuth.getState()`:** After `await login(...)` resolves, the store has already called
`set(...)` synchronously. Reading via `useAuth.getState()` (the static getter Zustand exposes)
guarantees we see the freshly-written `role` without needing an extra re-render cycle.

---

### 1-C  `apps/web/src/app/(dashboard)/layout.tsx`

Add one extra `useEffect` that redirects client roles away from the admin panel.

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { Sidebar } from '@/components/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated, role } = useAuth()
  const router = useRouter()

  // Redirect unauthenticated users
  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, _hasHydrated, router])

  // Redirect client roles to the portal — they must not see the admin panel
  useEffect(() => {
    if (_hasHydrated && isAuthenticated && (role === 'client_admin' || role === 'client_user')) {
      router.replace('/portal')
    }
  }, [_hasHydrated, isAuthenticated, role, router])

  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return null
  if (role === 'client_admin' || role === 'client_user') return null

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
```

### Validation gate

```bash
cd apps/web && npx tsc --noEmit
# expected: 0 errors
```

### Commit

```
git add apps/web/src/lib/auth.ts \
        apps/web/src/app/(auth)/login/page.tsx \
        apps/web/src/app/(dashboard)/layout.tsx
git commit -m "feat(auth): add role+clientId to store, role-based login redirect, portal guard in admin layout"
```

---

## Task 2 — ClientSidebar + client portal layout + route group structure

**Goal:** The `(client)` route group exists with a working layout guard and sidebar before any
portal pages are written. This means Task 3 and Task 4 can be verified in isolation.

---

### 2-A  `apps/web/src/components/client-sidebar.tsx`

Mirrors the existing `Sidebar` component exactly in structure and styling. Navigation items point
to portal routes. The subtitle reads "Portal" instead of "Admin".

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  MonitorPlay,
  Radio,
  CreditCard,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'

const navItems = [
  { href: '/portal', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portal/devices', label: 'Dispositivos', icon: MonitorPlay },
  { href: '/portal/channels', label: 'Canais', icon: Radio },
  { href: '/portal/subscription', label: 'Assinatura', icon: CreditCard },
]

export function ClientSidebar() {
  const pathname = usePathname()
  const { logout } = useAuth()

  return (
    <aside className="w-60 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">IPTV Agão</h1>
        <p className="text-xs text-gray-500 mt-0.5">Portal</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === href || (href !== '/portal' && pathname.startsWith(href))
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800',
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  )
}
```

---

### 2-B  `apps/web/src/app/(client)/layout.tsx`

Guard logic mirrors the admin layout but inverted: allow only `client_admin` and `client_user`;
redirect admin-role users to `/dashboard`; redirect unauthenticated users to `/login`.

```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { ClientSidebar } from '@/components/client-sidebar'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated, role } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!_hasHydrated) return
    if (!isAuthenticated) {
      router.replace('/login')
      return
    }
    if (role !== 'client_admin' && role !== 'client_user') {
      router.replace('/dashboard')
    }
  }, [_hasHydrated, isAuthenticated, role, router])

  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return null
  if (role !== 'client_admin' && role !== 'client_user') return null

  return (
    <div className="flex min-h-screen bg-gray-950">
      <ClientSidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
```

### Validation gate

```bash
cd apps/web && npx tsc --noEmit
# expected: 0 errors
```

### Commit

```
git add apps/web/src/components/client-sidebar.tsx \
        apps/web/src/app/(client)/layout.tsx
git commit -m "feat(portal): add ClientSidebar and (client) layout guard"
```

---

## Task 3 — Portal pages: dashboard + subscription (read-only)

---

### 3-A  `apps/web/src/app/(client)/portal/page.tsx`

Three summary cards: subscription status + plan name, device count, channel count. Each card fires
a GET request. The device and channel requests use `limit=1` so the API returns only the `total`
field — no need to render full lists on this page.

```typescript
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CreditCard, MonitorPlay, Radio } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'

interface Subscription {
  status: 'active' | 'suspended' | 'cancelled' | 'past_due'
  plan: { name: string; price: string }
}

interface PaginatedMeta {
  total: number
}

const STATUS_LABELS: Record<Subscription['status'], string> = {
  active: 'Ativa',
  suspended: 'Suspensa',
  cancelled: 'Cancelada',
  past_due: 'Em atraso',
}

const STATUS_COLORS: Record<Subscription['status'], string> = {
  active: 'bg-emerald-900/40 text-emerald-400',
  suspended: 'bg-yellow-900/40 text-yellow-400',
  cancelled: 'bg-red-900/40 text-red-400',
  past_due: 'bg-orange-900/40 text-orange-400',
}

export default function PortalPage() {
  const { clientId } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [subNotFound, setSubNotFound] = useState(false)
  const [deviceCount, setDeviceCount] = useState<number | null>(null)
  const [channelCount, setChannelCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return

    async function load() {
      setLoading(true)
      try {
        const [subRes, devRes, chRes] = await Promise.allSettled([
          api.get<Subscription>(`/subscriptions/by-client/${clientId}`),
          api.get<PaginatedMeta>(`/devices/by-client/${clientId}?page=1&limit=1`),
          api.get<PaginatedMeta>(`/channels/by-client/${clientId}?page=1&limit=1`),
        ])

        if (subRes.status === 'fulfilled') {
          setSubscription(subRes.value.data)
          setSubNotFound(false)
        } else {
          const err = subRes.reason as { response?: { status?: number } }
          if (err?.response?.status === 404) setSubNotFound(true)
          else toast.error('Erro ao carregar assinatura')
        }

        if (devRes.status === 'fulfilled') setDeviceCount(devRes.value.data.total)
        if (chRes.status === 'fulfilled') setChannelCount(chRes.value.data.total)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [clientId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Meu Painel</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Subscription card */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-900/40 rounded-lg">
              <CreditCard size={20} className="text-indigo-400" />
            </div>
            <span className="text-gray-400 text-sm font-medium">Assinatura</span>
          </div>
          {subNotFound || !subscription ? (
            <p className="text-gray-500 text-sm">Sem assinatura</p>
          ) : (
            <>
              <p className="text-white font-semibold text-lg">{subscription.plan.name}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={cn('text-xs px-2 py-1 rounded-full', STATUS_COLORS[subscription.status])}>
                  {STATUS_LABELS[subscription.status]}
                </span>
                <span className="text-gray-500 text-xs">
                  R$ {Number(subscription.plan.price).toFixed(2)}/mês
                </span>
              </div>
            </>
          )}
        </div>

        {/* Devices card */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-900/40 rounded-lg">
              <MonitorPlay size={20} className="text-indigo-400" />
            </div>
            <span className="text-gray-400 text-sm font-medium">Dispositivos</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {deviceCount === null ? '—' : deviceCount}
          </p>
          <p className="text-gray-500 text-xs mt-1">dispositivos registrados</p>
        </div>

        {/* Channels card */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-900/40 rounded-lg">
              <Radio size={20} className="text-indigo-400" />
            </div>
            <span className="text-gray-400 text-sm font-medium">Canais</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {channelCount === null ? '—' : channelCount}
          </p>
          <p className="text-gray-500 text-xs mt-1">canais disponíveis</p>
        </div>
      </div>
    </div>
  )
}
```

---

### 3-B  `apps/web/src/app/(client)/portal/subscription/page.tsx`

Shows subscription details and plan info. No action buttons at all. The status badge and date
display are copy-pasted style constants from the admin subscription page to stay visually
consistent.

```typescript
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CreditCard } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'

interface SubscriptionPlan {
  id: string
  name: string
  type: string
  price: string
}

interface Subscription {
  id: string
  clientId: string
  planId: string
  status: 'active' | 'suspended' | 'cancelled' | 'past_due'
  startDate: string
  endDate: string | null
  plan: SubscriptionPlan
}

const STATUS_LABELS: Record<Subscription['status'], string> = {
  active: 'Ativa',
  suspended: 'Suspensa',
  cancelled: 'Cancelada',
  past_due: 'Em atraso',
}

const STATUS_COLORS: Record<Subscription['status'], string> = {
  active: 'bg-emerald-900/40 text-emerald-400',
  suspended: 'bg-yellow-900/40 text-yellow-400',
  cancelled: 'bg-red-900/40 text-red-400',
  past_due: 'bg-orange-900/40 text-orange-400',
}

export default function PortalSubscriptionPage() {
  const { clientId } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return
    api.get<Subscription>(`/subscriptions/by-client/${clientId}`)
      .then((r) => { setSubscription(r.data); setNotFound(false) })
      .catch((e: unknown) => {
        const err = e as { response?: { status?: number } }
        if (err?.response?.status === 404) setNotFound(true)
        else toast.error('Erro ao carregar assinatura')
      })
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) return <p className="text-gray-400">Carregando...</p>

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Minha Assinatura</h2>

      {notFound && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
          <CreditCard size={40} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400">Você não possui assinatura ativa.</p>
          <p className="text-gray-500 text-sm mt-1">
            Entre em contato com o suporte para contratar um plano.
          </p>
        </div>
      )}

      {subscription && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-semibold text-white">{subscription.plan.name}</h3>
                <span className={cn('text-xs px-2 py-1 rounded-full', STATUS_COLORS[subscription.status])}>
                  {STATUS_LABELS[subscription.status]}
                </span>
              </div>
              <p className="text-gray-400 text-sm">
                R$ {Number(subscription.plan.price).toFixed(2)}/mês
              </p>
              <div className="mt-4 space-y-1 text-sm text-gray-500">
                <p>
                  <span className="text-gray-400">Tipo:</span>{' '}
                  {subscription.plan.type}
                </p>
                <p>
                  <span className="text-gray-400">Início:</span>{' '}
                  {new Date(subscription.startDate).toLocaleDateString('pt-BR')}
                </p>
                {subscription.endDate && (
                  <p>
                    <span className="text-gray-400">Vencimento:</span>{' '}
                    {new Date(subscription.endDate).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            </div>
          </div>
          <p className="mt-6 text-xs text-gray-600">
            Para renovar ou cancelar sua assinatura entre em contato com o suporte.
          </p>
        </div>
      )}
    </div>
  )
}
```

### Validation gate

```bash
cd apps/web && npx tsc --noEmit
# expected: 0 errors
```

### Commit

```
git add apps/web/src/app/(client)/portal/page.tsx \
        apps/web/src/app/(client)/portal/subscription/page.tsx
git commit -m "feat(portal): add portal dashboard and read-only subscription page"
```

---

## Task 4 — Portal pages: devices + channels (read-only)

---

### 4-A  `apps/web/src/app/(client)/portal/devices/page.tsx`

Paginated device table. Compared to the admin version:
- No "Novo Dispositivo" button.
- No "Gerar código de ativação" button (Key icon column removed).
- "Ações" column is removed entirely.
- `lastSeenAt` is shown instead of `ipAddress` (more useful for a client).

```typescript
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MonitorPlay } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'

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
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {device.lastSeenAt
                        ? new Date(device.lastSeenAt).toLocaleString('pt-BR')
                        : '—'}
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
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
```

---

### 4-B  `apps/web/src/app/(client)/portal/channels/page.tsx`

Channels grouped by category. Compared to the admin version:
- No "Categoria" or "Canal" add buttons.
- No delete button on each channel row.
- `ChannelList` is a read-only version with no `onDelete` prop.
- Categories are fetched via `GET /categories/by-client/:clientId` (same endpoint the admin uses).

```typescript
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Radio } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'

interface Category {
  id: string
  name: string
  order: number
}

interface Channel {
  id: string
  clientId: string
  categoryId: string | null
  name: string
  url: string
  logoUrl: string | null
  order: number
  active: boolean
}

interface PaginatedChannels {
  data: Channel[]
  total: number
  totalPages: number
}

export default function PortalChannelsPage() {
  const { clientId } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelResult, setChannelResult] = useState<PaginatedChannels | null>(null)
  const [channelPage, setChannelPage] = useState(1)
  const [loading, setLoading] = useState(true)

  async function loadData(p = 1) {
    if (!clientId) return
    setLoading(true)
    try {
      const [catRes, chRes] = await Promise.all([
        api.get<Category[]>(`/categories/by-client/${clientId}`),
        api.get<PaginatedChannels>(`/channels/by-client/${clientId}?page=${p}&limit=50`),
      ])
      setCategories(catRes.data)
      setChannelResult(chRes.data)
      setChannels(chRes.data.data)
      setChannelPage(p)
    } catch {
      toast.error('Erro ao carregar canais')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [clientId])

  const uncategorized = channels.filter((c) => !c.categoryId)
  const grouped = categories.map((cat) => ({
    category: cat,
    channels: channels.filter((c) => c.categoryId === cat.id),
  }))

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Radio size={22} className="text-indigo-400" />
        <h2 className="text-2xl font-bold text-white">Meus Canais</h2>
        {channelResult && (
          <span className="text-gray-500 text-sm ml-2">{channelResult.total} canais</span>
        )}
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ category, channels: catChannels }) => (
            <div key={category.id}>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {category.name}
              </h3>
              <ChannelList channels={catChannels} />
            </div>
          ))}

          {uncategorized.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Sem categoria
              </h3>
              <ChannelList channels={uncategorized} />
            </div>
          )}

          {channels.length === 0 && (
            <p className="text-gray-500 text-center py-12">Nenhum canal disponível</p>
          )}
        </div>
      )}

      {channelResult && channelResult.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
          <span>{channelResult.total} canais</span>
          <div className="flex gap-2">
            <button
              disabled={channelPage <= 1}
              onClick={() => loadData(channelPage - 1)}
              className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="px-3 py-1">{channelPage} / {channelResult.totalPages}</span>
            <button
              disabled={channelPage >= channelResult.totalPages}
              onClick={() => loadData(channelPage + 1)}
              className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ChannelList({ channels }: { channels: Channel[] }) {
  if (channels.length === 0) {
    return <p className="text-gray-600 text-sm py-2">Nenhum canal nesta categoria</p>
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {channels.map((ch, i) => (
        <div
          key={ch.id}
          className={`flex items-center gap-3 px-4 py-3 ${i < channels.length - 1 ? 'border-b border-gray-800' : ''}`}
        >
          {ch.logoUrl ? (
            <img src={ch.logoUrl} alt={ch.name} className="w-8 h-8 rounded object-cover bg-gray-800" />
          ) : (
            <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center">
              <Radio size={14} className="text-gray-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium">{ch.name}</p>
            <p className="text-gray-500 text-xs truncate">{ch.url}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

### Validation gate

```bash
cd apps/web && npx tsc --noEmit
# expected: 0 errors
```

### Commit

```
git add apps/web/src/app/(client)/portal/devices/page.tsx \
        apps/web/src/app/(client)/portal/channels/page.tsx
git commit -m "feat(portal): add read-only devices and channels pages"
```

---

## Cross-cutting notes

### Why `useAuth.getState()` in the login redirect

After `await login(username, password)` the Zustand store has been updated synchronously via
`set()`. However the React component has not re-rendered yet, so destructured `role` from
`const { login, role } = useAuth()` still holds the pre-login value (`null`). Using
`useAuth.getState().role` reads the store's raw state directly, bypassing the stale closure.

### No backend changes

All endpoints consumed by the portal (`/subscriptions/by-client/:clientId`,
`/devices/by-client/:clientId`, `/channels/by-client/:clientId`, `/categories/by-client/:clientId`)
already exist. The NestJS guards on those endpoints must allow `client_admin` and `client_user`
roles — that is an existing backend decision outside this plan's scope. If those guards
currently reject those roles, a single-line role array addition in the corresponding NestJS
`@Roles()` decorator on each controller would be required, but that is a backend concern.

### Route group isolation

Next.js route groups (`(client)`, `(dashboard)`, `(auth)`) are folder-level and do not affect the
URL path. `/portal` and `/dashboard` are completely separate URL trees. This means:
- The `(client)` layout guard fires for every URL under `/portal/*`.
- The `(dashboard)` layout guard fires for every URL under `/dashboard`, `/clients`, `/plans`.
- Neither layout fires for `/login`.

### `partialize` deliberately persists only `token`

`role` and `clientId` are **derived** from the JWT — they can always be re-decoded from `token` on
rehydration (as the `onRehydrateStorage` implementation does). Persisting them separately would
create a source-of-truth split that could cause stale role bugs after a token refresh. The current
approach is intentionally conservative.

### TypeScript strictness

All pages use explicit interface types (no `any`). `useAuth` is typed so adding `role` and
`clientId` to the interface will cause compile errors in every component that destructures the
store until the store is updated first — meaning Task 1 must be completed before Tasks 2-4 will
compile. This is the desired ordering.

---

## Summary checklist

- [ ] Task 1: auth store (role + clientId) + login redirect + admin layout guard
- [ ] Task 2: ClientSidebar + (client) layout
- [ ] Task 3: `/portal` dashboard page + `/portal/subscription` read-only page
- [ ] Task 4: `/portal/devices` read-only page + `/portal/channels` read-only page
- [ ] All four `npx tsc --noEmit` runs pass with 0 errors
- [ ] Backend tests still 59/59 (no backend files touched)
