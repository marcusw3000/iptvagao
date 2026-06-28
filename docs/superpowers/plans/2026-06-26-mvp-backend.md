# MVP Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 5 core backend modules (Clients, Plans, Devices, Categories, Channels) that form the IPTV SaaS MVP.

**Architecture:** Each module follows the established NestJS pattern: DTO → Service (TDD spec first) → Controller → Module → register in AppModule. All controllers are protected by JwtAuthGuard. PrismaModule is @Global() — never import it per module.

**Tech Stack:** NestJS 10, Fastify, Prisma 5, class-validator, Jest + ts-jest, TypeScript 5

---

## Existing Patterns to Follow

Reference these files before starting each task:

- Service pattern: `apps/api/src/users/users.service.ts`
- Controller pattern: `apps/api/src/users/users.controller.ts`
- Module pattern: `apps/api/src/users/users.module.ts`
- Test pattern: `apps/api/src/auth/auth.service.spec.ts`
- PaginationDto: `apps/api/src/common/dto/pagination.dto.ts`
- JwtAuthGuard: `apps/api/src/auth/guards/jwt-auth.guard.ts`

---

## Task 1: Clients Module

**Files:**
- Create: `apps/api/src/clients/dto/create-client.dto.ts`
- Create: `apps/api/src/clients/dto/update-client.dto.ts`
- Create: `apps/api/src/clients/clients.service.spec.ts`
- Create: `apps/api/src/clients/clients.service.ts`
- Create: `apps/api/src/clients/clients.controller.ts`
- Create: `apps/api/src/clients/clients.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write DTOs**

`apps/api/src/clients/dto/create-client.dto.ts`:
```typescript
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class CreateClientDto {
  @IsString()
  @MinLength(2)
  name: string

  @IsEmail()
  email: string

  @IsString()
  @IsOptional()
  document?: string

  @IsString()
  @IsOptional()
  phone?: string

  @IsString()
  @IsOptional()
  resellerId?: string
}
```

`apps/api/src/clients/dto/update-client.dto.ts`:
```typescript
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator'

export class UpdateClientDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsEmail()
  @IsOptional()
  email?: string

  @IsString()
  @IsOptional()
  document?: string

  @IsString()
  @IsOptional()
  phone?: string

  @IsBoolean()
  @IsOptional()
  active?: boolean
}
```

- [ ] **Step 2: Write failing spec**

`apps/api/src/clients/clients.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { ClientsService } from './clients.service'
import { PrismaService } from '../prisma/prisma.service'
import { UsersService } from '../users/users.service'

const mockClient = {
  id: 'client-1',
  name: 'Empresa Teste',
  email: 'empresa@test.com',
  document: null,
  phone: null,
  active: true,
  resellerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('ClientsService', () => {
  let service: ClientsService
  let prisma: {
    client: {
      findUnique: jest.Mock
      create: jest.Mock
      update: jest.Mock
      findMany: jest.Mock
      count: jest.Mock
    }
  }
  let usersService: { generateClientCredentials: jest.Mock; create: jest.Mock }

  beforeEach(async () => {
    prisma = {
      client: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockClient),
        update: jest.fn().mockResolvedValue(mockClient),
        findMany: jest.fn().mockResolvedValue([mockClient]),
        count: jest.fn().mockResolvedValue(1),
      },
    }
    usersService = {
      generateClientCredentials: jest.fn().mockResolvedValue({ username: 'abcd', password: '123456' }),
      create: jest.fn().mockResolvedValue({ id: 'user-1', username: 'abcd', role: 'client_admin' }),
    }

    const module = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile()

    service = module.get<ClientsService>(ClientsService)
  })

  it('create returns client with generated credentials', async () => {
    const result = await service.create({ name: 'Empresa', email: 'e@test.com' })
    expect(result.client.id).toBe('client-1')
    expect(result.credentials.username).toBe('abcd')
    expect(result.credentials.password).toBe('123456')
  })

  it('create throws ConflictException if email taken', async () => {
    prisma.client.findUnique.mockResolvedValue(mockClient)
    await expect(service.create({ name: 'X', email: 'e@test.com' })).rejects.toThrow(ConflictException)
  })

  it('findAll returns paginated result', async () => {
    const result = await service.findAll({ page: 1, limit: 20 })
    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('total')
  })

  it('findOne throws NotFoundException for unknown id', async () => {
    prisma.client.findUnique.mockResolvedValue(null)
    await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException)
  })

  it('suspend sets active to false', async () => {
    prisma.client.findUnique.mockResolvedValue(mockClient)
    await service.suspend('client-1')
    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: 'client-1' },
      data: { active: false },
    })
  })
})
```

- [ ] **Step 3: Run spec — confirm FAIL**

```bash
cd apps/api && npx jest src/clients/clients.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './clients.service'`

- [ ] **Step 4: Write service**

`apps/api/src/clients/clients.service.ts`:
```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UsersService } from '../users/users.service'
import { CreateClientDto } from './dto/create-client.dto'
import { UpdateClientDto } from './dto/update-client.dto'

const CLIENT_SELECT = {
  id: true,
  name: true,
  email: true,
  document: true,
  phone: true,
  active: true,
  resellerId: true,
  createdAt: true,
  updatedAt: true,
} as const

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateClientDto) {
    const exists = await this.prisma.client.findUnique({ where: { email: dto.email } })
    if (exists) throw new ConflictException('Email já utilizado')

    const client = await this.prisma.client.create({
      data: dto,
      select: CLIENT_SELECT,
    })

    const credentials = await this.usersService.generateClientCredentials()
    await this.usersService.create({
      username: credentials.username,
      password: credentials.password,
      role: 'client_admin' as any,
      clientId: client.id,
    })

    return { client, credentials }
  }

  async findAll({ page = 1, limit = 20 }: { page: number; limit: number }) {
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        skip,
        take: limit,
        select: CLIENT_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.count(),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id }, select: CLIENT_SELECT })
    if (!client) throw new NotFoundException('Cliente não encontrado')
    return client
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id)
    return this.prisma.client.update({ where: { id }, data: dto, select: CLIENT_SELECT })
  }

  async suspend(id: string) {
    await this.findOne(id)
    return this.prisma.client.update({ where: { id }, data: { active: false } })
  }

  async activate(id: string) {
    await this.findOne(id)
    return this.prisma.client.update({ where: { id }, data: { active: true } })
  }
}
```

- [ ] **Step 5: Write controller + module**

`apps/api/src/clients/clients.controller.ts`:
```typescript
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ClientsService } from './clients.service'
import { CreateClientDto } from './dto/create-client.dto'
import { UpdateClientDto } from './dto/update-client.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PaginationDto } from '../common/dto/pagination.dto'

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto)
  }

  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.clientsService.findAll({ page: pagination.page ?? 1, limit: pagination.limit ?? 20 })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto)
  }

  @Patch(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.clientsService.suspend(id)
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.clientsService.activate(id)
  }
}
```

`apps/api/src/clients/clients.module.ts`:
```typescript
import { Module } from '@nestjs/common'
import { ClientsService } from './clients.service'
import { ClientsController } from './clients.controller'
import { UsersModule } from '../users/users.module'

@Module({
  imports: [UsersModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
```

- [ ] **Step 6: Update app.module.ts**

Add to imports array:
```typescript
import { ClientsModule } from './clients/clients.module'
// ...
ClientsModule,
```

- [ ] **Step 7: Run spec — confirm PASS**

```bash
cd apps/api && npx jest src/clients/clients.service.spec.ts --no-coverage
```

Expected: 5 tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/clients/ apps/api/src/app.module.ts
git commit -m "feat(api): clients module — CRUD, suspend/activate, auto-credential generation"
```

---

## Task 2: Plans Module

**Files:**
- Create: `apps/api/src/plans/plans.service.spec.ts`
- Create: `apps/api/src/plans/plans.service.ts`
- Create: `apps/api/src/plans/plans.controller.ts`
- Create: `apps/api/src/plans/plans.module.ts`
- Modify: `apps/api/src/app.module.ts`

No DTOs needed — read-only module.

- [ ] **Step 1: Write failing spec**

`apps/api/src/plans/plans.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { PlansService } from './plans.service'
import { PrismaService } from '../prisma/prisma.service'

const mockPlan = {
  id: 'plan-1',
  name: 'Básico',
  type: 'basic',
  price: '99.90',
  maxDevices: 5,
  storageGB: 10,
  maxChannels: 20,
  maxPlaylists: 5,
  maxUsers: 2,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('PlansService', () => {
  let service: PlansService
  let prisma: { plan: { findMany: jest.Mock; findUnique: jest.Mock } }

  beforeEach(async () => {
    prisma = {
      plan: {
        findMany: jest.fn().mockResolvedValue([mockPlan]),
        findUnique: jest.fn().mockResolvedValue(mockPlan),
      },
    }

    const module = await Test.createTestingModule({
      providers: [PlansService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<PlansService>(PlansService)
  })

  it('findAll returns active plans', async () => {
    const result = await service.findAll()
    expect(Array.isArray(result)).toBe(true)
    expect(result[0]).toHaveProperty('type')
  })

  it('findOne returns plan by id', async () => {
    const result = await service.findOne('plan-1')
    expect(result.id).toBe('plan-1')
  })

  it('findOne throws NotFoundException for unknown id', async () => {
    prisma.plan.findUnique.mockResolvedValue(null)
    await expect(service.findOne('bad')).rejects.toThrow(NotFoundException)
  })
})
```

- [ ] **Step 2: Run spec — confirm FAIL**

```bash
cd apps/api && npx jest src/plans/plans.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './plans.service'`

- [ ] **Step 3: Write service**

`apps/api/src/plans/plans.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
    })
  }

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } })
    if (!plan) throw new NotFoundException('Plano não encontrado')
    return plan
  }
}
```

- [ ] **Step 4: Write controller + module**

`apps/api/src/plans/plans.controller.ts`:
```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { PlansService } from './plans.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  findAll() {
    return this.plansService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.plansService.findOne(id)
  }
}
```

`apps/api/src/plans/plans.module.ts`:
```typescript
import { Module } from '@nestjs/common'
import { PlansService } from './plans.service'
import { PlansController } from './plans.controller'

@Module({
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
```

- [ ] **Step 5: Update app.module.ts**

Add to imports array:
```typescript
import { PlansModule } from './plans/plans.module'
// ...
PlansModule,
```

- [ ] **Step 6: Run spec — confirm PASS**

```bash
cd apps/api && npx jest src/plans/plans.service.spec.ts --no-coverage
```

Expected: 3 tests pass

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/plans/ apps/api/src/app.module.ts
git commit -m "feat(api): plans module — read-only endpoints"
```

---

## Task 3: Devices Module

**Files:**
- Create: `apps/api/src/devices/dto/create-device.dto.ts`
- Create: `apps/api/src/devices/devices.service.spec.ts`
- Create: `apps/api/src/devices/devices.service.ts`
- Create: `apps/api/src/devices/devices.controller.ts`
- Create: `apps/api/src/devices/devices.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write DTO**

`apps/api/src/devices/dto/create-device.dto.ts`:
```typescript
import { IsString, MinLength } from 'class-validator'

export class CreateDeviceDto {
  @IsString()
  clientId: string

  @IsString()
  @MinLength(2)
  name: string
}
```

- [ ] **Step 2: Write failing spec**

`apps/api/src/devices/devices.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { DevicesService } from './devices.service'
import { PrismaService } from '../prisma/prisma.service'

const mockDevice = {
  id: 'device-1',
  clientId: 'client-1',
  name: 'TV Recepção',
  activationCode: 'ABC123',
  activated: false,
  lastSeenAt: null,
  ipAddress: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('DevicesService', () => {
  let service: DevicesService
  let prisma: {
    device: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; count: jest.Mock }
    activationCode: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock }
  }

  beforeEach(async () => {
    prisma = {
      device: {
        create: jest.fn().mockResolvedValue(mockDevice),
        findMany: jest.fn().mockResolvedValue([mockDevice]),
        findUnique: jest.fn().mockResolvedValue(mockDevice),
        update: jest.fn().mockResolvedValue(mockDevice),
        count: jest.fn().mockResolvedValue(1),
      },
      activationCode: {
        create: jest.fn().mockResolvedValue({ id: 'ac-1', code: 'XY9Z12', expiresAt: new Date(Date.now() + 600_000) }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
    }

    const module = await Test.createTestingModule({
      providers: [DevicesService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<DevicesService>(DevicesService)
  })

  it('create returns device', async () => {
    const result = await service.create({ clientId: 'client-1', name: 'TV Sala' })
    expect(result.id).toBe('device-1')
    expect(prisma.device.create).toHaveBeenCalled()
  })

  it('findByClient returns paginated devices', async () => {
    const result = await service.findByClient('client-1', { page: 1, limit: 20 })
    expect(result).toHaveProperty('data')
    expect(result.data[0].clientId).toBe('client-1')
  })

  it('findOne throws NotFoundException for unknown device', async () => {
    prisma.device.findUnique.mockResolvedValue(null)
    await expect(service.findOne('bad')).rejects.toThrow(NotFoundException)
  })

  it('generateActivationCode creates code with expiry', async () => {
    prisma.device.findUnique.mockResolvedValue(mockDevice)
    const result = await service.generateActivationCode('device-1')
    expect(result).toHaveProperty('code')
    expect(result).toHaveProperty('expiresAt')
    expect(prisma.activationCode.create).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run spec — confirm FAIL**

```bash
cd apps/api && npx jest src/devices/devices.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './devices.service'`

- [ ] **Step 4: Write service**

`apps/api/src/devices/devices.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateDeviceDto } from './dto/create-device.dto'

const DEVICE_SELECT = {
  id: true,
  clientId: true,
  name: true,
  activationCode: true,
  activated: true,
  lastSeenAt: true,
  ipAddress: true,
  createdAt: true,
  updatedAt: true,
} as const

function generateCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDeviceDto) {
    const activationCode = generateCode(6)
    return this.prisma.device.create({
      data: { ...dto, activationCode },
      select: DEVICE_SELECT,
    })
  }

  async findByClient(clientId: string, { page = 1, limit = 20 }: { page: number; limit: number }) {
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.device.findMany({
        where: { clientId },
        skip,
        take: limit,
        select: DEVICE_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.device.count({ where: { clientId } }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id }, select: DEVICE_SELECT })
    if (!device) throw new NotFoundException('Dispositivo não encontrado')
    return device
  }

  async generateActivationCode(deviceId: string) {
    await this.findOne(deviceId)
    const code = generateCode(6)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    const ac = await this.prisma.activationCode.create({
      data: { code, deviceId, expiresAt },
    })
    return { code: ac.code, expiresAt: ac.expiresAt }
  }

  async activate(code: string, ipAddress?: string) {
    const ac = await this.prisma.activationCode.findUnique({ where: { code } })
    if (!ac || ac.usedAt || ac.expiresAt < new Date()) {
      throw new NotFoundException('Código inválido ou expirado')
    }
    await this.prisma.activationCode.update({ where: { id: ac.id }, data: { usedAt: new Date() } })
    if (ac.deviceId) {
      return this.prisma.device.update({
        where: { id: ac.deviceId },
        data: { activated: true, ipAddress: ipAddress ?? null, lastSeenAt: new Date() },
        select: DEVICE_SELECT,
      })
    }
    return { activated: true }
  }
}
```

- [ ] **Step 5: Write controller + module**

`apps/api/src/devices/devices.controller.ts`:
```typescript
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { DevicesService } from './devices.service'
import { CreateDeviceDto } from './dto/create-device.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PaginationDto } from '../common/dto/pagination.dto'

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  create(@Body() dto: CreateDeviceDto) {
    return this.devicesService.create(dto)
  }

  @Get('by-client/:clientId')
  findByClient(@Param('clientId') clientId: string, @Query() pagination: PaginationDto) {
    return this.devicesService.findByClient(clientId, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.devicesService.findOne(id)
  }

  @Post(':id/activation-code')
  generateActivationCode(@Param('id') id: string) {
    return this.devicesService.generateActivationCode(id)
  }
}

// Public endpoint — TV app calls this without auth
import { Controller as Ctrl } from '@nestjs/common'

@Ctrl('activate')
export class ActivateController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post(':code')
  activate(@Param('code') code: string) {
    return this.devicesService.activate(code)
  }
}
```

`apps/api/src/devices/devices.module.ts`:
```typescript
import { Module } from '@nestjs/common'
import { DevicesService } from './devices.service'
import { DevicesController, ActivateController } from './devices.controller'

@Module({
  controllers: [DevicesController, ActivateController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
```

- [ ] **Step 6: Update app.module.ts**

Add to imports array:
```typescript
import { DevicesModule } from './devices/devices.module'
// ...
DevicesModule,
```

- [ ] **Step 7: Run spec — confirm PASS**

```bash
cd apps/api && npx jest src/devices/devices.service.spec.ts --no-coverage
```

Expected: 4 tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/devices/ apps/api/src/app.module.ts
git commit -m "feat(api): devices module — CRUD, activation code generation, TV activation endpoint"
```

---

## Task 4: Categories Module

**Files:**
- Create: `apps/api/src/categories/dto/create-category.dto.ts`
- Create: `apps/api/src/categories/categories.service.spec.ts`
- Create: `apps/api/src/categories/categories.service.ts`
- Create: `apps/api/src/categories/categories.controller.ts`
- Create: `apps/api/src/categories/categories.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write DTO**

`apps/api/src/categories/dto/create-category.dto.ts`:
```typescript
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateCategoryDto {
  @IsString()
  clientId: string

  @IsString()
  @MinLength(1)
  name: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number
}
```

- [ ] **Step 2: Write failing spec**

`apps/api/src/categories/categories.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { CategoriesService } from './categories.service'
import { PrismaService } from '../prisma/prisma.service'

const mockCategory = {
  id: 'cat-1',
  clientId: 'client-1',
  name: 'Filmes',
  order: 0,
  createdAt: new Date(),
}

describe('CategoriesService', () => {
  let service: CategoriesService
  let prisma: {
    category: {
      create: jest.Mock
      findMany: jest.Mock
      findUnique: jest.Mock
      update: jest.Mock
      delete: jest.Mock
    }
  }

  beforeEach(async () => {
    prisma = {
      category: {
        create: jest.fn().mockResolvedValue(mockCategory),
        findMany: jest.fn().mockResolvedValue([mockCategory]),
        findUnique: jest.fn().mockResolvedValue(mockCategory),
        update: jest.fn().mockResolvedValue(mockCategory),
        delete: jest.fn().mockResolvedValue(mockCategory),
      },
    }

    const module = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<CategoriesService>(CategoriesService)
  })

  it('create returns new category', async () => {
    const result = await service.create({ clientId: 'client-1', name: 'Filmes' })
    expect(result.name).toBe('Filmes')
  })

  it('findByClient returns categories ordered by order', async () => {
    const result = await service.findByClient('client-1')
    expect(result[0].clientId).toBe('client-1')
  })

  it('findOne throws NotFoundException for unknown id', async () => {
    prisma.category.findUnique.mockResolvedValue(null)
    await expect(service.findOne('bad')).rejects.toThrow(NotFoundException)
  })

  it('remove deletes category', async () => {
    await service.remove('cat-1')
    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } })
  })
})
```

- [ ] **Step 3: Run spec — confirm FAIL**

```bash
cd apps/api && npx jest src/categories/categories.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './categories.service'`

- [ ] **Step 4: Write service**

`apps/api/src/categories/categories.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCategoryDto } from './dto/create-category.dto'

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: dto })
  }

  async findByClient(clientId: string) {
    return this.prisma.category.findMany({
      where: { clientId },
      orderBy: { order: 'asc' },
    })
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } })
    if (!category) throw new NotFoundException('Categoria não encontrada')
    return category
  }

  async update(id: string, data: Partial<{ name: string; order: number }>) {
    await this.findOne(id)
    return this.prisma.category.update({ where: { id }, data })
  }

  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.category.delete({ where: { id } })
  }
}
```

- [ ] **Step 5: Write controller + module**

`apps/api/src/categories/categories.controller.ts`:
```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { CategoriesService } from './categories.service'
import { CreateCategoryDto } from './dto/create-category.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto)
  }

  @Get('by-client/:clientId')
  findByClient(@Param('clientId') clientId: string) {
    return this.categoriesService.findByClient(clientId)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: { name?: string; order?: number }) {
    return this.categoriesService.update(id, data)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id)
  }
}
```

`apps/api/src/categories/categories.module.ts`:
```typescript
import { Module } from '@nestjs/common'
import { CategoriesService } from './categories.service'
import { CategoriesController } from './categories.controller'

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
```

- [ ] **Step 6: Update app.module.ts**

Add to imports array:
```typescript
import { CategoriesModule } from './categories/categories.module'
// ...
CategoriesModule,
```

- [ ] **Step 7: Run spec — confirm PASS**

```bash
cd apps/api && npx jest src/categories/categories.service.spec.ts --no-coverage
```

Expected: 4 tests pass

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/categories/ apps/api/src/app.module.ts
git commit -m "feat(api): categories module — CRUD per client"
```

---

## Task 5: Channels Module

**Files:**
- Create: `apps/api/src/channels/dto/create-channel.dto.ts`
- Create: `apps/api/src/channels/channels.service.spec.ts`
- Create: `apps/api/src/channels/channels.service.ts`
- Create: `apps/api/src/channels/channels.controller.ts`
- Create: `apps/api/src/channels/channels.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write DTO**

`apps/api/src/channels/dto/create-channel.dto.ts`:
```typescript
import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateChannelDto {
  @IsString()
  clientId: string

  @IsString()
  @IsOptional()
  categoryId?: string

  @IsString()
  @MinLength(1)
  name: string

  @IsString()
  url: string

  @IsString()
  @IsOptional()
  logoUrl?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number
}

export class UpdateChannelDto {
  @IsString()
  @IsOptional()
  categoryId?: string

  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  url?: string

  @IsString()
  @IsOptional()
  logoUrl?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number

  @IsBoolean()
  @IsOptional()
  active?: boolean
}
```

- [ ] **Step 2: Write failing spec**

`apps/api/src/channels/channels.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { ChannelsService } from './channels.service'
import { PrismaService } from '../prisma/prisma.service'

const mockChannel = {
  id: 'ch-1',
  clientId: 'client-1',
  categoryId: null,
  name: 'TV Globo',
  url: 'https://stream.example.com/globo.m3u8',
  logoUrl: null,
  order: 0,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('ChannelsService', () => {
  let service: ChannelsService
  let prisma: {
    channel: {
      create: jest.Mock
      findMany: jest.Mock
      findUnique: jest.Mock
      update: jest.Mock
      delete: jest.Mock
      count: jest.Mock
    }
  }

  beforeEach(async () => {
    prisma = {
      channel: {
        create: jest.fn().mockResolvedValue(mockChannel),
        findMany: jest.fn().mockResolvedValue([mockChannel]),
        findUnique: jest.fn().mockResolvedValue(mockChannel),
        update: jest.fn().mockResolvedValue(mockChannel),
        delete: jest.fn().mockResolvedValue(mockChannel),
        count: jest.fn().mockResolvedValue(1),
      },
    }

    const module = await Test.createTestingModule({
      providers: [ChannelsService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<ChannelsService>(ChannelsService)
  })

  it('create returns new channel', async () => {
    const result = await service.create({ clientId: 'client-1', name: 'TV Globo', url: 'https://s.test/x.m3u8' })
    expect(result.name).toBe('TV Globo')
  })

  it('findByClient returns paginated channels', async () => {
    const result = await service.findByClient('client-1', { page: 1, limit: 20 })
    expect(result).toHaveProperty('data')
    expect(result.data[0].clientId).toBe('client-1')
  })

  it('findOne throws NotFoundException for unknown id', async () => {
    prisma.channel.findUnique.mockResolvedValue(null)
    await expect(service.findOne('bad')).rejects.toThrow(NotFoundException)
  })

  it('remove deletes channel', async () => {
    await service.remove('ch-1')
    expect(prisma.channel.delete).toHaveBeenCalledWith({ where: { id: 'ch-1' } })
  })
})
```

- [ ] **Step 3: Run spec — confirm FAIL**

```bash
cd apps/api && npx jest src/channels/channels.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './channels.service'`

- [ ] **Step 4: Write service**

`apps/api/src/channels/channels.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateChannelDto, UpdateChannelDto } from './dto/create-channel.dto'

const CHANNEL_SELECT = {
  id: true,
  clientId: true,
  categoryId: true,
  name: true,
  url: true,
  logoUrl: true,
  order: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateChannelDto) {
    return this.prisma.channel.create({ data: dto, select: CHANNEL_SELECT })
  }

  async findByClient(clientId: string, { page = 1, limit = 20 }: { page: number; limit: number }) {
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.channel.findMany({
        where: { clientId },
        skip,
        take: limit,
        select: CHANNEL_SELECT,
        orderBy: { order: 'asc' },
      }),
      this.prisma.channel.count({ where: { clientId } }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id }, select: CHANNEL_SELECT })
    if (!channel) throw new NotFoundException('Canal não encontrado')
    return channel
  }

  async update(id: string, dto: UpdateChannelDto) {
    await this.findOne(id)
    return this.prisma.channel.update({ where: { id }, data: dto, select: CHANNEL_SELECT })
  }

  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.channel.delete({ where: { id } })
  }
}
```

- [ ] **Step 5: Write controller + module**

`apps/api/src/channels/channels.controller.ts`:
```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ChannelsService } from './channels.service'
import { CreateChannelDto, UpdateChannelDto } from './dto/create-channel.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PaginationDto } from '../common/dto/pagination.dto'

@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post()
  create(@Body() dto: CreateChannelDto) {
    return this.channelsService.create(dto)
  }

  @Get('by-client/:clientId')
  findByClient(@Param('clientId') clientId: string, @Query() pagination: PaginationDto) {
    return this.channelsService.findByClient(clientId, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.channelsService.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateChannelDto) {
    return this.channelsService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.channelsService.remove(id)
  }
}
```

`apps/api/src/channels/channels.module.ts`:
```typescript
import { Module } from '@nestjs/common'
import { ChannelsService } from './channels.service'
import { ChannelsController } from './channels.controller'

@Module({
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
```

- [ ] **Step 6: Update app.module.ts — final state**

`apps/api/src/app.module.ts` final state after all 5 tasks:
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
  ],
})
export class AppModule {}
```

- [ ] **Step 7: Run full test suite**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: All tests pass (existing auth/users + 4 new specs = 20+ tests green)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/channels/ apps/api/src/app.module.ts
git commit -m "feat(api): channels module — CRUD per client with category support"
```

---

## API Surface Summary

After all 5 tasks, the API exposes:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/clients` | ✅ | Create client + auto-credentials |
| GET | `/api/v1/clients` | ✅ | List clients (paginated) |
| GET | `/api/v1/clients/:id` | ✅ | Get client |
| PATCH | `/api/v1/clients/:id` | ✅ | Update client |
| PATCH | `/api/v1/clients/:id/suspend` | ✅ | Suspend client |
| PATCH | `/api/v1/clients/:id/activate` | ✅ | Activate client |
| GET | `/api/v1/plans` | ✅ | List active plans |
| GET | `/api/v1/plans/:id` | ✅ | Get plan |
| POST | `/api/v1/devices` | ✅ | Register device |
| GET | `/api/v1/devices/by-client/:clientId` | ✅ | List devices for client |
| GET | `/api/v1/devices/:id` | ✅ | Get device |
| POST | `/api/v1/devices/:id/activation-code` | ✅ | Generate activation code |
| POST | `/api/v1/activate/:code` | ❌ | TV activates itself (public) |
| POST | `/api/v1/categories` | ✅ | Create category |
| GET | `/api/v1/categories/by-client/:clientId` | ✅ | List categories for client |
| GET | `/api/v1/categories/:id` | ✅ | Get category |
| PATCH | `/api/v1/categories/:id` | ✅ | Update category |
| DELETE | `/api/v1/categories/:id` | ✅ | Delete category |
| POST | `/api/v1/channels` | ✅ | Create channel |
| GET | `/api/v1/channels/by-client/:clientId` | ✅ | List channels for client |
| GET | `/api/v1/channels/:id` | ✅ | Get channel |
| PATCH | `/api/v1/channels/:id` | ✅ | Update channel |
| DELETE | `/api/v1/channels/:id` | ✅ | Delete channel |
