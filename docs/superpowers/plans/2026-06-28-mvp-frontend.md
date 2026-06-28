# MVP Frontend (Admin Panel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin panel that lets operators manage clients, devices, channels, categories, and view plans — consuming the existing NestJS API.

**Architecture:** Next.js 14 App Router, dark-themed Tailwind UI (no component library). Auth is stored in localStorage via Zustand persist; a client-side guard in `(dashboard)/layout.tsx` redirects unauthenticated users. Direct axios calls via the existing `api` client — no react-query. Forms use react-hook-form + zod (already installed).

**Tech Stack:** Next.js 14, React 18, Tailwind CSS, Zustand, axios, react-hook-form, zod, sonner, lucide-react

---

## Existing files (read before implementing any task)

- `apps/web/src/lib/api.ts` — axios instance, reads `localStorage.access_token`, handles 401 redirect
- `apps/web/src/lib/auth.ts` — Zustand store: `{ token, login, logout }`
- `apps/web/src/app/(auth)/login/page.tsx` — complete, do not modify
- `apps/web/src/app/layout.tsx` — root layout, Geist font, Sonner toaster
- `apps/web/tailwind.config.ts` — defines `brand`/`brand-dark` colors (verify before using)

## API base URL

All API calls: `http://localhost:3001/api/v1`

Paginated endpoints return: `{ data: T[], total: number, page: number, limit: number, totalPages: number }`

Key endpoints used in this plan:
- `GET /plans` → `Plan[]`
- `POST /clients` → `{ client: Client, credentials: { username, password } }`
- `GET /clients?page=1&limit=20` → paginated
- `PATCH /clients/:id/suspend` + `PATCH /clients/:id/activate`
- `GET /devices/by-client/:clientId` → paginated
- `POST /devices` → `Device`
- `POST /devices/:id/activation-code` → `{ code: string, expiresAt: string }`
- `GET /categories/by-client/:clientId` → `Category[]`
- `POST /categories` → `Category`
- `GET /channels/by-client/:clientId` → paginated
- `POST /channels` → `Channel`
- `DELETE /channels/:id`

---

## Task 1: Shared utilities + auth guard layout

**Files:**
- Create: `apps/web/src/lib/cn.ts`
- Create: `apps/web/src/app/(dashboard)/layout.tsx`
- Modify: `apps/web/src/lib/auth.ts`

- [ ] **Step 1: Create `cn` utility**

`apps/web/src/lib/cn.ts`:
```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 2: Add `isAuthenticated` getter to auth store**

Read `apps/web/src/lib/auth.ts` first. Then replace the entire file:

`apps/web/src/lib/auth.ts`:
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from './api'

interface AuthState {
  token: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isAuthenticated: false,

      async login(username, password) {
        const { data } = await api.post<{ accessToken: string }>('/auth/login', {
          username,
          password,
        })
        localStorage.setItem('access_token', data.accessToken)
        set({ token: data.accessToken, isAuthenticated: true })
      },

      logout() {
        localStorage.removeItem('access_token')
        set({ token: null, isAuthenticated: false })
        window.location.href = '/login'
      },
    }),
    {
      name: 'auth-storage',
      partialize: (s) => ({ token: s.token, isAuthenticated: s.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          localStorage.setItem('access_token', state.token)
        }
      },
    },
  ),
)
```

- [ ] **Step 3: Create dashboard auth guard layout**

`apps/web/src/app/(dashboard)/layout.tsx`:
```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) return null

  return <>{children}</>
}
```

- [ ] **Step 4: Verify login flow works**

Start dev server: `cd apps/web && pnpm dev`

Open `http://localhost:3000` → should redirect to `/login`.
Login with admin/admin123 (seeded user) → should reach `/dashboard`.
Refresh → should stay on `/dashboard` (token persisted).
Manually go to `http://localhost:3000/dashboard` without token → should redirect to `/login`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/cn.ts apps/web/src/lib/auth.ts apps/web/src/app/(dashboard)/layout.tsx
git commit -m "feat(web): auth guard layout, cn utility, isAuthenticated in store"
```

---

## Task 2: Sidebar + Dashboard shell

**Files:**
- Create: `apps/web/src/components/sidebar.tsx`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Create sidebar component**

`apps/web/src/components/sidebar.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users,
  Tv,
  Radio,
  CreditCard,
  LayoutDashboard,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clientes', icon: Users },
  { href: '/plans', label: 'Planos', icon: CreditCard },
]

export function Sidebar() {
  const pathname = usePathname()
  const { logout } = useAuth()

  return (
    <aside className="w-60 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">IPTV Agão</h1>
        <p className="text-xs text-gray-500 mt-0.5">Admin</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
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

- [ ] **Step 2: Add sidebar to dashboard layout**

Replace `apps/web/src/app/(dashboard)/layout.tsx`:
```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { Sidebar } from '@/components/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) return null

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

- [ ] **Step 3: Update dashboard placeholder**

Replace `apps/web/src/app/(dashboard)/dashboard/page.tsx`:
```tsx
export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-white">Dashboard</h2>
      <p className="text-gray-400 mt-2">Bem-vindo ao painel de administração.</p>
    </div>
  )
}
```

- [ ] **Step 4: Verify sidebar renders**

With dev server running: login → should see sidebar on left with nav links + Sair button.
Click each nav link → should navigate (pages 404 for now, that's fine).
Click Sair → should logout and redirect to `/login`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/sidebar.tsx apps/web/src/app/(dashboard)/layout.tsx apps/web/src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(web): sidebar navigation shell with auth-guarded layout"
```

---

## Task 3: Plans Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/plans/page.tsx`

Simple read-only list. No create/delete.

- [ ] **Step 1: Create plans page**

`apps/web/src/app/(dashboard)/plans/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Plan {
  id: string
  name: string
  type: string
  price: string
  maxDevices: number
  maxChannels: number
  maxUsers: number
  storageGB: number
  active: boolean
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Plan[]>('/plans')
      .then((r) => setPlans(r.data))
      .catch(() => toast.error('Erro ao carregar planos'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-gray-400">Carregando...</p>
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Planos</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <span className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded-full uppercase">
                {plan.type}
              </span>
            </div>
            <p className="text-3xl font-bold text-white mb-4">
              R$ {Number(plan.price).toFixed(2)}
              <span className="text-sm font-normal text-gray-400">/mês</span>
            </p>
            <ul className="space-y-1.5 text-sm text-gray-400">
              <li>{plan.maxDevices} dispositivos</li>
              <li>{plan.maxChannels} canais</li>
              <li>{plan.maxUsers} usuários</li>
              <li>{plan.storageGB} GB armazenamento</li>
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify page renders**

Navigate to `/plans` → should show plan cards from the seeded data (Básico + Premium).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/plans/page.tsx
git commit -m "feat(web): plans page — read-only plan cards"
```

---

## Task 4: Clients Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/clients/page.tsx`

Features: list clients, create client (shows credentials in modal), suspend/activate.

- [ ] **Step 1: Create clients page**

`apps/web/src/app/(dashboard)/clients/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { UserPlus, Ban, CheckCircle, Tv } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface Client {
  id: string
  name: string
  email: string
  phone: string | null
  active: boolean
  createdAt: string
}

interface PaginatedClients {
  data: Client[]
  total: number
  page: number
  totalPages: number
}

const createSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  document: z.string().optional(),
})

type CreateForm = z.infer<typeof createSchema>

interface Credentials {
  username: string
  password: string
}

export default function ClientsPage() {
  const [result, setResult] = useState<PaginatedClients | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCredentials, setNewCredentials] = useState<Credentials | null>(null)
  const [page, setPage] = useState(1)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  })

  function loadClients(p = 1) {
    setLoading(true)
    api.get<PaginatedClients>(`/clients?page=${p}&limit=20`)
      .then((r) => { setResult(r.data); setPage(p) })
      .catch(() => toast.error('Erro ao carregar clientes'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadClients() }, [])

  async function onSubmit(data: CreateForm) {
    setCreating(true)
    try {
      const r = await api.post<{ client: Client; credentials: Credentials }>('/clients', data)
      setNewCredentials(r.data.credentials)
      setShowCreate(false)
      reset()
      loadClients(page)
      toast.success('Cliente criado com sucesso')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao criar cliente')
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(client: Client) {
    try {
      const endpoint = client.active ? `/clients/${client.id}/suspend` : `/clients/${client.id}/activate`
      await api.patch(endpoint)
      loadClients(page)
      toast.success(client.active ? 'Cliente suspenso' : 'Cliente ativado')
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Clientes</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <UserPlus size={16} />
          Novo Cliente
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
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((client) => (
                  <tr key={client.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3 text-white font-medium">{client.name}</td>
                    <td className="px-4 py-3 text-gray-400">{client.email}</td>
                    <td className="px-4 py-3 text-gray-400">{client.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full',
                        client.active
                          ? 'bg-emerald-900/40 text-emerald-400'
                          : 'bg-red-900/40 text-red-400',
                      )}>
                        {client.active ? 'Ativo' : 'Suspenso'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/clients/${client.id}/devices`}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                          title="Dispositivos"
                        >
                          <Tv size={14} />
                        </Link>
                        <button
                          onClick={() => toggleActive(client)}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                          title={client.active ? 'Suspender' : 'Ativar'}
                        >
                          {client.active ? <Ban size={14} /> : <CheckCircle size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Nenhum cliente cadastrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result && result.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{result.total} clientes</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => loadClients(page - 1)}
                  className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="px-3 py-1">
                  {page} / {result.totalPages}
                </span>
                <button
                  disabled={page >= result.totalPages}
                  onClick={() => loadClients(page + 1)}
                  className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
                >
                  Próximo
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Client Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Novo Cliente</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Nome *</label>
                <input
                  {...register('name')}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Email *</label>
                <input
                  {...register('email')}
                  type="email"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Telefone</label>
                <input
                  {...register('phone')}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">CNPJ / CPF</label>
                <input
                  {...register('document')}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); reset() }}
                  className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal — shown once after creation */}
      {newCredentials && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm text-center">
            <h3 className="text-lg font-bold text-white mb-2">Credenciais do Cliente</h3>
            <p className="text-gray-400 text-sm mb-6">
              Anote — a senha não será exibida novamente.
            </p>
            <div className="bg-gray-800 rounded-lg p-4 mb-6 space-y-2 text-left">
              <div>
                <span className="text-xs text-gray-500">Usuário</span>
                <p className="text-white font-mono text-lg">{newCredentials.username}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Senha</span>
                <p className="text-white font-mono text-lg">{newCredentials.password}</p>
              </div>
            </div>
            <button
              onClick={() => setNewCredentials(null)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify clients page**

With API running (`docker compose up -d` → `prisma migrate dev` → `prisma db seed`):
- Navigate to `/clients` → table renders (empty or with test data)
- Click "Novo Cliente" → form modal opens
- Submit valid form → credentials modal appears with username/password
- Credentials modal: click "Entendi" → modal closes
- Table refreshes with new client

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/clients/page.tsx
git commit -m "feat(web): clients page — list, create with credentials modal, suspend/activate"
```

---

## Task 5: Devices Page (per client)

**Files:**
- Create: `apps/web/src/app/(dashboard)/clients/[clientId]/devices/page.tsx`

Features: list devices for a client, register new device, generate activation code.

- [ ] **Step 1: Create devices page**

`apps/web/src/app/(dashboard)/clients/[clientId]/devices/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { MonitorPlay, Key, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
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

interface ActivationCode {
  code: string
  expiresAt: string
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
  const [activationCode, setActivationCode] = useState<ActivationCode | null>(null)
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
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao registrar dispositivo')
    } finally {
      setCreating(false)
    }
  }

  async function generateCode(deviceId: string) {
    try {
      const r = await api.post<ActivationCode>(`/devices/${deviceId}/activation-code`)
      setActivationCode(r.data)
    } catch {
      toast.error('Erro ao gerar código')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clients" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
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
                  <th className="px-4 py-3 font-medium">Código</th>
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
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                      {device.ipAddress ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => generateCode(device.id)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                        title="Gerar código de ativação"
                      >
                        <Key size={14} />
                      </button>
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

      {/* Activation Code Modal */}
      {activationCode && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm text-center">
            <Key className="mx-auto mb-3 text-indigo-400" size={32} />
            <h3 className="text-lg font-bold text-white mb-1">Código de Ativação</h3>
            <p className="text-gray-400 text-sm mb-6">
              Expira em: {new Date(activationCode.expiresAt).toLocaleTimeString('pt-BR')}
            </p>
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <p className="text-4xl font-mono font-bold text-indigo-400 tracking-widest">
                {activationCode.code}
              </p>
            </div>
            <button onClick={() => setActivationCode(null)} className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify devices page**

From `/clients`, click the TV icon on a client → should navigate to `/clients/:id/devices`.
Click "Novo Dispositivo" → form opens → submit → device appears in table.
Click Key icon → activation code modal shows 6-char code with expiry time.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/clients/
git commit -m "feat(web): devices page per client — list, register, generate activation code"
```

---

## Task 6: Channels + Categories Page (per client)

**Files:**
- Create: `apps/web/src/app/(dashboard)/clients/[clientId]/channels/page.tsx`

Features: list channels grouped by category, add category, add channel, delete channel.
Add "Canais" link to the Devices page so the user can navigate between the two.

- [ ] **Step 1: Add Channels link to Devices page**

In `apps/web/src/app/(dashboard)/clients/[clientId]/devices/page.tsx`, add a link to channels next to the "Novo Dispositivo" button. Read the file first, then add this link after the back arrow:

```tsx
<Link
  href={`/clients/${clientId}/channels`}
  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
>
  Canais
</Link>
```

Place it between the back arrow and the title: `<ArrowLeft /> <Link>Canais</Link> <h2>Dispositivos</h2>`

- [ ] **Step 2: Create channels page**

`apps/web/src/app/(dashboard)/clients/[clientId]/channels/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Radio, FolderPlus, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'

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
}

const categorySchema = z.object({
  name: z.string().min(1, 'Obrigatório'),
})

const channelSchema = z.object({
  name: z.string().min(1, 'Obrigatório'),
  url: z.string().min(1, 'Obrigatório'),
  categoryId: z.string().optional(),
  logoUrl: z.string().optional(),
})

type CategoryForm = z.infer<typeof categorySchema>
type ChannelForm = z.infer<typeof channelSchema>

export default function ChannelsPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const [categories, setCategories] = useState<Category[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showAddChannel, setShowAddChannel] = useState(false)
  const [saving, setSaving] = useState(false)

  const catForm = useForm<CategoryForm>({ resolver: zodResolver(categorySchema) })
  const chForm = useForm<ChannelForm>({ resolver: zodResolver(channelSchema) })

  async function loadData() {
    setLoading(true)
    try {
      const [catRes, chRes] = await Promise.all([
        api.get<Category[]>(`/categories/by-client/${clientId}`),
        api.get<PaginatedChannels>(`/channels/by-client/${clientId}?limit=100`),
      ])
      setCategories(catRes.data)
      setChannels(chRes.data.data)
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [clientId])

  async function addCategory(data: CategoryForm) {
    setSaving(true)
    try {
      await api.post('/categories', { ...data, clientId })
      catForm.reset()
      setShowAddCategory(false)
      await loadData()
      toast.success('Categoria criada')
    } catch {
      toast.error('Erro ao criar categoria')
    } finally {
      setSaving(false)
    }
  }

  async function addChannel(data: ChannelForm) {
    setSaving(true)
    try {
      await api.post('/channels', {
        ...data,
        clientId,
        categoryId: data.categoryId || undefined,
        logoUrl: data.logoUrl || undefined,
      })
      chForm.reset()
      setShowAddChannel(false)
      await loadData()
      toast.success('Canal adicionado')
    } catch {
      toast.error('Erro ao adicionar canal')
    } finally {
      setSaving(false)
    }
  }

  async function deleteChannel(id: string) {
    try {
      await api.delete(`/channels/${id}`)
      setChannels((prev) => prev.filter((c) => c.id !== id))
      toast.success('Canal removido')
    } catch {
      toast.error('Erro ao remover canal')
    }
  }

  const uncategorized = channels.filter((c) => !c.categoryId)
  const grouped = categories.map((cat) => ({
    category: cat,
    channels: channels.filter((c) => c.categoryId === cat.id),
  }))

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/clients/${clientId}/devices`} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-2xl font-bold text-white">Canais</h2>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowAddCategory(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
          >
            <FolderPlus size={15} />
            Categoria
          </button>
          <button
            onClick={() => setShowAddChannel(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Radio size={15} />
            Canal
          </button>
        </div>
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
              <ChannelList channels={catChannels} onDelete={deleteChannel} />
            </div>
          ))}

          {uncategorized.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Sem categoria
              </h3>
              <ChannelList channels={uncategorized} onDelete={deleteChannel} />
            </div>
          )}

          {channels.length === 0 && (
            <p className="text-gray-500 text-center py-12">Nenhum canal adicionado</p>
          )}
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Nova Categoria</h3>
            <form onSubmit={catForm.handleSubmit(addCategory)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Nome *</label>
                <input
                  {...catForm.register('name')}
                  placeholder="ex: Filmes, Esportes"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {catForm.formState.errors.name && (
                  <p className="text-red-400 text-xs mt-1">{catForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowAddCategory(false); catForm.reset() }} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">{saving ? 'Criando...' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Channel Modal */}
      {showAddChannel && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Novo Canal</h3>
            <form onSubmit={chForm.handleSubmit(addChannel)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Nome *</label>
                <input {...chForm.register('name')} placeholder="ex: TV Globo" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
                {chForm.formState.errors.name && <p className="text-red-400 text-xs mt-1">{chForm.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">URL do Stream *</label>
                <input {...chForm.register('url')} placeholder="https://stream.example.com/canal.m3u8" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
                {chForm.formState.errors.url && <p className="text-red-400 text-xs mt-1">{chForm.formState.errors.url.message}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Categoria</label>
                <select {...chForm.register('categoryId')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500">
                  <option value="">Sem categoria</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">URL do Logo</label>
                <input {...chForm.register('logoUrl')} placeholder="https://..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddChannel(false); chForm.reset() }} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">{saving ? 'Salvando...' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ChannelList({ channels, onDelete }: { channels: Channel[]; onDelete: (id: string) => void }) {
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
          <button
            onClick={() => onDelete(ch.id)}
            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
            title="Remover canal"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify channels page**

From a client's devices page, click "Canais" → should navigate to `/clients/:id/channels`.
Click "Categoria" → create modal → submit → category appears as group header.
Click "Canal" → form with category select populated → submit → channel appears under correct category.
Click trash icon → channel disappears.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/clients/
git commit -m "feat(web): channels + categories page per client — grouped list, add, delete"
```

---

## Self-review checklist

- [x] Route guard: unauthenticated users can't reach any dashboard page
- [x] All API endpoints used: `/plans`, `/clients`, `/clients/:id/suspend|activate`, `/devices/by-client/:id`, `/devices`, `/devices/:id/activation-code`, `/categories/by-client/:id`, `/categories`, `/channels/by-client/:id`, `/channels`, `/channels/:id`
- [x] Pagination on clients and devices tables (plans and categories are small arrays)
- [x] Credentials modal shown exactly once after client creation
- [x] Activation code modal shown per-generate with expiry time
- [x] Channels grouped by category with "Sem categoria" fallback
- [x] All forms use react-hook-form + zod (existing deps, no new installs)
- [x] Toast notifications on all success/error paths
- [x] Dark theme consistent with login page (gray-950/900/800 palette)
- [x] `cn` utility used for conditional classes
- [x] No new npm packages required
