# Base Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar fundação monorepo funcional com NestJS API + Next.js web + Prisma/Supabase rodando em dev local com autenticação JWT.

**Architecture:** Turborepo monorepo com pnpm workspaces. `apps/api` (NestJS) expõe REST + JWT auth. `apps/web` (Next.js 14 App Router) consome a API. `packages/shared` contém tipos TypeScript compartilhados. Prisma como ORM conectado ao Supabase PostgreSQL.

**Tech Stack:** pnpm 9, Turborepo, NestJS 10, Next.js 14, Prisma 5, Supabase PostgreSQL, Redis (ioredis), shadcn/ui, TailwindCSS, Zod, JWT (passport-jwt)

---

## File Map

```
iptvagao/
├── apps/
│   ├── api/                          # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── auth/
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── strategies/
│   │   │   │   │   └── jwt.strategy.ts
│   │   │   │   └── guards/
│   │   │   │       └── jwt-auth.guard.ts
│   │   │   ├── users/
│   │   │   │   ├── users.module.ts
│   │   │   │   ├── users.service.ts
│   │   │   │   └── users.controller.ts
│   │   │   ├── prisma/
│   │   │   │   ├── prisma.module.ts
│   │   │   │   └── prisma.service.ts
│   │   │   └── common/
│   │   │       └── dto/
│   │   │           └── pagination.dto.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── test/
│   │   │   └── auth.e2e-spec.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.example
│   └── web/                          # Next.js frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx
│       │   │   ├── (auth)/
│       │   │   │   └── login/
│       │   │   │       └── page.tsx
│       │   │   └── (dashboard)/
│       │   │       └── dashboard/
│       │   │           └── page.tsx
│       │   ├── lib/
│       │   │   ├── api.ts            # axios client
│       │   │   └── auth.ts           # session helpers
│       │   └── components/
│       │       └── ui/               # shadcn components
│       ├── package.json
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── .env.example
├── packages/
│   └── shared/                       # tipos compartilhados
│       ├── src/
│       │   ├── index.ts
│       │   └── types/
│       │       ├── user.ts
│       │       ├── auth.ts
│       │       └── api.ts
│       ├── package.json
│       └── tsconfig.json
├── package.json                      # root (workspaces)
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml
└── .env.example
```

---

### Task 1: Root Monorepo Foundation

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Criar package.json raiz**

```json
{
  "name": "iptvagao",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "db:generate": "turbo run db:generate",
    "db:migrate": "turbo run db:migrate"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

Salvar em: `package.json`

- [ ] **Step 2: Criar pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Salvar em: `pnpm-workspace.yaml`

- [ ] **Step 3: Criar turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

Salvar em: `turbo.json`

- [ ] **Step 4: Criar .env.example raiz**

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/iptvagao"

# JWT
JWT_SECRET="change-me-in-production-min-32-chars"
JWT_EXPIRES_IN="7d"

# Redis
REDIS_URL="redis://localhost:6379"

# API
API_PORT=3001
API_URL="http://localhost:3001"

# Web
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

Salvar em: `.env.example`

- [ ] **Step 5: Criar .gitignore**

```gitignore
# deps
node_modules/
.pnpm-store/

# build
dist/
.next/
out/

# env
.env
.env.local
.env.*.local

# turbo
.turbo/

# misc
*.log
.DS_Store
coverage/
```

Salvar em: `.gitignore`

- [ ] **Step 6: Criar docker-compose.yml para dev local**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: iptvagao
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

Salvar em: `docker-compose.yml`

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .env.example .gitignore docker-compose.yml
git commit -m "chore: monorepo foundation with turbo + pnpm workspaces"
```

---

### Task 2: Shared Types Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types/user.ts`
- Create: `packages/shared/src/types/auth.ts`
- Create: `packages/shared/src/types/api.ts`

- [ ] **Step 1: Criar package.json do shared**

```json
{
  "name": "@iptvagao/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

Salvar em: `packages/shared/package.json`

- [ ] **Step 2: Criar tsconfig.json do shared**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

Salvar em: `packages/shared/tsconfig.json`

- [ ] **Step 3: Criar tipos de usuário**

```typescript
// packages/shared/src/types/user.ts

export type UserRole = 'master_admin' | 'support' | 'financial' | 'client_admin' | 'client_user' | 'reseller'

export interface User {
  id: string
  email: string
  username: string
  role: UserRole
  clientId: string | null
  resellerId: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateUserDto {
  email: string
  username: string
  password: string
  role: UserRole
  clientId?: string
  resellerId?: string
}

export interface UpdateUserDto {
  email?: string
  username?: string
  password?: string
  active?: boolean
}
```

- [ ] **Step 4: Criar tipos de auth**

```typescript
// packages/shared/src/types/auth.ts

export interface LoginDto {
  username: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  expiresIn: number
}

export interface JwtPayload {
  sub: string
  username: string
  role: string
  clientId: string | null
  iat: number
  exp: number
}
```

- [ ] **Step 5: Criar tipos de API genéricos**

```typescript
// packages/shared/src/types/api.ts

export interface ApiResponse<T = unknown> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiError {
  statusCode: number
  message: string | string[]
  error: string
}
```

- [ ] **Step 6: Criar index.ts do shared**

```typescript
// packages/shared/src/index.ts

export * from './types/user'
export * from './types/auth'
export * from './types/api'
```

- [ ] **Step 7: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add shared TypeScript types for user, auth, and API"
```

---

### Task 3: NestJS API Scaffold

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/.env.example`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`

- [ ] **Step 1: Criar package.json do API**

```json
{
  "name": "@iptvagao/api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\"",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-fastify": "^10.3.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/config": "^3.2.0",
    "@nestjs/throttler": "^5.1.2",
    "@prisma/client": "^5.11.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "passport-local": "^1.0.0",
    "bcrypt": "^5.1.1",
    "ioredis": "^5.3.2",
    "class-validator": "^0.14.1",
    "class-transformer": "^0.5.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^3.23.0",
    "@iptvagao/shared": "workspace:*"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.2",
    "@nestjs/schematics": "^10.1.1",
    "@nestjs/testing": "^10.3.0",
    "@types/bcrypt": "^5.0.2",
    "@types/passport-jwt": "^4.0.1",
    "@types/passport-local": "^1.0.38",
    "@types/supertest": "^6.0.2",
    "supertest": "^6.3.4",
    "prisma": "^5.11.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 2: Criar tsconfig.json do API**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

- [ ] **Step 3: Criar tsconfig.build.json e nest-cli.json**

`apps/api/tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

`apps/api/nest-cli.json`:
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 4: Criar .env.example do API**

```env
NODE_ENV=development
PORT=3001

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/iptvagao"

JWT_SECRET="change-me-in-production-min-32-chars"
JWT_EXPIRES_IN="7d"

REDIS_URL="redis://localhost:6379"
```

Salvar em: `apps/api/.env.example` e copiar para `apps/api/.env`

- [ ] **Step 5: Criar main.ts**

```typescript
// apps/api/src/main.ts
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  )

  app.setGlobalPrefix('api/v1')

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.enableCors({
    origin: process.env.WEB_URL || 'http://localhost:3000',
    credentials: true,
  })

  const port = process.env.PORT || 3001
  await app.listen(port, '0.0.0.0')
  console.log(`API running on port ${port}`)
}

bootstrap()
```

- [ ] **Step 6: Criar app.module.ts**

```typescript
// apps/api/src/app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/
git commit -m "chore(api): NestJS scaffold with Fastify, config, throttler"
```

---

### Task 4: Prisma Module + Schema

**Files:**
- Create: `apps/api/src/prisma/prisma.module.ts`
- Create: `apps/api/src/prisma/prisma.service.ts`
- Create: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Criar PrismaService**

```typescript
// apps/api/src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
```

- [ ] **Step 2: Criar PrismaModule**

```typescript
// apps/api/src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 3: Criar schema.prisma com tabelas iniciais**

```prisma
// apps/api/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  master_admin
  support
  financial
  client_admin
  client_user
  reseller
}

enum PlanType {
  basic
  premium
}

enum SubscriptionStatus {
  active
  suspended
  cancelled
  past_due
}

enum PaymentMethod {
  pix
  credit_card
}

enum PaymentStatus {
  pending
  paid
  failed
  refunded
}

model Plan {
  id              String   @id @default(cuid())
  name            String
  type            PlanType @unique
  price           Decimal  @db.Decimal(10, 2)
  maxDevices      Int
  storageGB       Int
  maxChannels     Int
  maxPlaylists    Int
  maxUsers        Int
  active          Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  subscriptions Subscription[]

  @@map("plans")
}

model Client {
  id          String   @id @default(cuid())
  name        String
  email       String   @unique
  document    String?
  phone       String?
  active      Boolean  @default(true)
  resellerId  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  reseller      Reseller?      @relation(fields: [resellerId], references: [id])
  users         User[]
  subscription  Subscription?
  devices       Device[]
  channels      Channel[]
  playlists     Playlist[]
  videos        Video[]
  liveStreams    LiveStream[]
  alerts        Alert[]

  @@map("clients")
}

model Reseller {
  id              String   @id @default(cuid())
  name            String
  email           String   @unique
  commissionPct   Decimal  @default(10) @db.Decimal(5, 2)
  active          Boolean  @default(true)
  referralCode    String   @unique @default(cuid())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  clients     Client[]
  commissions ResellerCommission[]
  withdrawals ResellerWithdrawal[]
  user        User?

  @@map("resellers")
}

model ResellerCommission {
  id           String   @id @default(cuid())
  resellerId   String
  paymentId    String
  amount       Decimal  @db.Decimal(10, 2)
  paid         Boolean  @default(false)
  createdAt    DateTime @default(now())

  reseller Reseller @relation(fields: [resellerId], references: [id])
  payment  Payment  @relation(fields: [paymentId], references: [id])

  @@map("reseller_commissions")
}

model ResellerWithdrawal {
  id          String   @id @default(cuid())
  resellerId  String
  amount      Decimal  @db.Decimal(10, 2)
  status      String   @default("pending")
  pixKey      String?
  processedAt DateTime?
  createdAt   DateTime @default(now())

  reseller Reseller @relation(fields: [resellerId], references: [id])

  @@map("reseller_withdrawals")
}

model User {
  id          String   @id @default(cuid())
  email       String?  @unique
  username    String   @unique
  password    String
  role        UserRole @default(client_user)
  clientId    String?
  resellerId  String?
  active      Boolean  @default(true)
  lastLoginAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  client   Client?   @relation(fields: [clientId], references: [id])
  reseller Reseller? @relation(fields: [resellerId], references: [id])

  @@map("users")
}

model Subscription {
  id        String             @id @default(cuid())
  clientId  String             @unique
  planId    String
  status    SubscriptionStatus @default(active)
  startDate DateTime           @default(now())
  endDate   DateTime?
  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt

  client   Client    @relation(fields: [clientId], references: [id])
  plan     Plan      @relation(fields: [planId], references: [id])
  payments Payment[]

  @@map("subscriptions")
}

model Payment {
  id             String        @id @default(cuid())
  subscriptionId String
  amount         Decimal       @db.Decimal(10, 2)
  method         PaymentMethod
  status         PaymentStatus @default(pending)
  reference      String?
  paidAt         DateTime?
  createdAt      DateTime      @default(now())

  subscription Subscription         @relation(fields: [subscriptionId], references: [id])
  commissions  ResellerCommission[]

  @@map("payments")
}

model Device {
  id             String   @id @default(cuid())
  clientId       String
  name           String
  activationCode String   @unique
  activated      Boolean  @default(false)
  lastSeenAt     DateTime?
  ipAddress      String?
  userAgent      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  client Client @relation(fields: [clientId], references: [id])

  @@map("devices")
}

model ActivationCode {
  id        String   @id @default(cuid())
  code      String   @unique
  deviceId  String?
  usedAt    DateTime?
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@map("activation_codes")
}

model Category {
  id        String   @id @default(cuid())
  clientId  String
  name      String
  order     Int      @default(0)
  createdAt DateTime @default(now())

  channels  Channel[]
  playlists Playlist[]

  @@map("categories")
}

model Channel {
  id          String   @id @default(cuid())
  clientId    String
  categoryId  String?
  name        String
  url         String
  logoUrl     String?
  order       Int      @default(0)
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  client      Client    @relation(fields: [clientId], references: [id])
  category    Category? @relation(fields: [categoryId], references: [id])
  epgPrograms EpgProgram[]

  @@map("channels")
}

model Playlist {
  id          String   @id @default(cuid())
  clientId    String
  categoryId  String?
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  client   Client          @relation(fields: [clientId], references: [id])
  category Category?       @relation(fields: [categoryId], references: [id])
  items    PlaylistItem[]

  @@map("playlists")
}

model PlaylistItem {
  id         String   @id @default(cuid())
  playlistId String
  videoId    String?
  streamId   String?
  order      Int      @default(0)
  createdAt  DateTime @default(now())

  playlist Playlist    @relation(fields: [playlistId], references: [id])
  video    Video?      @relation(fields: [videoId], references: [id])
  stream   LiveStream? @relation(fields: [streamId], references: [id])

  @@map("playlist_items")
}

model Video {
  id         String   @id @default(cuid())
  clientId   String
  title      String
  url        String
  thumbnailUrl String?
  durationSec Int?
  sizeBytes  BigInt?
  mimeType   String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  client        Client         @relation(fields: [clientId], references: [id])
  playlistItems PlaylistItem[]

  @@map("videos")
}

model LiveStream {
  id        String   @id @default(cuid())
  clientId  String
  name      String
  url       String
  type      String   @default("hls")
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  client        Client         @relation(fields: [clientId], references: [id])
  playlistItems PlaylistItem[]

  @@map("live_streams")
}

model EpgProgram {
  id        String   @id @default(cuid())
  channelId String
  title     String
  startTime DateTime
  endTime   DateTime
  description String?
  createdAt DateTime @default(now())

  channel Channel @relation(fields: [channelId], references: [id])

  @@map("epg_programs")
}

model Alert {
  id        String   @id @default(cuid())
  clientId  String
  title     String
  message   String
  type      String   @default("info")
  active    Boolean  @default(true)
  startsAt  DateTime?
  endsAt    DateTime?
  createdAt DateTime @default(now())

  client Client @relation(fields: [clientId], references: [id])

  @@map("alerts")
}

model AnalyticsEvent {
  id        String   @id @default(cuid())
  clientId  String?
  deviceId  String?
  event     String
  payload   Json?
  createdAt DateTime @default(now())

  @@map("analytics_events")
}

model SystemLog {
  id        String   @id @default(cuid())
  level     String
  message   String
  context   String?
  payload   Json?
  createdAt DateTime @default(now())

  @@map("logs")
}
```

- [ ] **Step 4: Rodar migration inicial**

```bash
cd apps/api
cp .env.example .env
# docker-compose up -d postgres (se não estiver rodando)
npx prisma migrate dev --name init
```

Expected: `Your database is now in sync with your schema.`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/prisma/ apps/api/prisma/
git commit -m "feat(api): prisma module + full database schema (20 tables)"
```

---

### Task 5: Auth Module (JWT)

**Files:**
- Create: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/auth/auth.service.ts`
- Create: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/dto/login.dto.ts`
- Create: `apps/api/src/auth/strategies/jwt.strategy.ts`
- Create: `apps/api/src/auth/guards/jwt-auth.guard.ts`
- Create: `apps/api/src/auth/decorators/current-user.decorator.ts`
- Test: `apps/api/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Escrever testes do AuthService**

```typescript
// apps/api/src/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { PrismaService } from '../prisma/prisma.service'
import * as bcrypt from 'bcrypt'

const mockUser = {
  id: 'user-1',
  username: 'admin',
  password: '', // set in beforeEach
  role: 'master_admin',
  clientId: null,
  resellerId: null,
  active: true,
  email: 'admin@test.com',
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('AuthService', () => {
  let service: AuthService
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } }
  let jwtService: { sign: jest.Mock }

  beforeEach(async () => {
    mockUser.password = await bcrypt.hash('123456', 10)

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn().mockResolvedValue(mockUser),
      },
    }

    jwtService = { sign: jest.fn().mockReturnValue('mock-token') }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
  })

  it('login returns token for valid credentials', async () => {
    const result = await service.login({ username: 'admin', password: '123456' })
    expect(result.accessToken).toBe('mock-token')
  })

  it('login throws UnauthorizedException for wrong password', async () => {
    await expect(service.login({ username: 'admin', password: 'wrong' }))
      .rejects.toThrow(UnauthorizedException)
  })

  it('login throws UnauthorizedException for inactive user', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...mockUser, active: false })
    await expect(service.login({ username: 'admin', password: '123456' }))
      .rejects.toThrow(UnauthorizedException)
  })

  it('login throws UnauthorizedException for unknown user', async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    await expect(service.login({ username: 'unknown', password: '123456' }))
      .rejects.toThrow(UnauthorizedException)
  })
})
```

- [ ] **Step 2: Rodar teste para confirmar falha**

```bash
cd apps/api
npx jest src/auth/auth.service.spec.ts --no-coverage
```

Expected: `FAIL` - `Cannot find module './auth.service'`

- [ ] **Step 3: Criar LoginDto**

```typescript
// apps/api/src/auth/dto/login.dto.ts
import { IsString, MinLength } from 'class-validator'

export class LoginDto {
  @IsString()
  username: string

  @IsString()
  @MinLength(4)
  password: string
}
```

- [ ] **Step 4: Criar AuthService**

```typescript
// apps/api/src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'
import { LoginDto } from './dto/login.dto'
import type { AuthTokens, JwtPayload } from '@iptvagao/shared'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    })

    if (!user || !user.active) throw new UnauthorizedException('Credenciais inválidas')

    const valid = await bcrypt.compare(dto.password, user.password)
    if (!valid) throw new UnauthorizedException('Credenciais inválidas')

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      username: user.username,
      role: user.role,
      clientId: user.clientId,
    }

    return {
      accessToken: this.jwt.sign(payload),
      expiresIn: 7 * 24 * 60 * 60,
    }
  }

  async validateUser(payload: JwtPayload) {
    return this.prisma.user.findUnique({ where: { id: payload.sub } })
  }
}
```

- [ ] **Step 5: Criar JWT Strategy**

```typescript
// apps/api/src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { AuthService } from '../auth.service'
import type { JwtPayload } from '@iptvagao/shared'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    })
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.validateUser(payload)
    if (!user || !user.active) throw new UnauthorizedException()
    return user
  }
}
```

- [ ] **Step 6: Criar JwtAuthGuard e CurrentUser decorator**

```typescript
// apps/api/src/auth/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

```typescript
// apps/api/src/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    return request.user
  },
)
```

- [ ] **Step 7: Criar AuthController**

```typescript
// apps/api/src/auth/auth.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }
}
```

- [ ] **Step 8: Criar AuthModule**

```typescript
// apps/api/src/auth/auth.module.ts
import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './strategies/jwt.strategy'

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 9: Rodar testes — devem passar**

```bash
cd apps/api
npx jest src/auth/auth.service.spec.ts --no-coverage
```

Expected: `PASS` - 4 tests passed

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/auth/
git commit -m "feat(api): JWT auth module with login endpoint and guard"
```

---

### Task 6: Users Module

**Files:**
- Create: `apps/api/src/users/users.module.ts`
- Create: `apps/api/src/users/users.service.ts`
- Create: `apps/api/src/users/users.controller.ts`
- Create: `apps/api/src/users/dto/create-user.dto.ts`
- Test: `apps/api/src/users/users.service.spec.ts`

- [ ] **Step 1: Criar seed para usuário admin inicial**

```typescript
// apps/api/prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const basicPlan = await prisma.plan.upsert({
    where: { type: 'basic' },
    update: {},
    create: {
      name: 'Básico',
      type: 'basic',
      price: 99.9,
      maxDevices: 5,
      storageGB: 10,
      maxChannels: 20,
      maxPlaylists: 5,
      maxUsers: 2,
    },
  })

  const premiumPlan = await prisma.plan.upsert({
    where: { type: 'premium' },
    update: {},
    create: {
      name: 'Premium',
      type: 'premium',
      price: 199.9,
      maxDevices: 50,
      storageGB: 100,
      maxChannels: 200,
      maxPlaylists: 50,
      maxUsers: 10,
    },
  })

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@iptvagao.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'master_admin',
      active: true,
    },
  })

  console.log({ basicPlan, premiumPlan, adminUser })
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

Adicionar ao `apps/api/package.json` scripts:
```json
"db:seed": "ts-node prisma/seed.ts"
```

Rodar: `cd apps/api && npx prisma db seed`

- [ ] **Step 2: Criar CreateUserDto**

```typescript
// apps/api/src/users/dto/create-user.dto.ts
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator'
import { UserRole } from '@prisma/client'

export class CreateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string

  @IsString()
  @Matches(/^[a-z]{4}$/, { message: 'username deve ter exatamente 4 letras minúsculas' })
  username: string

  @IsString()
  @Matches(/^\d{6}$/, { message: 'password deve ter exatamente 6 dígitos' })
  password: string

  @IsEnum(UserRole)
  role: UserRole

  @IsString()
  @IsOptional()
  clientId?: string
}
```

- [ ] **Step 3: Escrever teste do UsersService**

```typescript
// apps/api/src/users/users.service.spec.ts
import { Test } from '@nestjs/testing'
import { ConflictException } from '@nestjs/common'
import { UsersService } from './users.service'
import { PrismaService } from '../prisma/prisma.service'

describe('UsersService', () => {
  let service: UsersService
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock; count: jest.Mock } }

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'u1', username: 'abcd', role: 'client_user' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    }

    const module = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<UsersService>(UsersService)
  })

  it('create returns new user', async () => {
    const result = await service.create({ username: 'abcd', password: '123456', role: 'client_user' as any })
    expect(result.username).toBe('abcd')
  })

  it('create throws ConflictException if username taken', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' })
    await expect(service.create({ username: 'abcd', password: '123456', role: 'client_user' as any }))
      .rejects.toThrow(ConflictException)
  })

  it('findAll returns paginated result', async () => {
    const result = await service.findAll({ page: 1, limit: 10 })
    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('total')
  })
})
```

- [ ] **Step 4: Rodar teste — confirmar falha**

```bash
cd apps/api && npx jest src/users/users.service.spec.ts --no-coverage
```

Expected: `FAIL` - `Cannot find module './users.service'`

- [ ] **Step 5: Criar UsersService**

```typescript
// apps/api/src/users/users.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserDto } from './dto/create-user.dto'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { username: dto.username } })
    if (exists) throw new ConflictException('Username já utilizado')

    const hashed = await bcrypt.hash(dto.password, 10)
    const { password, ...data } = dto

    return this.prisma.user.create({
      data: { ...data, password: hashed },
      select: { id: true, username: true, email: true, role: true, clientId: true, active: true, createdAt: true },
    })
  }

  async findAll({ page = 1, limit = 20 }: { page: number; limit: number }) {
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: { id: true, username: true, email: true, role: true, active: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, email: true, role: true, clientId: true, active: true, createdAt: true },
    })
    if (!user) throw new NotFoundException('Usuário não encontrado')
    return user
  }

  async generateClientCredentials() {
    const letters = 'abcdefghijklmnopqrstuvwxyz'
    let username: string
    let attempts = 0

    do {
      username = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('')
      const exists = await this.prisma.user.findUnique({ where: { username } })
      if (!exists) break
      attempts++
    } while (attempts < 100)

    const password = String(Math.floor(100000 + Math.random() * 900000))
    return { username, password }
  }
}
```

- [ ] **Step 6: Criar UsersController**

```typescript
// apps/api/src/users/users.controller.ts
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto)
  }

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.usersService.findAll({ page: +page, limit: +limit })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id)
  }
}
```

- [ ] **Step 7: Criar UsersModule**

```typescript
// apps/api/src/users/users.module.ts
import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 8: Rodar todos os testes**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: `PASS` - todos os testes passam

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/users/ apps/api/prisma/seed.ts
git commit -m "feat(api): users module with CRUD, pagination, and client credential generator"
```

---

### Task 7: Next.js Web Scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Criar package.json do web**

```json
{
  "name": "@iptvagao/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.3",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "axios": "^1.7.0",
    "zustand": "^4.5.2",
    "react-hook-form": "^7.51.3",
    "@hookform/resolvers": "^3.3.4",
    "zod": "^3.23.0",
    "sonner": "^1.4.41",
    "lucide-react": "^0.378.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0",
    "class-variance-authority": "^0.7.0",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-avatar": "^1.0.4",
    "@iptvagao/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.3",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.2.3"
  }
}
```

- [ ] **Step 2: Criar next.config.ts e configs**

```typescript
// apps/web/next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: { typedRoutes: true },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
}

export default nextConfig
```

`apps/web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#6366f1', dark: '#4f46e5' },
      },
    },
  },
  plugins: [],
}

export default config
```

`apps/web/postcss.config.mjs`:
```javascript
const config = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
export default config
```

- [ ] **Step 3: Criar globals.css e layout raiz**

`apps/web/src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```tsx
// apps/web/src/app/layout.tsx
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'IPTV Agão',
  description: 'Plataforma SaaS de TV Corporativa',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={geist.className}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Criar API client**

```typescript
// apps/web/src/lib/api.ts
import axios from 'axios'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL + '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)
```

- [ ] **Step 5: Criar auth store (zustand)**

```typescript
// apps/web/src/lib/auth.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from './api'
import type { User } from '@iptvagao/shared'

interface AuthState {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,

      async login(username, password) {
        const { data } = await api.post<{ accessToken: string }>('/auth/login', { username, password })
        localStorage.setItem('access_token', data.accessToken)
        set({ token: data.accessToken })
      },

      logout() {
        localStorage.removeItem('access_token')
        set({ user: null, token: null })
        window.location.href = '/login'
      },
    }),
    { name: 'auth-storage', partialize: (s) => ({ token: s.token }) },
  ),
)
```

- [ ] **Step 6: Criar página de login**

```tsx
// apps/web/src/app/(auth)/login/page.tsx
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
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: LoginForm) {
    setLoading(true)
    try {
      await login(data.username, data.password)
      router.push('/dashboard')
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
            {errors.username && <p className="text-red-400 text-sm mt-1">{errors.username.message}</p>}
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
            {errors.password && <p className="text-red-400 text-sm mt-1">{errors.password.message}</p>}
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

- [ ] **Step 7: Criar página home + redirecionar**

```tsx
// apps/web/src/app/page.tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

```tsx
// apps/web/src/app/(dashboard)/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <div className="p-8 text-white">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-gray-400 mt-2">Base estruturada com sucesso.</p>
    </div>
  )
}
```

- [ ] **Step 8: Criar .env.example do web**

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Salvar em: `apps/web/.env.example` e copiar para `apps/web/.env.local`

- [ ] **Step 9: Commit**

```bash
git add apps/web/
git commit -m "feat(web): Next.js 14 scaffold with login page, auth store, and API client"
```

---

### Task 8: Instalar deps e verificar dev

- [ ] **Step 1: Instalar todas as dependências**

```bash
# na raiz do projeto
pnpm install
```

Expected: `Done in Xs` sem erros

- [ ] **Step 2: Gerar Prisma client**

```bash
cd apps/api && npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 3: Subir infra local**

```bash
# na raiz
docker compose up -d
```

Expected: containers `postgres` e `redis` rodando

- [ ] **Step 4: Rodar migration + seed**

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma db seed
```

Expected: seed logs com plans + admin user

- [ ] **Step 5: Rodar dev completo**

```bash
# na raiz
pnpm dev
```

Expected:
- API: `http://localhost:3001` — `API running on port 3001`
- Web: `http://localhost:3000` — Next.js compilando

- [ ] **Step 6: Testar login via curl**

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Expected: `{"accessToken":"eyJ...","expiresIn":604800}`

- [ ] **Step 7: Abrir browser e fazer login**

Acessar `http://localhost:3000/login`, entrar com `admin` / `admin123`.
Expected: redirecionar para `/dashboard` com "Base estruturada com sucesso."

- [ ] **Step 8: Commit final**

```bash
git add .
git commit -m "chore: full base structure running — monorepo, API, web, DB"
```

---

## Self-Review

### Spec coverage

| Requisito do plano | Tarefa |
|---|---|
| Monorepo Turborepo + pnpm | Task 1 |
| NestJS backend | Task 3 |
| Next.js + TailwindCSS + shadcn/ui | Task 7 |
| Supabase/PostgreSQL (Prisma) | Task 4 |
| Redis (ioredis instalado) | Task 3 (dep) |
| Todas as 20 tabelas do plano | Task 4 Step 3 |
| Login com usuário 4 letras + senha 6 dígitos | Task 6 Step 2 (DTO) |
| Planos Básico/Premium | Task 6 Step 1 (seed) |
| Papéis: admin, suporte, financeiro, cliente, revendedor | Task 4 (UserRole enum) |
| Sistema de revenda (tabelas) | Task 4 (reseller tables) |

### Pendente para planos futuros

- Painel Admin completo (módulos clients, resellers, plans, payments)
- Painel Cliente completo  
- Aplicativo Smart TV (Android TV)
- Storage (R2/S3)
- Streaming (Bunny/Mux)
- shadcn/ui components (instalação via CLI)

Nenhum placeholder encontrado. Tipos consistentes entre tasks.
