# Subscriptions & Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build subscription lifecycle management (create, cancel, renew) and manual payment recording (PIX/credit card) — backend NestJS modules + frontend admin pages.

**Architecture:** Two new NestJS modules (`SubscriptionsModule`, `PaymentsModule`) consuming the existing Prisma schema (models already defined: `Subscription`, `Payment`, `SubscriptionStatus`, `PaymentMethod`, `PaymentStatus`). No Stripe — manual payment tracking via `reference` field. Frontend: one page per client at `/clients/:id/subscription` showing subscription status, dates, and payment history.

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL, Next.js 14 App Router, React 18, Tailwind CSS, react-hook-form, zod, sonner

---

## Existing schema (read before implementing)

Relevant Prisma models — already exist, **no migration needed**:

```prisma
enum SubscriptionStatus { active suspended cancelled past_due }
enum PaymentMethod { pix credit_card }
enum PaymentStatus { pending paid failed refunded }

model Subscription {
  id        String             @id @default(cuid())
  clientId  String             @unique       // one subscription per client
  planId    String
  status    SubscriptionStatus @default(active)
  startDate DateTime           @default(now())
  endDate   DateTime?
  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt
  client    Client   @relation(...)
  plan      Plan     @relation(...)
  payments  Payment[]
}

model Payment {
  id             String        @id @default(cuid())
  subscriptionId String
  amount         Decimal       @db.Decimal(10, 2)
  method         PaymentMethod
  status         PaymentStatus @default(pending)
  reference      String?       // PIX txid, credit card auth code, etc.
  paidAt         DateTime?
  createdAt      DateTime      @default(now())
  subscription   Subscription  @relation(...)
  commissions    ResellerCommission[]
}
```

## Existing patterns (follow these exactly)

- Service constructor: `constructor(private readonly prisma: PrismaService) {}`
- SELECT constant: `const THING_SELECT = { id: true, ... } as const`
- findOne guard: `if (!thing) throw new NotFoundException('Msg em português')`
- ConflictException for duplicate: `throw new ConflictException('Msg')`
- Pagination: `{ data, total, page, limit, totalPages: Math.ceil(total / limit) }`
- Auth guard on all controllers: `@UseGuards(JwtAuthGuard)`
- Test mock pattern: see `apps/api/src/clients/clients.service.spec.ts`
- Import enums from `@prisma/client`

## File map

**Backend — create:**
- `apps/api/src/subscriptions/dto/create-subscription.dto.ts`
- `apps/api/src/subscriptions/dto/activate-subscription.dto.ts`
- `apps/api/src/subscriptions/subscriptions.service.ts`
- `apps/api/src/subscriptions/subscriptions.controller.ts`
- `apps/api/src/subscriptions/subscriptions.module.ts`
- `apps/api/src/subscriptions/subscriptions.service.spec.ts`
- `apps/api/src/payments/dto/create-payment.dto.ts`
- `apps/api/src/payments/payments.service.ts`
- `apps/api/src/payments/payments.controller.ts`
- `apps/api/src/payments/payments.module.ts`
- `apps/api/src/payments/payments.service.spec.ts`

**Backend — modify:**
- `apps/api/src/app.module.ts` — add SubscriptionsModule + PaymentsModule

**Frontend — create:**
- `apps/web/src/app/(dashboard)/clients/[clientId]/subscription/page.tsx`

**Frontend — modify:**
- `apps/web/src/app/(dashboard)/clients/[clientId]/devices/page.tsx` — add "Assinatura" link

---

## Task 1: SubscriptionsModule (backend + TDD)

**Files:**
- Create: `apps/api/src/subscriptions/dto/create-subscription.dto.ts`
- Create: `apps/api/src/subscriptions/dto/activate-subscription.dto.ts`
- Create: `apps/api/src/subscriptions/subscriptions.service.ts`
- Create: `apps/api/src/subscriptions/subscriptions.controller.ts`
- Create: `apps/api/src/subscriptions/subscriptions.module.ts`
- Create: `apps/api/src/subscriptions/subscriptions.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

`apps/api/src/subscriptions/subscriptions.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { SubscriptionsService } from './subscriptions.service'
import { PrismaService } from '../prisma/prisma.service'
import { SubscriptionStatus } from '@prisma/client'

const mockPlan = { id: 'plan-1', name: 'Básico', type: 'basic', price: '99.90' }
const mockClient = { id: 'client-1', name: 'Empresa', email: 'e@test.com' }
const mockSubscription = {
  id: 'sub-1',
  clientId: 'client-1',
  planId: 'plan-1',
  status: SubscriptionStatus.active,
  startDate: new Date(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  plan: mockPlan,
}

describe('SubscriptionsService', () => {
  let service: SubscriptionsService
  let prisma: {
    subscription: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock }
    client: { findUnique: jest.Mock }
    plan: { findUnique: jest.Mock }
  }

  beforeEach(async () => {
    prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockSubscription),
        update: jest.fn().mockResolvedValue(mockSubscription),
      },
      client: { findUnique: jest.fn().mockResolvedValue(mockClient) },
      plan: { findUnique: jest.fn().mockResolvedValue(mockPlan) },
    }
    const module = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()
    service = module.get<SubscriptionsService>(SubscriptionsService)
  })

  it('create returns subscription with plan', async () => {
    const result = await service.create({ clientId: 'client-1', planId: 'plan-1' })
    expect(result.id).toBe('sub-1')
    expect(result.plan.id).toBe('plan-1')
  })

  it('create throws ConflictException if subscription exists', async () => {
    prisma.subscription.findUnique.mockResolvedValue(mockSubscription)
    await expect(service.create({ clientId: 'client-1', planId: 'plan-1' })).rejects.toThrow(ConflictException)
  })

  it('create throws NotFoundException if client not found', async () => {
    prisma.client.findUnique.mockResolvedValue(null)
    await expect(service.create({ clientId: 'bad', planId: 'plan-1' })).rejects.toThrow(NotFoundException)
  })

  it('create throws NotFoundException if plan not found', async () => {
    prisma.plan.findUnique.mockResolvedValue(null)
    await expect(service.create({ clientId: 'client-1', planId: 'bad' })).rejects.toThrow(NotFoundException)
  })

  it('findByClient returns subscription', async () => {
    prisma.subscription.findUnique.mockResolvedValue(mockSubscription)
    const result = await service.findByClient('client-1')
    expect(result.clientId).toBe('client-1')
  })

  it('findByClient throws NotFoundException if not found', async () => {
    await expect(service.findByClient('bad')).rejects.toThrow(NotFoundException)
  })

  it('cancel sets status to cancelled', async () => {
    prisma.subscription.findUnique.mockResolvedValue(mockSubscription)
    await service.cancel('sub-1')
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: SubscriptionStatus.cancelled }) }),
    )
  })

  it('cancel throws NotFoundException if not found', async () => {
    await expect(service.cancel('bad')).rejects.toThrow(NotFoundException)
  })

  it('activate sets status to active and updates endDate', async () => {
    prisma.subscription.findUnique.mockResolvedValue(mockSubscription)
    const endDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    await service.activate('sub-1', { endDate })
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: SubscriptionStatus.active }) }),
    )
  })

  it('activate throws NotFoundException if not found', async () => {
    await expect(service.activate('bad', { endDate: '2026-12-31' })).rejects.toThrow(NotFoundException)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/api && npx jest subscriptions.service.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module './subscriptions.service'`

- [ ] **Step 3: Create DTOs**

`apps/api/src/subscriptions/dto/create-subscription.dto.ts`:
```typescript
import { IsDateString, IsOptional, IsString } from 'class-validator'

export class CreateSubscriptionDto {
  @IsString()
  clientId: string

  @IsString()
  planId: string

  @IsDateString()
  @IsOptional()
  endDate?: string
}
```

`apps/api/src/subscriptions/dto/activate-subscription.dto.ts`:
```typescript
import { IsDateString } from 'class-validator'

export class ActivateSubscriptionDto {
  @IsDateString()
  endDate: string
}
```

- [ ] **Step 4: Create service**

`apps/api/src/subscriptions/subscriptions.service.ts`:
```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { SubscriptionStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ActivateSubscriptionDto } from './dto/activate-subscription.dto'
import { CreateSubscriptionDto } from './dto/create-subscription.dto'

const SUBSCRIPTION_SELECT = {
  id: true,
  clientId: true,
  planId: true,
  status: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
  plan: { select: { id: true, name: true, type: true, price: true } },
} as const

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubscriptionDto) {
    const exists = await this.prisma.subscription.findUnique({ where: { clientId: dto.clientId } })
    if (exists) throw new ConflictException('Cliente já possui assinatura')

    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } })
    if (!client) throw new NotFoundException('Cliente não encontrado')

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } })
    if (!plan) throw new NotFoundException('Plano não encontrado')

    return this.prisma.subscription.create({
      data: {
        clientId: dto.clientId,
        planId: dto.planId,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      select: SUBSCRIPTION_SELECT,
    })
  }

  async findByClient(clientId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { clientId },
      select: SUBSCRIPTION_SELECT,
    })
    if (!subscription) throw new NotFoundException('Assinatura não encontrada')
    return subscription
  }

  async cancel(id: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { id } })
    if (!subscription) throw new NotFoundException('Assinatura não encontrada')
    return this.prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.cancelled },
      select: SUBSCRIPTION_SELECT,
    })
  }

  async activate(id: string, dto: ActivateSubscriptionDto) {
    const subscription = await this.prisma.subscription.findUnique({ where: { id } })
    if (!subscription) throw new NotFoundException('Assinatura não encontrada')
    return this.prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.active, endDate: new Date(dto.endDate) },
      select: SUBSCRIPTION_SELECT,
    })
  }
}
```

- [ ] **Step 5: Run tests — verify all pass**

```bash
cd apps/api && npx jest subscriptions.service.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: 10 tests PASS

- [ ] **Step 6: Create controller and module**

`apps/api/src/subscriptions/subscriptions.controller.ts`:
```typescript
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ActivateSubscriptionDto } from './dto/activate-subscription.dto'
import { CreateSubscriptionDto } from './dto/create-subscription.dto'
import { SubscriptionsService } from './subscriptions.service'

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  create(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(dto)
  }

  @Get('by-client/:clientId')
  findByClient(@Param('clientId') clientId: string) {
    return this.subscriptionsService.findByClient(clientId)
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.subscriptionsService.cancel(id)
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string, @Body() dto: ActivateSubscriptionDto) {
    return this.subscriptionsService.activate(id, dto)
  }
}
```

`apps/api/src/subscriptions/subscriptions.module.ts`:
```typescript
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { SubscriptionsController } from './subscriptions.controller'
import { SubscriptionsService } from './subscriptions.service'

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
```

- [ ] **Step 7: Run all tests to confirm nothing broken**

```bash
cd apps/api && pnpm test 2>&1 | tail -8
```

Expected: all existing 42 tests + 10 new = 52 tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/subscriptions/
git commit -m "feat(api): subscriptions module — create, findByClient, cancel, activate"
```

---

## Task 2: PaymentsModule (backend + TDD)

**Files:**
- Create: `apps/api/src/payments/dto/create-payment.dto.ts`
- Create: `apps/api/src/payments/payments.service.ts`
- Create: `apps/api/src/payments/payments.controller.ts`
- Create: `apps/api/src/payments/payments.module.ts`
- Create: `apps/api/src/payments/payments.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

`apps/api/src/payments/payments.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { PaymentsService } from './payments.service'
import { PrismaService } from '../prisma/prisma.service'
import { PaymentMethod, PaymentStatus, SubscriptionStatus } from '@prisma/client'

const mockSubscription = {
  id: 'sub-1',
  clientId: 'client-1',
  status: SubscriptionStatus.past_due,
}

const mockPayment = {
  id: 'pay-1',
  subscriptionId: 'sub-1',
  amount: '99.90',
  method: PaymentMethod.pix,
  status: PaymentStatus.pending,
  reference: null,
  paidAt: null,
  createdAt: new Date(),
}

const confirmedPayment = { ...mockPayment, status: PaymentStatus.paid, paidAt: new Date() }

describe('PaymentsService', () => {
  let service: PaymentsService
  let prisma: {
    payment: {
      create: jest.Mock
      findMany: jest.Mock
      count: jest.Mock
      findUnique: jest.Mock
      update: jest.Mock
    }
    subscription: {
      findUnique: jest.Mock
      update: jest.Mock
    }
  }

  beforeEach(async () => {
    prisma = {
      payment: {
        create: jest.fn().mockResolvedValue(mockPayment),
        findMany: jest.fn().mockResolvedValue([mockPayment]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(confirmedPayment),
      },
      subscription: {
        findUnique: jest.fn().mockResolvedValue(mockSubscription),
        update: jest.fn().mockResolvedValue({ ...mockSubscription, status: SubscriptionStatus.active }),
      },
    }
    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()
    service = module.get<PaymentsService>(PaymentsService)
  })

  it('create returns payment with pending status', async () => {
    const result = await service.create({
      subscriptionId: 'sub-1',
      amount: '99.90',
      method: PaymentMethod.pix,
    })
    expect(result.id).toBe('pay-1')
    expect(result.status).toBe(PaymentStatus.pending)
  })

  it('create throws NotFoundException if subscription not found', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null)
    await expect(service.create({
      subscriptionId: 'bad',
      amount: '99.90',
      method: PaymentMethod.pix,
    })).rejects.toThrow(NotFoundException)
  })

  it('findBySubscription returns paginated payments', async () => {
    const result = await service.findBySubscription('sub-1', { page: 1, limit: 20 })
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
    expect(result.totalPages).toBe(1)
  })

  it('findBySubscription data contains correct subscriptionId', async () => {
    const result = await service.findBySubscription('sub-1', { page: 1, limit: 20 })
    expect(result.data[0].subscriptionId).toBe('sub-1')
  })

  it('confirm sets status to paid and paidAt', async () => {
    prisma.payment.findUnique.mockResolvedValue(mockPayment)
    const result = await service.confirm('pay-1')
    expect(result.status).toBe(PaymentStatus.paid)
    expect(result.paidAt).not.toBeNull()
  })

  it('confirm activates subscription', async () => {
    prisma.payment.findUnique.mockResolvedValue(mockPayment)
    await service.confirm('pay-1')
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SubscriptionStatus.active }),
      }),
    )
  })

  it('confirm throws NotFoundException if payment not found', async () => {
    await expect(service.confirm('bad')).rejects.toThrow(NotFoundException)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/api && npx jest payments.service.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module './payments.service'`

- [ ] **Step 3: Create DTO**

`apps/api/src/payments/dto/create-payment.dto.ts`:
```typescript
import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator'
import { PaymentMethod } from '@prisma/client'

export class CreatePaymentDto {
  @IsString()
  subscriptionId: string

  @IsNumberString()
  amount: string

  @IsEnum(PaymentMethod)
  method: PaymentMethod

  @IsString()
  @IsOptional()
  reference?: string
}
```

- [ ] **Step 4: Create service**

`apps/api/src/payments/payments.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common'
import { PaymentStatus, SubscriptionStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePaymentDto } from './dto/create-payment.dto'

const PAYMENT_SELECT = {
  id: true,
  subscriptionId: true,
  amount: true,
  method: true,
  status: true,
  reference: true,
  paidAt: true,
  createdAt: true,
} as const

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaymentDto) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: dto.subscriptionId },
    })
    if (!subscription) throw new NotFoundException('Assinatura não encontrada')

    return this.prisma.payment.create({
      data: {
        subscriptionId: dto.subscriptionId,
        amount: dto.amount,
        method: dto.method,
        reference: dto.reference,
      },
      select: PAYMENT_SELECT,
    })
  }

  async findBySubscription(
    subscriptionId: string,
    { page = 1, limit = 20 }: { page: number; limit: number },
  ) {
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { subscriptionId },
        skip,
        take: limit,
        select: PAYMENT_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where: { subscriptionId } }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async confirm(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } })
    if (!payment) throw new NotFoundException('Pagamento não encontrado')

    const confirmed = await this.prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.paid, paidAt: new Date() },
      select: PAYMENT_SELECT,
    })

    await this.prisma.subscription.update({
      where: { id: payment.subscriptionId },
      data: { status: SubscriptionStatus.active },
    })

    return confirmed
  }
}
```

- [ ] **Step 5: Run tests — verify all pass**

```bash
cd apps/api && npx jest payments.service.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: 7 tests PASS

- [ ] **Step 6: Create controller and module**

`apps/api/src/payments/payments.controller.ts`:
```typescript
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CreatePaymentDto } from './dto/create-payment.dto'
import { PaymentsService } from './payments.service'

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto)
  }

  @Get('by-subscription/:subscriptionId')
  findBySubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.paymentsService.findBySubscription(subscriptionId, { page, limit })
  }

  @Patch(':id/confirm')
  confirm(@Param('id') id: string) {
    return this.paymentsService.confirm(id)
  }
}
```

`apps/api/src/payments/payments.module.ts`:
```typescript
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
```

- [ ] **Step 7: Run all tests**

```bash
cd apps/api && pnpm test 2>&1 | tail -8
```

Expected: 42 + 10 + 7 = 59 tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/payments/
git commit -m "feat(api): payments module — create, findBySubscription, confirm"
```

---

## Task 3: Wire modules into app.module.ts

**Files:**
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Read current app.module.ts**

Read `apps/api/src/app.module.ts`. It currently imports 7 modules.

- [ ] **Step 2: Add SubscriptionsModule and PaymentsModule**

Replace `apps/api/src/app.module.ts` with:
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
  ],
})
export class AppModule {}
```

- [ ] **Step 3: Run all tests to confirm full suite passes**

```bash
cd apps/api && pnpm test 2>&1 | tail -8
```

Expected: 59 tests pass, 0 failures

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): register SubscriptionsModule and PaymentsModule in AppModule"
```

---

## Task 4: Frontend — Subscription page per client

**Files:**
- Create: `apps/web/src/app/(dashboard)/clients/[clientId]/subscription/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/clients/[clientId]/devices/page.tsx`

**API used in this page:**
- `GET /plans` → `Plan[]`
- `GET /subscriptions/by-client/:clientId` → Subscription (404 if none)
- `POST /subscriptions` → Subscription
- `PATCH /subscriptions/:id/cancel`
- `PATCH /subscriptions/:id/activate` → body: `{ endDate: string }`
- `GET /payments/by-subscription/:subscriptionId?page=1&limit=20` → paginated
- `POST /payments` → Payment
- `PATCH /payments/:id/confirm`

**Read these files before starting:**
- `apps/web/src/lib/api.ts` — axios instance
- `apps/web/src/lib/cn.ts` — cn utility
- `apps/web/src/app/(dashboard)/clients/[clientId]/devices/page.tsx` — to add Assinatura link

- [ ] **Step 1: Add "Assinatura" link to devices page header**

Read `apps/web/src/app/(dashboard)/clients/[clientId]/devices/page.tsx`. Find the header div that contains:
- Back arrow link `<Link href="/clients">`
- "Canais" link
- h2 "Dispositivos"
- "Novo Dispositivo" button

Add a "Assinatura" Link AFTER the "Canais" link and BEFORE the h2:

```tsx
<Link
  href={`/clients/${clientId}/subscription`}
  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
>
  Assinatura
</Link>
```

The order should be: `<ArrowLeft> <Canais link> <Assinatura link> <h2> <Novo Dispositivo button>`

- [ ] **Step 2: Create subscription page**

`apps/web/src/app/(dashboard)/clients/[clientId]/subscription/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, CreditCard, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface Plan {
  id: string
  name: string
  type: string
  price: string
}

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

interface Payment {
  id: string
  subscriptionId: string
  amount: string
  method: 'pix' | 'credit_card'
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  reference: string | null
  paidAt: string | null
  createdAt: string
}

interface PaginatedPayments {
  data: Payment[]
  total: number
  page: number
  totalPages: number
}

const createSubSchema = z.object({
  planId: z.string().min(1, 'Selecione um plano'),
  endDate: z.string().min(1, 'Data obrigatória'),
})

const activateSchema = z.object({
  endDate: z.string().min(1, 'Data obrigatória'),
})

const paymentSchema = z.object({
  amount: z.string().min(1, 'Obrigatório'),
  method: z.enum(['pix', 'credit_card']),
  reference: z.string().optional(),
})

type CreateSubForm = z.infer<typeof createSubSchema>
type ActivateForm = z.infer<typeof activateSchema>
type PaymentForm = z.infer<typeof paymentSchema>

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

const PAYMENT_STATUS_LABELS: Record<Payment['status'], string> = {
  pending: 'Pendente',
  paid: 'Pago',
  failed: 'Falhou',
  refunded: 'Estornado',
}

const PAYMENT_STATUS_COLORS: Record<Payment['status'], string> = {
  pending: 'bg-yellow-900/40 text-yellow-400',
  paid: 'bg-emerald-900/40 text-emerald-400',
  failed: 'bg-red-900/40 text-red-400',
  refunded: 'bg-gray-800 text-gray-400',
}

export default function SubscriptionPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [payments, setPayments] = useState<PaginatedPayments | null>(null)
  const [loading, setLoading] = useState(true)
  const [payPage, setPayPage] = useState(1)

  const [showCreate, setShowCreate] = useState(false)
  const [showActivate, setShowActivate] = useState(false)
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [saving, setSaving] = useState(false)

  const createForm = useForm<CreateSubForm>({ resolver: zodResolver(createSubSchema) })
  const activateForm = useForm<ActivateForm>({ resolver: zodResolver(activateSchema) })
  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { method: 'pix' },
  })

  async function loadSubscription() {
    try {
      const r = await api.get<Subscription>(`/subscriptions/by-client/${clientId}`)
      setSubscription(r.data)
      setNotFound(false)
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setNotFound(true)
        setSubscription(null)
      } else {
        toast.error('Erro ao carregar assinatura')
      }
    }
  }

  async function loadPayments(sub: Subscription, p = 1) {
    try {
      const r = await api.get<PaginatedPayments>(
        `/payments/by-subscription/${sub.id}?page=${p}&limit=10`,
      )
      setPayments(r.data)
      setPayPage(p)
    } catch {
      toast.error('Erro ao carregar pagamentos')
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true)
      const [plansRes] = await Promise.all([
        api.get<Plan[]>('/plans').catch(() => ({ data: [] as Plan[] })),
        loadSubscription(),
      ])
      setPlans(plansRes.data)
      setLoading(false)
    }
    init()
  }, [clientId])

  useEffect(() => {
    if (subscription) {
      loadPayments(subscription)
    }
  }, [subscription?.id])

  async function handleCreate(data: CreateSubForm) {
    setSaving(true)
    try {
      await api.post('/subscriptions', { ...data, clientId })
      setShowCreate(false)
      createForm.reset()
      await loadSubscription()
      toast.success('Assinatura criada')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao criar assinatura')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    if (!subscription) return
    setSaving(true)
    try {
      await api.patch(`/subscriptions/${subscription.id}/cancel`)
      await loadSubscription()
      toast.success('Assinatura cancelada')
    } catch {
      toast.error('Erro ao cancelar assinatura')
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate(data: ActivateForm) {
    if (!subscription) return
    setSaving(true)
    try {
      await api.patch(`/subscriptions/${subscription.id}/activate`, { endDate: data.endDate })
      setShowActivate(false)
      activateForm.reset()
      await loadSubscription()
      toast.success('Assinatura ativada')
    } catch {
      toast.error('Erro ao ativar assinatura')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddPayment(data: PaymentForm) {
    if (!subscription) return
    setSaving(true)
    try {
      await api.post('/payments', {
        subscriptionId: subscription.id,
        amount: data.amount,
        method: data.method,
        reference: data.reference || undefined,
      })
      setShowAddPayment(false)
      paymentForm.reset({ method: 'pix' })
      await loadPayments(subscription, payPage)
      toast.success('Pagamento registrado')
    } catch {
      toast.error('Erro ao registrar pagamento')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmPayment(paymentId: string) {
    if (!subscription) return
    try {
      await api.patch(`/payments/${paymentId}/confirm`)
      await Promise.all([loadSubscription(), loadPayments(subscription, payPage)])
      toast.success('Pagamento confirmado')
    } catch {
      toast.error('Erro ao confirmar pagamento')
    }
  }

  if (loading) return <p className="text-gray-400">Carregando...</p>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/clients/${clientId}/devices`} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-2xl font-bold text-white">Assinatura</h2>
      </div>

      {/* No subscription state */}
      {notFound && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
          <CreditCard size={40} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400 mb-4">Este cliente não possui assinatura</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
          >
            Criar Assinatura
          </button>
        </div>
      )}

      {/* Subscription info */}
      {subscription && (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
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
                <div className="mt-3 text-sm text-gray-500 space-y-1">
                  <p>Início: {new Date(subscription.startDate).toLocaleDateString('pt-BR')}</p>
                  {subscription.endDate && (
                    <p>Vencimento: {new Date(subscription.endDate).toLocaleDateString('pt-BR')}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowActivate(true)}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  title="Ativar / Renovar"
                >
                  <RefreshCw size={14} />
                  Renovar
                </button>
                {subscription.status !== 'cancelled' && (
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-red-400 text-sm rounded-lg transition-colors disabled:opacity-50"
                    title="Cancelar assinatura"
                  >
                    <XCircle size={14} />
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Payments section */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">Pagamentos</h3>
            <button
              onClick={() => setShowAddPayment(true)}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
            >
              Registrar Pagamento
            </button>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Método</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Referência</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {payments?.data.map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-4 py-3 text-white font-medium">
                      R$ {Number(payment.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 uppercase text-xs">
                      {payment.method === 'pix' ? 'PIX' : 'Cartão'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-1 rounded-full', PAYMENT_STATUS_COLORS[payment.status])}>
                        {PAYMENT_STATUS_LABELS[payment.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                      {payment.reference ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(payment.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      {payment.status === 'pending' && (
                        <button
                          onClick={() => handleConfirmPayment(payment.id)}
                          className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-gray-800 rounded transition-colors"
                          title="Confirmar pagamento"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {payments?.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Nenhum pagamento registrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {payments && payments.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{payments.total} pagamentos</span>
              <div className="flex gap-2">
                <button disabled={payPage <= 1} onClick={() => loadPayments(subscription, payPage - 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Anterior</button>
                <span className="px-3 py-1">{payPage} / {payments.totalPages}</span>
                <button disabled={payPage >= payments.totalPages} onClick={() => loadPayments(subscription, payPage + 1)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40">Próximo</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Subscription Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Nova Assinatura</h3>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Plano *</label>
                <select
                  {...createForm.register('planId')}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Selecione...</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — R$ {Number(p.price).toFixed(2)}/mês
                    </option>
                  ))}
                </select>
                {createForm.formState.errors.planId && (
                  <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.planId.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Vencimento *</label>
                <input
                  {...createForm.register('endDate')}
                  type="date"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {createForm.formState.errors.endDate && (
                  <p className="text-red-400 text-xs mt-1">{createForm.formState.errors.endDate.message}</p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); createForm.reset() }} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">{saving ? 'Criando...' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activate / Renew Modal */}
      {showActivate && subscription && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Renovar Assinatura</h3>
            <form onSubmit={activateForm.handleSubmit(handleActivate)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Novo vencimento *</label>
                <input
                  {...activateForm.register('endDate')}
                  type="date"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {activateForm.formState.errors.endDate && (
                  <p className="text-red-400 text-xs mt-1">{activateForm.formState.errors.endDate.message}</p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowActivate(false); activateForm.reset() }} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50">{saving ? 'Salvando...' : 'Renovar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPayment && subscription && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Registrar Pagamento</h3>
            <form onSubmit={paymentForm.handleSubmit(handleAddPayment)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Valor (R$) *</label>
                <input
                  {...paymentForm.register('amount')}
                  placeholder="99.90"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {paymentForm.formState.errors.amount && (
                  <p className="text-red-400 text-xs mt-1">{paymentForm.formState.errors.amount.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Método *</label>
                <select
                  {...paymentForm.register('method')}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="pix">PIX</option>
                  <option value="credit_card">Cartão de Crédito</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Referência</label>
                <input
                  {...paymentForm.register('reference')}
                  placeholder="ID da transação, código PIX..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddPayment(false); paymentForm.reset({ method: 'pix' }) }} className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">{saving ? 'Salvando...' : 'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit 2>&1
```

Expected: 0 errors (Geist was fixed in a prior commit — this codebase is clean).

Fix any type errors before committing.

- [ ] **Step 4: Run backend tests to confirm no regression**

```bash
cd apps/api && pnpm test 2>&1 | tail -8
```

Expected: 59 tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/(dashboard)/clients/[clientId]/subscription/ apps/web/src/app/(dashboard)/clients/[clientId]/devices/page.tsx
git commit -m "feat(web): subscription page per client — status, renew, cancel, payments history"
```

---

## Self-review checklist

- [x] `Subscription` + `Payment` models exist in schema — no migration needed
- [x] `SubscriptionsService`: create (ConflictException if exists, NotFoundException for bad clientId/planId), findByClient, cancel, activate
- [x] `PaymentsService`: create (NotFoundException for bad subscriptionId), findBySubscription (paginated), confirm (marks paid + activates subscription)
- [x] Both modules exported and registered in AppModule
- [x] 17 new tests (10 subscriptions + 7 payments) — full TDD coverage
- [x] Frontend: 404 handled gracefully (shows "Criar Assinatura" button)
- [x] Frontend: status badge with 4 states (active/suspended/cancelled/past_due)
- [x] Frontend: Renovar modal uses date input for endDate
- [x] Frontend: payment table has Confirmar button only on `pending` payments
- [x] Frontend: "Assinatura" link added to devices page header
- [x] All forms use react-hook-form + zod
- [x] Toast on all success/error paths
- [x] Consistent dark theme (gray-950/900/800)
