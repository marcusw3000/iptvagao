# Resellers Module — Implementation Plan

**Date:** 2026-06-28  
**Branch:** `feature/resellers`  
**Tests before:** 59 passing  
**Tests after target:** 59 + ~18 new = ~77 passing

---

## Overview

Four tasks, executed in order. Each task ends with a passing `pnpm test` run and a commit.

```
Task 1 — ResellersService (TDD)
Task 2 — ResellersController + Module + AppModule registration
Task 3 — Update PaymentsService.confirm to auto-create commissions
Task 4 — Frontend: list page + detail page + sidebar link
```

All commands are run from `apps/api` unless stated otherwise.

---

## Task 1 — ResellersService (TDD)

### 1.1 Create branch

```bash
git checkout -b feature/resellers
```

### 1.2 Create DTOs

**`apps/api/src/resellers/dto/create-reseller.dto.ts`**

```typescript
import { IsEmail, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateResellerDto {
  @IsString()
  @MinLength(2)
  name: string

  @IsEmail()
  email: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPct?: number
}
```

**`apps/api/src/resellers/dto/create-withdrawal.dto.ts`**

```typescript
import { IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateWithdrawalDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number

  @IsOptional()
  @IsString()
  pixKey?: string
}
```

### 1.3 Write the spec FIRST (TDD — red phase)

**`apps/api/src/resellers/resellers.service.spec.ts`**

```typescript
import { Test } from '@nestjs/testing'
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common'
import { ResellersService } from './resellers.service'
import { PrismaService } from '../prisma/prisma.service'
import { WithdrawalStatus } from '@prisma/client'

const mockReseller = {
  id: 'res-1',
  name: 'Revendedor Teste',
  email: 'rev@test.com',
  commissionPct: '10.00',
  active: true,
  referralCode: 'ref-abc123',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockCommission = {
  id: 'comm-1',
  resellerId: 'res-1',
  paymentId: 'pay-1',
  amount: '9.99',
  paid: false,
  createdAt: new Date(),
}

const mockWithdrawal = {
  id: 'wd-1',
  resellerId: 'res-1',
  amount: '50.00',
  status: WithdrawalStatus.pending,
  pixKey: 'pix@test.com',
  processedAt: null,
  createdAt: new Date(),
}

describe('ResellersService', () => {
  let service: ResellersService
  let prisma: any

  beforeEach(async () => {
    prisma = {
      reseller: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([mockReseller]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue(mockReseller),
        update: jest.fn().mockResolvedValue(mockReseller),
      },
      resellerCommission: {
        findMany: jest.fn().mockResolvedValue([mockCommission]),
        count: jest.fn().mockResolvedValue(1),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: '100.00' } }),
      },
      resellerWithdrawal: {
        findMany: jest.fn().mockResolvedValue([mockWithdrawal]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue(mockWithdrawal),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(mockWithdrawal),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: '50.00' } }),
      },
      client: {
        count: jest.fn().mockResolvedValue(3),
      },
    }

    const module = await Test.createTestingModule({
      providers: [
        ResellersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()

    service = module.get<ResellersService>(ResellersService)
  })

  // ── create ─────────────────────────────────────────────────────────────────

  it('create returns new reseller', async () => {
    const result = await service.create({ name: 'Revendedor', email: 'rev@test.com' })
    expect(result.id).toBe('res-1')
    expect(result.email).toBe('rev@test.com')
  })

  it('create throws ConflictException if email already used', async () => {
    prisma.reseller.findUnique.mockResolvedValue(mockReseller)
    await expect(
      service.create({ name: 'X', email: 'rev@test.com' }),
    ).rejects.toThrow(ConflictException)
  })

  // ── findAll ────────────────────────────────────────────────────────────────

  it('findAll returns paginated result with clientCount', async () => {
    const result = await service.findAll({ page: 1, limit: 20 })
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
    expect(result.totalPages).toBe(1)
    expect(result.data[0]).toHaveProperty('clientCount')
  })

  // ── findOne ────────────────────────────────────────────────────────────────

  it('findOne returns reseller with stats', async () => {
    prisma.reseller.findUnique.mockResolvedValue(mockReseller)
    const result = await service.findOne('res-1')
    expect(result.id).toBe('res-1')
    expect(result).toHaveProperty('clientCount')
    expect(result).toHaveProperty('totalCommissions')
    expect(result).toHaveProperty('pendingWithdrawalAmount')
  })

  it('findOne throws NotFoundException for unknown id', async () => {
    await expect(service.findOne('bad')).rejects.toThrow(NotFoundException)
  })

  // ── suspend / activate ─────────────────────────────────────────────────────

  it('suspend sets active to false', async () => {
    prisma.reseller.findUnique.mockResolvedValue(mockReseller)
    await service.suspend('res-1')
    expect(prisma.reseller.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false } }),
    )
  })

  it('activate sets active to true', async () => {
    prisma.reseller.findUnique.mockResolvedValue(mockReseller)
    await service.activate('res-1')
    expect(prisma.reseller.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: true } }),
    )
  })

  it('suspend throws NotFoundException for unknown id', async () => {
    await expect(service.suspend('bad')).rejects.toThrow(NotFoundException)
  })

  // ── commissions ────────────────────────────────────────────────────────────

  it('findCommissions returns paginated commissions', async () => {
    prisma.reseller.findUnique.mockResolvedValue(mockReseller)
    const result = await service.findCommissions('res-1', { page: 1, limit: 20 })
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('findCommissions throws NotFoundException for unknown reseller', async () => {
    await expect(
      service.findCommissions('bad', { page: 1, limit: 20 }),
    ).rejects.toThrow(NotFoundException)
  })

  // ── withdrawals ────────────────────────────────────────────────────────────

  it('requestWithdrawal creates withdrawal', async () => {
    prisma.reseller.findUnique.mockResolvedValue(mockReseller)
    const result = await service.requestWithdrawal('res-1', { amount: 50, pixKey: 'pix@test.com' })
    expect(result.id).toBe('wd-1')
    expect(prisma.resellerWithdrawal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resellerId: 'res-1', status: WithdrawalStatus.pending }),
      }),
    )
  })

  it('requestWithdrawal throws NotFoundException for unknown reseller', async () => {
    await expect(
      service.requestWithdrawal('bad', { amount: 50 }),
    ).rejects.toThrow(NotFoundException)
  })

  it('findWithdrawals returns paginated withdrawals', async () => {
    prisma.reseller.findUnique.mockResolvedValue(mockReseller)
    const result = await service.findWithdrawals('res-1', { page: 1, limit: 20 })
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('approveWithdrawal sets status to approved and sets processedAt', async () => {
    prisma.reseller.findUnique.mockResolvedValue(mockReseller)
    prisma.resellerWithdrawal.findUnique.mockResolvedValue(mockWithdrawal)
    await service.approveWithdrawal('res-1', 'wd-1')
    expect(prisma.resellerWithdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WithdrawalStatus.approved,
          processedAt: expect.any(Date),
        }),
      }),
    )
  })

  it('rejectWithdrawal sets status to rejected', async () => {
    prisma.reseller.findUnique.mockResolvedValue(mockReseller)
    prisma.resellerWithdrawal.findUnique.mockResolvedValue(mockWithdrawal)
    await service.rejectWithdrawal('res-1', 'wd-1')
    expect(prisma.resellerWithdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: WithdrawalStatus.rejected }),
      }),
    )
  })

  it('approveWithdrawal throws NotFoundException for unknown withdrawal', async () => {
    prisma.reseller.findUnique.mockResolvedValue(mockReseller)
    await expect(service.approveWithdrawal('res-1', 'bad')).rejects.toThrow(NotFoundException)
  })

  it('rejectWithdrawal throws NotFoundException for unknown withdrawal', async () => {
    prisma.reseller.findUnique.mockResolvedValue(mockReseller)
    await expect(service.rejectWithdrawal('res-1', 'bad')).rejects.toThrow(NotFoundException)
  })
})
```

Run `pnpm test` from `apps/api` → tests **fail** (module doesn't exist yet). That is the expected red phase.

### 1.4 Implement ResellersService (green phase)

**`apps/api/src/resellers/resellers.service.ts`**

```typescript
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { WithdrawalStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateResellerDto } from './dto/create-reseller.dto'
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto'

const RESELLER_SELECT = {
  id: true,
  name: true,
  email: true,
  commissionPct: true,
  active: true,
  referralCode: true,
  createdAt: true,
  updatedAt: true,
} as const

const COMMISSION_SELECT = {
  id: true,
  resellerId: true,
  paymentId: true,
  amount: true,
  paid: true,
  createdAt: true,
} as const

const WITHDRAWAL_SELECT = {
  id: true,
  resellerId: true,
  amount: true,
  status: true,
  pixKey: true,
  processedAt: true,
  createdAt: true,
} as const

@Injectable()
export class ResellersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── helpers ────────────────────────────────────────────────────────────────

  private async assertReseller(id: string) {
    const reseller = await this.prisma.reseller.findUnique({ where: { id } })
    if (!reseller) throw new NotFoundException('Revendedor não encontrado')
    return reseller
  }

  private async assertWithdrawal(resellerId: string, withdrawalId: string) {
    const wd = await this.prisma.resellerWithdrawal.findUnique({
      where: { id: withdrawalId },
    })
    if (!wd || wd.resellerId !== resellerId)
      throw new NotFoundException('Saque não encontrado')
    return wd
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async create(dto: CreateResellerDto) {
    const exists = await this.prisma.reseller.findUnique({
      where: { email: dto.email },
    })
    if (exists) throw new ConflictException('Email já utilizado')

    return this.prisma.reseller.create({
      data: {
        name: dto.name,
        email: dto.email,
        ...(dto.commissionPct !== undefined && {
          commissionPct: dto.commissionPct,
        }),
      },
      select: RESELLER_SELECT,
    })
  }

  async findAll({ page = 1, limit = 20 }: { page: number; limit: number }) {
    const skip = (page - 1) * limit
    const [resellers, total] = await Promise.all([
      this.prisma.reseller.findMany({
        skip,
        take: limit,
        select: RESELLER_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reseller.count(),
    ])

    // attach client count for each reseller
    const data = await Promise.all(
      resellers.map(async (r) => {
        const clientCount = await this.prisma.client.count({
          where: { resellerId: r.id },
        })
        return { ...r, clientCount }
      }),
    )

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string) {
    const reseller = await this.prisma.reseller.findUnique({
      where: { id },
      select: RESELLER_SELECT,
    })
    if (!reseller) throw new NotFoundException('Revendedor não encontrado')

    const [clientCount, commissionsAgg, withdrawalsAgg] = await Promise.all([
      this.prisma.client.count({ where: { resellerId: id } }),
      this.prisma.resellerCommission.aggregate({
        where: { resellerId: id },
        _sum: { amount: true },
      }),
      this.prisma.resellerWithdrawal.aggregate({
        where: { resellerId: id, status: WithdrawalStatus.pending },
        _sum: { amount: true },
      }),
    ])

    return {
      ...reseller,
      clientCount,
      totalCommissions: commissionsAgg._sum.amount ?? '0',
      pendingWithdrawalAmount: withdrawalsAgg._sum.amount ?? '0',
    }
  }

  async suspend(id: string) {
    await this.assertReseller(id)
    return this.prisma.reseller.update({
      where: { id },
      data: { active: false },
      select: RESELLER_SELECT,
    })
  }

  async activate(id: string) {
    await this.assertReseller(id)
    return this.prisma.reseller.update({
      where: { id },
      data: { active: true },
      select: RESELLER_SELECT,
    })
  }

  // ── commissions ────────────────────────────────────────────────────────────

  async findCommissions(
    resellerId: string,
    { page = 1, limit = 20 }: { page: number; limit: number },
  ) {
    await this.assertReseller(resellerId)
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.resellerCommission.findMany({
        where: { resellerId },
        skip,
        take: limit,
        select: COMMISSION_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.resellerCommission.count({ where: { resellerId } }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  // ── withdrawals ────────────────────────────────────────────────────────────

  async requestWithdrawal(resellerId: string, dto: CreateWithdrawalDto) {
    await this.assertReseller(resellerId)
    return this.prisma.resellerWithdrawal.create({
      data: {
        resellerId,
        amount: dto.amount,
        status: WithdrawalStatus.pending,
        ...(dto.pixKey && { pixKey: dto.pixKey }),
      },
      select: WITHDRAWAL_SELECT,
    })
  }

  async findWithdrawals(
    resellerId: string,
    { page = 1, limit = 20 }: { page: number; limit: number },
  ) {
    await this.assertReseller(resellerId)
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.resellerWithdrawal.findMany({
        where: { resellerId },
        skip,
        take: limit,
        select: WITHDRAWAL_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.resellerWithdrawal.count({ where: { resellerId } }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async approveWithdrawal(resellerId: string, withdrawalId: string) {
    await this.assertReseller(resellerId)
    await this.assertWithdrawal(resellerId, withdrawalId)
    return this.prisma.resellerWithdrawal.update({
      where: { id: withdrawalId },
      data: { status: WithdrawalStatus.approved, processedAt: new Date() },
      select: WITHDRAWAL_SELECT,
    })
  }

  async rejectWithdrawal(resellerId: string, withdrawalId: string) {
    await this.assertReseller(resellerId)
    await this.assertWithdrawal(resellerId, withdrawalId)
    return this.prisma.resellerWithdrawal.update({
      where: { id: withdrawalId },
      data: { status: WithdrawalStatus.rejected },
      select: WITHDRAWAL_SELECT,
    })
  }
}
```

### 1.5 Run tests and commit

```bash
# from apps/api
pnpm test
```

All 59 + 18 new = 77 tests must pass.

```bash
git add apps/api/src/resellers/
git commit -m "feat(resellers): add ResellersService with full TDD coverage (18 tests)"
```

---

## Task 2 — ResellersController + Module + AppModule registration

### 2.1 Create controller

**`apps/api/src/resellers/resellers.controller.ts`**

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ResellersService } from './resellers.service'
import { CreateResellerDto } from './dto/create-reseller.dto'
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PaginationDto } from '../common/dto/pagination.dto'

@Controller('resellers')
@UseGuards(JwtAuthGuard)
export class ResellersController {
  constructor(private readonly resellersService: ResellersService) {}

  @Post()
  create(@Body() dto: CreateResellerDto) {
    return this.resellersService.create(dto)
  }

  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.resellersService.findAll({
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resellersService.findOne(id)
  }

  @Patch(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.resellersService.suspend(id)
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.resellersService.activate(id)
  }

  @Get(':id/commissions')
  findCommissions(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.resellersService.findCommissions(id, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
    })
  }

  @Post(':id/withdrawals')
  requestWithdrawal(
    @Param('id') id: string,
    @Body() dto: CreateWithdrawalDto,
  ) {
    return this.resellersService.requestWithdrawal(id, dto)
  }

  @Get(':id/withdrawals')
  findWithdrawals(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.resellersService.findWithdrawals(id, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
    })
  }

  @Patch(':id/withdrawals/:wid/approve')
  approveWithdrawal(@Param('id') id: string, @Param('wid') wid: string) {
    return this.resellersService.approveWithdrawal(id, wid)
  }

  @Patch(':id/withdrawals/:wid/reject')
  rejectWithdrawal(@Param('id') id: string, @Param('wid') wid: string) {
    return this.resellersService.rejectWithdrawal(id, wid)
  }
}
```

### 2.2 Create module

**`apps/api/src/resellers/resellers.module.ts`**

```typescript
import { Module } from '@nestjs/common'
import { ResellersController } from './resellers.controller'
import { ResellersService } from './resellers.service'

@Module({
  controllers: [ResellersController],
  providers: [ResellersService],
  exports: [ResellersService],
})
export class ResellersModule {}
```

### 2.3 Register in AppModule

**`apps/api/src/app.module.ts`** — add two lines:

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
import { ResellersModule } from './resellers/resellers.module'   // ADD

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
    ResellersModule,    // ADD
  ],
})
export class AppModule {}
```

### 2.4 Run tests and commit

```bash
pnpm test
```

All 77 tests still pass.

```bash
git add apps/api/src/resellers/resellers.controller.ts \
        apps/api/src/resellers/resellers.module.ts \
        apps/api/src/app.module.ts
git commit -m "feat(resellers): add ResellersController, ResellersModule and register in AppModule"
```

---

## Task 3 — Update PaymentsService.confirm to auto-create commissions

### 3.1 Understand what changes

The current `confirm(id)` in `payments.service.ts`:

1. Calls `prisma.payment.findUnique({ where: { id } })` — returns a flat payment.
2. Runs a `$transaction` to mark payment as paid and subscription as active.

New behaviour:

1. `findUnique` must include `subscription → client (select resellerId)` so we know which reseller to credit.
2. After the `$transaction`, if `resellerId` is non-null, create a `ResellerCommission` row.

### 3.2 Update `payments.service.ts`

Full file after the change:

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
    // Fetch payment including subscription→client to get resellerId
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        subscription: {
          include: {
            client: { select: { resellerId: true } },
          },
        },
      },
    })
    if (!payment) throw new NotFoundException('Pagamento não encontrado')

    const [confirmed] = await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id },
        data: { status: PaymentStatus.paid, paidAt: new Date() },
        select: PAYMENT_SELECT,
      }),
      this.prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: SubscriptionStatus.active },
      }),
    ])

    // Auto-create commission if client belongs to a reseller
    const resellerId = payment.subscription?.client?.resellerId ?? null
    if (resellerId) {
      const reseller = await this.prisma.reseller.findUnique({
        where: { id: resellerId },
      })
      if (reseller) {
        await this.prisma.resellerCommission.create({
          data: {
            resellerId: reseller.id,
            paymentId: id,
            amount: String(
              (Number(payment.amount) * Number(reseller.commissionPct)) / 100,
            ),
          },
        })
      }
    }

    return confirmed
  }
}
```

### 3.3 Update `payments.service.spec.ts`

Two changes required:

1. **`mockPayment`** must now include the nested `subscription.client.resellerId` shape that `findUnique` returns after the `include`.
2. Add **one new test** that verifies a commission is created when `resellerId` is non-null.

Full updated spec:

```typescript
import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { PaymentsService } from './payments.service'
import { PrismaService } from '../prisma/prisma.service'
import { PaymentMethod, PaymentStatus, SubscriptionStatus } from '@prisma/client'

// mockPayment now has the nested shape returned by findUnique(...include...)
const mockPayment = {
  id: 'pay-1',
  subscriptionId: 'sub-1',
  amount: '99.90',
  method: PaymentMethod.pix,
  status: PaymentStatus.pending,
  reference: null,
  paidAt: null,
  createdAt: new Date(),
  // nested include shape — resellerId null means no commission
  subscription: {
    client: { resellerId: null },
  },
}

const mockSubscription = {
  id: 'sub-1',
  clientId: 'client-1',
  status: SubscriptionStatus.past_due,
}

const confirmedPayment = { ...mockPayment, status: PaymentStatus.paid, paidAt: new Date() }

describe('PaymentsService', () => {
  let service: PaymentsService
  let prisma: any

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
        update: jest.fn().mockResolvedValue({
          ...mockSubscription,
          status: SubscriptionStatus.active,
        }),
      },
      reseller: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      resellerCommission: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(() =>
        Promise.resolve([confirmedPayment, { ...mockSubscription, status: SubscriptionStatus.active }]),
      ),
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
    await expect(
      service.create({ subscriptionId: 'bad', amount: '99.90', method: PaymentMethod.pix }),
    ).rejects.toThrow(NotFoundException)
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

  it('confirm does NOT create commission when resellerId is null', async () => {
    // mockPayment already has resellerId: null
    prisma.payment.findUnique.mockResolvedValue(mockPayment)
    await service.confirm('pay-1')
    expect(prisma.resellerCommission.create).not.toHaveBeenCalled()
  })

  it('confirm creates commission when client has resellerId', async () => {
    const paymentWithReseller = {
      ...mockPayment,
      subscription: { client: { resellerId: 'res-1' } },
    }
    prisma.payment.findUnique.mockResolvedValue(paymentWithReseller)
    prisma.reseller.findUnique.mockResolvedValue({
      id: 'res-1',
      commissionPct: '10.00',
    })

    await service.confirm('pay-1')

    expect(prisma.resellerCommission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resellerId: 'res-1',
          paymentId: 'pay-1',
        }),
      }),
    )
  })
})
```

### 3.4 Run tests and commit

```bash
pnpm test
```

Expected: 77 + 2 new = 79 tests pass (one new "no commission" test + one "creates commission" test).

```bash
git add apps/api/src/payments/payments.service.ts \
        apps/api/src/payments/payments.service.spec.ts
git commit -m "feat(payments): auto-create ResellerCommission on payment confirm"
```

---

## Task 4 — Frontend

### 4.1 Add sidebar link

**`apps/web/src/components/sidebar.tsx`** — diff:

```diff
 import {
   Users,
   CreditCard,
   LayoutDashboard,
   LogOut,
+  UserCheck,
 } from 'lucide-react'

 const navItems = [
   { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
   { href: '/clients', label: 'Clientes', icon: Users },
   { href: '/plans', label: 'Planos', icon: CreditCard },
+  { href: '/resellers', label: 'Revendedores', icon: UserCheck },
 ]
```

Full file after the change:

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users,
  CreditCard,
  LayoutDashboard,
  LogOut,
  UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clientes', icon: Users },
  { href: '/plans', label: 'Planos', icon: CreditCard },
  { href: '/resellers', label: 'Revendedores', icon: UserCheck },
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

### 4.2 Resellers list page

**`apps/web/src/app/(dashboard)/resellers/page.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { UserCheck, Ban, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface Reseller {
  id: string
  name: string
  email: string
  commissionPct: string
  active: boolean
  referralCode: string
  createdAt: string
  clientCount: number
}

interface PaginatedResellers {
  data: Reseller[]
  total: number
  page: number
  totalPages: number
}

const createSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  commissionPct: z.coerce
    .number()
    .min(0, 'Mínimo 0')
    .max(100, 'Máximo 100')
    .optional(),
})

type CreateForm = z.infer<typeof createSchema>

export default function ResellersPage() {
  const [result, setResult] = useState<PaginatedResellers | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [page, setPage] = useState(1)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema) })

  function loadResellers(p = 1) {
    setLoading(true)
    api
      .get<PaginatedResellers>(`/resellers?page=${p}&limit=20`)
      .then((r) => {
        setResult(r.data)
        setPage(p)
      })
      .catch(() => toast.error('Erro ao carregar revendedores'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadResellers()
  }, [])

  async function onSubmit(data: CreateForm) {
    setCreating(true)
    try {
      await api.post('/resellers', data)
      setShowCreate(false)
      reset()
      loadResellers(page)
      toast.success('Revendedor criado com sucesso')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao criar revendedor')
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(reseller: Reseller) {
    try {
      const endpoint = reseller.active
        ? `/resellers/${reseller.id}/suspend`
        : `/resellers/${reseller.id}/activate`
      await api.patch(endpoint)
      loadResellers(page)
      toast.success(reseller.active ? 'Revendedor suspenso' : 'Revendedor ativado')
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Revendedores</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <UserCheck size={16} />
          Novo Revendedor
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
                  <th className="px-4 py-3 font-medium">Comissão</th>
                  <th className="px-4 py-3 font-medium">Clientes</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((reseller) => (
                  <tr
                    key={reseller.id}
                    className="border-b border-gray-800 last:border-0"
                  >
                    <td className="px-4 py-3 text-white font-medium">
                      <Link
                        href={`/resellers/${reseller.id}`}
                        className="hover:text-indigo-400 transition-colors"
                      >
                        {reseller.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{reseller.email}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {Number(reseller.commissionPct).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {reseller.clientCount}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-xs px-2 py-1 rounded-full',
                          reseller.active
                            ? 'bg-emerald-900/40 text-emerald-400'
                            : 'bg-red-900/40 text-red-400',
                        )}
                      >
                        {reseller.active ? 'Ativo' : 'Suspenso'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(reseller)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                        title={reseller.active ? 'Suspender' : 'Ativar'}
                      >
                        {reseller.active ? (
                          <Ban size={14} />
                        ) : (
                          <CheckCircle size={14} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Nenhum revendedor cadastrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result && result.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{result.total} revendedores</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => loadResellers(page - 1)}
                  className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="px-3 py-1">
                  {page} / {result.totalPages}
                </span>
                <button
                  disabled={page >= result.totalPages}
                  onClick={() => loadResellers(page + 1)}
                  className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
                >
                  Próximo
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Reseller Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">
              Novo Revendedor
            </h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Nome *
                </label>
                <input
                  {...register('name')}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {errors.name && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  {...register('email')}
                  type="email"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {errors.email && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Comissão (%) — padrão 10%
                </label>
                <input
                  {...register('commissionPct')}
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="10"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {errors.commissionPct && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.commissionPct.message}
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false)
                    reset()
                  }}
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
    </div>
  )
}
```

### 4.3 Reseller detail page

**`apps/web/src/app/(dashboard)/resellers/[resellerId]/page.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  DollarSign,
} from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

// ── Types ──────────────────────────────────────────────────────────────────

interface ResellerDetail {
  id: string
  name: string
  email: string
  commissionPct: string
  active: boolean
  referralCode: string
  clientCount: number
  totalCommissions: string
  pendingWithdrawalAmount: string
  createdAt: string
}

interface Commission {
  id: string
  paymentId: string
  amount: string
  paid: boolean
  createdAt: string
}

interface PaginatedCommissions {
  data: Commission[]
  total: number
  page: number
  totalPages: number
}

interface Withdrawal {
  id: string
  amount: string
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  pixKey: string | null
  processedAt: string | null
  createdAt: string
}

interface PaginatedWithdrawals {
  data: Withdrawal[]
  total: number
  page: number
  totalPages: number
}

// ── Constants ──────────────────────────────────────────────────────────────

const WITHDRAWAL_STATUS_LABELS: Record<Withdrawal['status'], string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  paid: 'Pago',
  rejected: 'Rejeitado',
}

const WITHDRAWAL_STATUS_COLORS: Record<Withdrawal['status'], string> = {
  pending: 'bg-yellow-900/40 text-yellow-400',
  approved: 'bg-blue-900/40 text-blue-400',
  paid: 'bg-emerald-900/40 text-emerald-400',
  rejected: 'bg-red-900/40 text-red-400',
}

// ── Withdrawal form schema ─────────────────────────────────────────────────

const withdrawalSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Valor mínimo R$ 0,01'),
  pixKey: z.string().optional(),
})

type WithdrawalForm = z.infer<typeof withdrawalSchema>

// ── Component ─────────────────────────────────────────────────────────────

type TabId = 'commissions' | 'withdrawals'

export default function ResellerDetailPage() {
  const params = useParams()
  const resellerId = params.resellerId as string

  const [reseller, setReseller] = useState<ResellerDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<TabId>('commissions')

  const [commissions, setCommissions] = useState<PaginatedCommissions | null>(null)
  const [commPage, setCommPage] = useState(1)

  const [withdrawals, setWithdrawals] = useState<PaginatedWithdrawals | null>(null)
  const [wdPage, setWdPage] = useState(1)

  const [showWithdrawal, setShowWithdrawal] = useState(false)
  const [saving, setSaving] = useState(false)

  const wdForm = useForm<WithdrawalForm>({
    resolver: zodResolver(withdrawalSchema),
  })

  // ── Data loading ──────────────────────────────────────────────────────────

  async function loadReseller() {
    try {
      const r = await api.get<ResellerDetail>(`/resellers/${resellerId}`)
      setReseller(r.data)
    } catch {
      toast.error('Erro ao carregar revendedor')
    }
  }

  async function loadCommissions(p = 1) {
    try {
      const r = await api.get<PaginatedCommissions>(
        `/resellers/${resellerId}/commissions?page=${p}&limit=20`,
      )
      setCommissions(r.data)
      setCommPage(p)
    } catch {
      toast.error('Erro ao carregar comissões')
    }
  }

  async function loadWithdrawals(p = 1) {
    try {
      const r = await api.get<PaginatedWithdrawals>(
        `/resellers/${resellerId}/withdrawals?page=${p}&limit=20`,
      )
      setWithdrawals(r.data)
      setWdPage(p)
    } catch {
      toast.error('Erro ao carregar saques')
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([loadReseller(), loadCommissions(), loadWithdrawals()])
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resellerId])

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleRequestWithdrawal(data: WithdrawalForm) {
    setSaving(true)
    try {
      await api.post(`/resellers/${resellerId}/withdrawals`, data)
      setShowWithdrawal(false)
      wdForm.reset()
      await Promise.all([loadReseller(), loadWithdrawals(wdPage)])
      toast.success('Solicitação de saque registrada')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao solicitar saque')
    } finally {
      setSaving(false)
    }
  }

  async function handleApproveWithdrawal(wdId: string) {
    try {
      await api.patch(`/resellers/${resellerId}/withdrawals/${wdId}/approve`)
      await Promise.all([loadReseller(), loadWithdrawals(wdPage)])
      toast.success('Saque aprovado')
    } catch {
      toast.error('Erro ao aprovar saque')
    }
  }

  async function handleRejectWithdrawal(wdId: string) {
    try {
      await api.patch(`/resellers/${resellerId}/withdrawals/${wdId}/reject`)
      await loadWithdrawals(wdPage)
      toast.success('Saque rejeitado')
    } catch {
      toast.error('Erro ao rejeitar saque')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <p className="text-gray-400">Carregando...</p>
  if (!reseller) return <p className="text-gray-400">Revendedor não encontrado</p>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/resellers"
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-white">{reseller.name}</h2>
          <p className="text-gray-500 text-sm">{reseller.email}</p>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Código de Indicação</p>
            <p className="text-white font-mono text-sm">{reseller.referralCode}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Comissão</p>
            <p className="text-white font-semibold">
              {Number(reseller.commissionPct).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Clientes</p>
            <p className="text-white font-semibold">{reseller.clientCount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Status</p>
            <span
              className={cn(
                'text-xs px-2 py-1 rounded-full',
                reseller.active
                  ? 'bg-emerald-900/40 text-emerald-400'
                  : 'bg-red-900/40 text-red-400',
              )}
            >
              {reseller.active ? 'Ativo' : 'Suspenso'}
            </span>
          </div>
        </div>
        <div className="mt-6 flex gap-6 border-t border-gray-800 pt-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Comissões Geradas</p>
            <p className="text-white font-semibold text-lg">
              R$ {Number(reseller.totalCommissions).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Saques Pendentes</p>
            <p className="text-yellow-400 font-semibold text-lg">
              R$ {Number(reseller.pendingWithdrawalAmount).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab('commissions')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'commissions'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white',
          )}
        >
          Comissoes
        </button>
        <button
          onClick={() => setActiveTab('withdrawals')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'withdrawals'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white',
          )}
        >
          Saques
        </button>

        {activeTab === 'withdrawals' && (
          <button
            onClick={() => setShowWithdrawal(true)}
            className="ml-auto flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
          >
            <DollarSign size={14} />
            Solicitar Saque
          </button>
        )}
      </div>

      {/* Commissions tab */}
      {activeTab === 'commissions' && (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">ID Pagamento</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Pago</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {commissions?.data.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-800 last:border-0"
                  >
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                      {c.paymentId}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">
                      R$ {Number(c.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-xs px-2 py-1 rounded-full',
                          c.paid
                            ? 'bg-emerald-900/40 text-emerald-400'
                            : 'bg-yellow-900/40 text-yellow-400',
                        )}
                      >
                        {c.paid ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
                {commissions?.data.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Nenhuma comissão registrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {commissions && commissions.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{commissions.total} comissões</span>
              <div className="flex gap-2">
                <button
                  disabled={commPage <= 1}
                  onClick={() => loadCommissions(commPage - 1)}
                  className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="px-3 py-1">
                  {commPage} / {commissions.totalPages}
                </span>
                <button
                  disabled={commPage >= commissions.totalPages}
                  onClick={() => loadCommissions(commPage + 1)}
                  className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
                >
                  Próximo
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Withdrawals tab */}
      {activeTab === 'withdrawals' && (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Chave PIX</th>
                  <th className="px-4 py-3 font-medium">Processado em</th>
                  <th className="px-4 py-3 font-medium">Solicitado em</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals?.data.map((wd) => (
                  <tr
                    key={wd.id}
                    className="border-b border-gray-800 last:border-0"
                  >
                    <td className="px-4 py-3 text-white font-medium">
                      R$ {Number(wd.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-xs px-2 py-1 rounded-full',
                          WITHDRAWAL_STATUS_COLORS[wd.status],
                        )}
                      >
                        {WITHDRAWAL_STATUS_LABELS[wd.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {wd.pixKey ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {wd.processedAt
                        ? new Date(wd.processedAt).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(wd.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      {wd.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleApproveWithdrawal(wd.id)}
                            className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-gray-800 rounded transition-colors"
                            title="Aprovar"
                          >
                            <CheckCircle size={14} />
                          </button>
                          <button
                            onClick={() => handleRejectWithdrawal(wd.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                            title="Rejeitar"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {withdrawals?.data.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Nenhum saque solicitado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {withdrawals && withdrawals.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>{withdrawals.total} saques</span>
              <div className="flex gap-2">
                <button
                  disabled={wdPage <= 1}
                  onClick={() => loadWithdrawals(wdPage - 1)}
                  className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="px-3 py-1">
                  {wdPage} / {withdrawals.totalPages}
                </span>
                <button
                  disabled={wdPage >= withdrawals.totalPages}
                  onClick={() => loadWithdrawals(wdPage + 1)}
                  className="px-3 py-1 bg-gray-800 rounded disabled:opacity-40"
                >
                  Próximo
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Request Withdrawal Modal */}
      {showWithdrawal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">
              Solicitar Saque
            </h3>
            <form
              onSubmit={wdForm.handleSubmit(handleRequestWithdrawal)}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Valor (R$) *
                </label>
                <input
                  {...wdForm.register('amount')}
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="50.00"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                {wdForm.formState.errors.amount && (
                  <p className="text-red-400 text-xs mt-1">
                    {wdForm.formState.errors.amount.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Chave PIX
                </label>
                <input
                  {...wdForm.register('pixKey')}
                  placeholder="CPF, email, telefone ou chave aleatória"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowWithdrawal(false)
                    wdForm.reset()
                  }}
                  className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Solicitando...' : 'Solicitar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
```

### 4.4 Commit frontend

```bash
git add apps/web/src/components/sidebar.tsx \
        apps/web/src/app/\(dashboard\)/resellers/
git commit -m "feat(web): add Resellers list page, detail page with tabs, sidebar link"
```

---

## Summary of all files

### Create

| File | Purpose |
|------|---------|
| `apps/api/src/resellers/dto/create-reseller.dto.ts` | DTO: name, email, optional commissionPct |
| `apps/api/src/resellers/dto/create-withdrawal.dto.ts` | DTO: amount, optional pixKey |
| `apps/api/src/resellers/resellers.service.ts` | Service: CRUD + suspend/activate + commissions + withdrawals |
| `apps/api/src/resellers/resellers.controller.ts` | Controller: 10 endpoints, all guarded by JwtAuthGuard |
| `apps/api/src/resellers/resellers.module.ts` | NestJS module |
| `apps/api/src/resellers/resellers.service.spec.ts` | 18 unit tests covering all methods |
| `apps/web/src/app/(dashboard)/resellers/page.tsx` | List page: table + pagination + create modal + suspend/activate |
| `apps/web/src/app/(dashboard)/resellers/[resellerId]/page.tsx` | Detail page: info card + tabs (Comissoes / Saques) + withdrawal request + approve/reject |

### Modify

| File | Change |
|------|--------|
| `apps/api/src/payments/payments.service.ts` | `confirm()` now includes `subscription→client.resellerId` and auto-creates commission |
| `apps/api/src/payments/payments.service.spec.ts` | `mockPayment` updated with nested shape; 2 new commission tests added |
| `apps/api/src/app.module.ts` | Import and register `ResellersModule` |
| `apps/web/src/components/sidebar.tsx` | Add `Revendedores` nav item with `UserCheck` icon |

---

## Test count progression

| After task | Expected passing |
|------------|-----------------|
| Before start | 59 |
| Task 1 (ResellersService) | 77 (+18) |
| Task 2 (controller + module) | 77 (no new tests) |
| Task 3 (payments commission) | 79 (+2) |
| Task 4 (frontend) | 79 (no new tests) |

---

## Commit log target

```
feat(web): add Resellers list page, detail page with tabs, sidebar link
feat(payments): auto-create ResellerCommission on payment confirm
feat(resellers): add ResellersController, ResellersModule and register in AppModule
feat(resellers): add ResellersService with full TDD coverage (18 tests)
```
