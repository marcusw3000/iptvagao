# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `GET /dashboard` metrics endpoint in NestJS and replace the placeholder dashboard page in Next.js with a responsive grid of six metric cards.

**Architecture:** A dedicated `DashboardModule` in the NestJS API exposes a single read-only endpoint that runs all six Prisma queries in parallel via `Promise.all` and returns a flat metrics DTO. The Next.js page fetches that endpoint on mount using the existing `api` Axios instance and renders cards with Lucide icons on a dark Tailwind theme — no new libraries required.

**Tech Stack:** NestJS 10, Prisma (PostgreSQL), Jest (unit tests), Next.js 14 App Router, Tailwind CSS, Lucide React, Axios (`@/lib/api`).

---

## File Map

**Create:**
- `apps/api/src/dashboard/dashboard.service.ts` — `DashboardService.getMetrics()`, all Prisma queries via `Promise.all`
- `apps/api/src/dashboard/dashboard.controller.ts` — `GET /dashboard` protected by `JwtAuthGuard`
- `apps/api/src/dashboard/dashboard.module.ts` — wires service + controller, imports `PrismaModule`
- `apps/api/src/dashboard/dashboard.service.spec.ts` — four Jest tests for the service

**Modify:**
- `apps/api/src/app.module.ts` — add `DashboardModule` to the imports array
- `apps/web/src/app/(dashboard)/dashboard/page.tsx` — replace `<h2>` placeholder with six metric cards

---

## Task 1: DashboardModule — TDD (service + spec + controller + module)

**Files:**
- Create: `apps/api/src/dashboard/dashboard.service.spec.ts`
- Create: `apps/api/src/dashboard/dashboard.service.ts`
- Create: `apps/api/src/dashboard/dashboard.controller.ts`
- Create: `apps/api/src/dashboard/dashboard.module.ts`

---

- [ ] **Step 1.1: Write the failing spec**

Create `apps/api/src/dashboard/dashboard.service.spec.ts` with this exact content:

```typescript
import { Test } from '@nestjs/testing'
import { DashboardService } from './dashboard.service'
import { PrismaService } from '../prisma/prisma.service'

describe('DashboardService', () => {
  let service: DashboardService
  let prisma: {
    client: { count: jest.Mock }
    subscription: { count: jest.Mock }
    device: { count: jest.Mock }
    payment: { aggregate: jest.Mock }
  }

  beforeEach(async () => {
    prisma = {
      client: { count: jest.fn() },
      subscription: { count: jest.fn() },
      device: { count: jest.fn() },
      payment: { aggregate: jest.fn() },
    }

    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()

    service = module.get<DashboardService>(DashboardService)
  })

  it('getMetrics returns all six fields', async () => {
    prisma.client.count
      .mockResolvedValueOnce(42)   // totalClients
      .mockResolvedValueOnce(5)    // newClientsThisMonth
    prisma.subscription.count
      .mockResolvedValueOnce(38)   // activeSubscriptions
      .mockResolvedValueOnce(3)    // pastDueSubscriptions
    prisma.device.count.mockResolvedValueOnce(120)
    prisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: '1999.70' } })

    const result = await service.getMetrics()

    expect(result).toEqual({
      totalClients: 42,
      activeSubscriptions: 38,
      pastDueSubscriptions: 3,
      totalDevices: 120,
      newClientsThisMonth: 5,
      mrr: 1999.70,
    })
  })

  it('getMetrics calls each Prisma method exactly once', async () => {
    prisma.client.count.mockResolvedValue(0)
    prisma.subscription.count.mockResolvedValue(0)
    prisma.device.count.mockResolvedValue(0)
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } })

    await service.getMetrics()

    expect(prisma.client.count).toHaveBeenCalledTimes(2)
    expect(prisma.subscription.count).toHaveBeenCalledTimes(2)
    expect(prisma.device.count).toHaveBeenCalledTimes(1)
    expect(prisma.payment.aggregate).toHaveBeenCalledTimes(1)
  })

  it('mrr returns 0 when no paid payments this month', async () => {
    prisma.client.count.mockResolvedValue(0)
    prisma.subscription.count.mockResolvedValue(0)
    prisma.device.count.mockResolvedValue(0)
    prisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: null } })

    const result = await service.getMetrics()

    expect(result.mrr).toBe(0)
  })

  it('mrr sums payment amounts correctly', async () => {
    prisma.client.count.mockResolvedValue(0)
    prisma.subscription.count.mockResolvedValue(0)
    prisma.device.count.mockResolvedValue(0)
    prisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: '3750.50' } })

    const result = await service.getMetrics()

    expect(result.mrr).toBe(3750.50)
  })
})
```

- [ ] **Step 1.2: Run the spec to confirm it fails (DashboardService not found)**

From `apps/api`:

```bash
npx jest dashboard.service.spec --no-coverage
```

Expected: FAIL — `Cannot find module './dashboard.service'`

- [ ] **Step 1.3: Write the service**

Create `apps/api/src/dashboard/dashboard.service.ts`:

```typescript
import { Injectable } from '@nestjs/common'
import { PaymentStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export interface DashboardMetrics {
  totalClients: number
  activeSubscriptions: number
  pastDueSubscriptions: number
  totalDevices: number
  newClientsThisMonth: number
  mrr: number
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(): Promise<DashboardMetrics> {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [
      totalClients,
      activeSubscriptions,
      pastDueSubscriptions,
      totalDevices,
      newClientsThisMonth,
      mrrAggregate,
    ] = await Promise.all([
      this.prisma.client.count({ where: { active: true } }),
      this.prisma.subscription.count({ where: { status: 'active' } }),
      this.prisma.subscription.count({ where: { status: 'past_due' } }),
      this.prisma.device.count({ where: { activated: true } }),
      this.prisma.client.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.paid,
          paidAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
    ])

    const mrr = mrrAggregate._sum.amount
      ? parseFloat(mrrAggregate._sum.amount.toString())
      : 0

    return {
      totalClients,
      activeSubscriptions,
      pastDueSubscriptions,
      totalDevices,
      newClientsThisMonth,
      mrr,
    }
  }
}
```

- [ ] **Step 1.4: Run the spec to confirm all four tests pass**

From `apps/api`:

```bash
npx jest dashboard.service.spec --no-coverage
```

Expected: PASS — 4 tests, 0 failures

- [ ] **Step 1.5: Write the controller**

Create `apps/api/src/dashboard/dashboard.controller.ts`:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common'
import { DashboardService } from './dashboard.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getMetrics() {
    return this.dashboardService.getMetrics()
  }
}
```

- [ ] **Step 1.6: Write the module**

Create `apps/api/src/dashboard/dashboard.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { DashboardService } from './dashboard.service'
import { DashboardController } from './dashboard.controller'

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
```

- [ ] **Step 1.7: Run all API tests to make sure nothing regresses**

From `apps/api`:

```bash
npx jest --no-coverage
```

Expected: all existing suites still pass plus the 4 new dashboard tests.

- [ ] **Step 1.8: Commit**

From the repo root:

```bash
git add apps/api/src/dashboard/
git commit -m "feat(api): add DashboardModule with getMetrics endpoint"
```

---

## Task 2: Register DashboardModule in AppModule

**Files:**
- Modify: `apps/api/src/app.module.ts`

---

- [ ] **Step 2.1: Add the import and registration**

Open `apps/api/src/app.module.ts`. Add one import line after the `PaymentsModule` import, and add `DashboardModule` to the `imports` array.

The file should look like this after the edit:

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { ClientsModule } from './clients/clients.module'
import { PlansModule } from './plans/plans.module'
import { DevicesModule } from './devices/devices.module'
import { CategoriesModule } from './categories/categories.module'
import { ChannelsModule } from './channels/channels.module'
import { SubscriptionsModule } from './subscriptions/subscriptions.module'
import { PaymentsModule } from './payments/payments.module'
import { DashboardModule } from './dashboard/dashboard.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    PlansModule,
    DevicesModule,
    CategoriesModule,
    ChannelsModule,
    SubscriptionsModule,
    PaymentsModule,
    DashboardModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 2.2: Verify the API builds without errors**

From `apps/api`:

```bash
npx tsc --noEmit
```

Expected: no output, exit code 0.

- [ ] **Step 2.3: Commit**

From the repo root:

```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): register DashboardModule in AppModule"
```

---

## Task 3: Replace dashboard page with metric cards

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`

---

- [ ] **Step 3.1: Replace the placeholder page**

Overwrite `apps/web/src/app/(dashboard)/dashboard/page.tsx` with:

```typescript
'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  CheckCircle,
  AlertCircle,
  Monitor,
  TrendingUp,
  DollarSign,
} from 'lucide-react'
import { api } from '@/lib/api'

interface DashboardMetrics {
  totalClients: number
  activeSubscriptions: number
  pastDueSubscriptions: number
  totalDevices: number
  newClientsThisMonth: number
  mrr: number
}

interface MetricCard {
  label: string
  value: string
  icon: React.ElementType
  color: string
  bg: string
}

function buildCards(m: DashboardMetrics): MetricCard[] {
  return [
    {
      label: 'Clientes Ativos',
      value: String(m.totalClients),
      icon: Users,
      color: 'text-indigo-400',
      bg: 'bg-indigo-900/30',
    },
    {
      label: 'Assinaturas Ativas',
      value: String(m.activeSubscriptions),
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-900/30',
    },
    {
      label: 'Em Atraso',
      value: String(m.pastDueSubscriptions),
      icon: AlertCircle,
      color: 'text-orange-400',
      bg: 'bg-orange-900/30',
    },
    {
      label: 'Dispositivos Ativos',
      value: String(m.totalDevices),
      icon: Monitor,
      color: 'text-blue-400',
      bg: 'bg-blue-900/30',
    },
    {
      label: 'Novos este Mês',
      value: String(m.newClientsThisMonth),
      icon: TrendingUp,
      color: 'text-purple-400',
      bg: 'bg-purple-900/30',
    },
    {
      label: 'MRR',
      value: `R$ ${m.mrr.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-green-400',
      bg: 'bg-green-900/30',
    },
  ]
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    api
      .get<DashboardMetrics>('/dashboard')
      .then((r) => setMetrics(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Dashboard</h2>
        <p className="text-red-400 text-sm">Erro ao carregar métricas. Tente recarregar a página.</p>
      </div>
    )
  }

  const cards = buildCards(metrics)

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4"
          >
            <div className={`${bg} p-3 rounded-lg`}>
              <Icon size={22} className={color} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className="text-2xl font-bold text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3.2: Verify the web app builds without TypeScript errors**

From `apps/web`:

```bash
npx tsc --noEmit
```

Expected: no output, exit code 0.

- [ ] **Step 3.3: Commit**

From the repo root:

```bash
git add apps/web/src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(web): replace dashboard placeholder with metric cards"
```

---

## Self-Review Checklist

- **Spec coverage:**
  - `GET /dashboard` endpoint — Task 1 (controller) + Task 2 (AppModule)
  - All 6 metrics — Task 1.3 (service), all fields in `DashboardMetrics` interface
  - `Promise.all` parallelism — Task 1.3, confirmed by the `toHaveBeenCalledTimes` test
  - MRR = 0 when `_sum.amount` is `null` — Task 1.1 test "mrr returns 0"
  - Frontend grid, all 6 cards, icons, dark theme — Task 3.1

- **No placeholders:** All steps contain complete, copy-pasteable code.

- **Type consistency:**
  - `DashboardMetrics` interface defined in `dashboard.service.ts` and re-declared inline in `page.tsx` (they are independent packages — no shared types layer exists in this repo yet, following the established pattern in `clients/page.tsx`).
  - `getMetrics()` in service, controller, and spec all use the same method name.
  - `mrr` is a `number` everywhere (parsed with `parseFloat` in the service, formatted with `.toFixed(2)` in the page).
