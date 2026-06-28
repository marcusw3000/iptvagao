# Client Credentials Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin view a client's login username and regenerate credentials (new 4-letter username + 6-digit password) from a dedicated page.

**Architecture:** One new backend endpoint (`POST /clients/:id/reset-credentials`) finds the linked `client_admin` User, generates new credentials via the existing `UsersService.generateClientCredentials()`, updates the User, and returns plain-text credentials (one-time). A new `GET /clients/:id/credentials` returns only the current username. The frontend adds a "Credenciais" tab to the existing client sub-page header and a new page that shows the username plus a reset button.

**Tech Stack:** NestJS 10, Prisma 5, Jest, Next.js 14 App Router, Tailwind CSS, Axios (`@/lib/api`), `catch (e: unknown)` pattern.

---

## File Map

**Modify:**
- `apps/api/src/clients/clients.service.ts` — add `getCredentials()` + `resetCredentials()`
- `apps/api/src/clients/clients.service.spec.ts` — add tests for both methods
- `apps/api/src/clients/clients.controller.ts` — add two new endpoints
- `apps/web/src/app/(dashboard)/clients/[clientId]/devices/page.tsx` — add "Credenciais" link to header

**Create:**
- `apps/web/src/app/(dashboard)/clients/[clientId]/credentials/page.tsx` — credentials page

---

## Task 1 — Backend: getCredentials + resetCredentials (TDD)

### Step 1.1 — Read current clients.service.ts and clients.service.spec.ts

Read both files before writing any changes.

### Step 1.2 — Add tests (red phase)

Append to `apps/api/src/clients/clients.service.spec.ts`.

First verify the existing mock structure — it should have a `prisma.user` mock. If not, add:
```typescript
prisma.user = {
  findFirst: jest.fn(),
  update: jest.fn(),
}
```

Add these tests at the end of the `describe('ClientsService')` block:

```typescript
// ── credentials ────────────────────────────────────────────────────────────────

describe('getCredentials', () => {
  it('returns username of linked client_admin user', async () => {
    prisma.client.findUnique.mockResolvedValue(mockClient)
    prisma.user.findFirst.mockResolvedValue({ username: 'abcd' })
    const result = await service.getCredentials('client-1')
    expect(result).toEqual({ username: 'abcd' })
  })

  it('throws NotFoundException when client not found', async () => {
    prisma.client.findUnique.mockResolvedValue(null)
    await expect(service.getCredentials('bad')).rejects.toThrow(NotFoundException)
  })

  it('throws NotFoundException when no linked user', async () => {
    prisma.client.findUnique.mockResolvedValue(mockClient)
    prisma.user.findFirst.mockResolvedValue(null)
    await expect(service.getCredentials('client-1')).rejects.toThrow(NotFoundException)
  })
})

describe('resetCredentials', () => {
  it('updates user and returns new plain-text credentials', async () => {
    prisma.client.findUnique.mockResolvedValue(mockClient)
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1', username: 'abcd' })
    prisma.user.update.mockResolvedValue({ username: 'wxyz' })
    // generateClientCredentials calls prisma.user.findUnique (for uniqueness check)
    prisma.user.findUnique.mockResolvedValue(null)

    const result = await service.resetCredentials('client-1')
    expect(result).toHaveProperty('username')
    expect(result).toHaveProperty('password')
    expect(result.username).toHaveLength(4)
    expect(result.password).toMatch(/^\d{6}$/)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ username: expect.any(String) }),
      }),
    )
  })

  it('throws NotFoundException when client not found', async () => {
    prisma.client.findUnique.mockResolvedValue(null)
    await expect(service.resetCredentials('bad')).rejects.toThrow(NotFoundException)
  })

  it('throws NotFoundException when no linked user', async () => {
    prisma.client.findUnique.mockResolvedValue(mockClient)
    prisma.user.findFirst.mockResolvedValue(null)
    await expect(service.resetCredentials('client-1')).rejects.toThrow(NotFoundException)
  })
})
```

### Step 1.3 — Run tests (confirm red)

```bash
pnpm test -- --testPathPattern=clients.service.spec --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `service.getCredentials is not a function`.

### Step 1.4 — Implement in clients.service.ts

Add these two methods. The service already has access to `UsersService` via constructor injection — verify this. If `UsersService` is NOT injected, add it.

Check current constructor. If it only has `PrismaService`, add `UsersService`:
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly usersService: UsersService,
) {}
```

And add the import: `import { UsersService } from '../users/users.service'`

Then add the methods:

```typescript
async getCredentials(clientId: string): Promise<{ username: string }> {
  await this.assertClient(clientId)
  const user = await this.prisma.user.findFirst({
    where: { clientId, role: 'client_admin' },
    select: { username: true },
  })
  if (!user) throw new NotFoundException('Credenciais não encontradas')
  return { username: user.username }
}

async resetCredentials(clientId: string): Promise<{ username: string; password: string }> {
  await this.assertClient(clientId)
  const user = await this.prisma.user.findFirst({
    where: { clientId, role: 'client_admin' },
    select: { id: true },
  })
  if (!user) throw new NotFoundException('Usuário do cliente não encontrado')

  const credentials = await this.usersService.generateClientCredentials()
  const hashedPassword = await bcrypt.hash(credentials.password, 10)

  await this.prisma.user.update({
    where: { id: user.id },
    data: { username: credentials.username, password: hashedPassword },
  })

  return credentials
}
```

Add bcrypt import at top of file: `import * as bcrypt from 'bcrypt'`

Also add a private `assertClient` helper if it doesn't exist:
```typescript
private async assertClient(id: string) {
  const client = await this.prisma.client.findUnique({ where: { id } })
  if (!client) throw new NotFoundException('Cliente não encontrado')
  return client
}
```

Check whether `assertClient` already exists — if `findOne` already throws NotFoundException, use it instead.

### Step 1.5 — Update clients.module.ts

`UsersModule` must be imported in `ClientsModule` so `UsersService` is available. Check `clients.module.ts`. If `UsersModule` is not in imports, add it:

```typescript
import { UsersModule } from '../users/users.module'

@Module({
  imports: [UsersModule],
  ...
})
```

### Step 1.6 — Run tests (confirm green)

```bash
pnpm test -- --testPathPattern=clients.service.spec --no-coverage 2>&1 | tail -15
```

Expected: all clients service tests pass.

### Step 1.7 — Run full suite

```bash
pnpm test --no-coverage 2>&1 | tail -8
```

Expected: 83 + 6 new = 89 tests pass.

### Step 1.8 — Commit

```bash
git add apps/api/src/clients/clients.service.ts \
        apps/api/src/clients/clients.service.spec.ts \
        apps/api/src/clients/clients.module.ts
git commit -m "feat(clients): add getCredentials and resetCredentials methods"
```

---

## Task 2 — Controller endpoints

### Step 2.1 — Add endpoints to clients.controller.ts

Read the current controller first, then add these two endpoints:

```typescript
@Get(':id/credentials')
getCredentials(@Param('id') id: string) {
  return this.clientsService.getCredentials(id)
}

@Post(':id/reset-credentials')
resetCredentials(@Param('id') id: string) {
  return this.clientsService.resetCredentials(id)
}
```

### Step 2.2 — Run full suite

```bash
pnpm test --no-coverage 2>&1 | tail -8
```

Expected: 89 tests pass (controller adds no new unit tests).

### Step 2.3 — Commit

```bash
git add apps/api/src/clients/clients.controller.ts
git commit -m "feat(clients): add GET /credentials and POST /reset-credentials endpoints"
```

---

## Task 3 — Frontend: credentials page + header link

### Step 3.1 — Add "Credenciais" link to devices page header

Read `apps/web/src/app/(dashboard)/clients/[clientId]/devices/page.tsx`.

Find the header section that has "Canais" and "Assinatura" links. Add a "Credenciais" link before or after them, pointing to `/clients/${clientId}/credentials`:

```typescript
<Link
  href={`/clients/${clientId}/credentials`}
  className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
>
  Credenciais
</Link>
```

Do the same for `channels/page.tsx` and `subscription/page.tsx` if they have the same header navigation — read each to check.

### Step 3.2 — Create `apps/web/src/app/(dashboard)/clients/[clientId]/credentials/page.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, KeyRound, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'

interface Credentials {
  username: string
  password?: string
}

export default function CredentialsPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [newCredentials, setNewCredentials] = useState<Credentials | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    api.get<Credentials>(`/clients/${clientId}/credentials`)
      .then((r) => setCredentials(r.data))
      .catch(() => toast.error('Erro ao carregar credenciais'))
      .finally(() => setLoading(false))
  }, [clientId])

  async function handleReset() {
    setResetting(true)
    try {
      const r = await api.post<Credentials>(`/clients/${clientId}/reset-credentials`)
      setNewCredentials(r.data)
      setCredentials({ username: r.data.username })
      toast.success('Credenciais redefinidas')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? 'Erro ao redefinir credenciais')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/clients/${clientId}/devices`} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-indigo-400" />
          <h2 className="text-2xl font-bold text-white">Credenciais de Acesso</h2>
        </div>
        <div className="flex gap-2 ml-auto text-sm">
          <Link href={`/clients/${clientId}/devices`} className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">Dispositivos</Link>
          <Link href={`/clients/${clientId}/channels`} className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">Canais</Link>
          <Link href={`/clients/${clientId}/subscription`} className="px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">Assinatura</Link>
          <span className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded-lg">Credenciais</span>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : (
        <div className="max-w-md">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-4">
            <h3 className="text-sm text-gray-400 mb-4">Credenciais atuais</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Usuário</p>
                <p className="text-white font-mono text-lg">{credentials?.username ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Senha</p>
                <p className="text-gray-400 text-sm">••••••  (não é possível visualizar)</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={resetting ? 'animate-spin' : ''} />
            {resetting ? 'Redefinindo...' : 'Redefinir Credenciais'}
          </button>

          {newCredentials && (
            <div className="mt-6 bg-emerald-900/20 border border-emerald-800 rounded-xl p-6">
              <p className="text-emerald-400 text-sm font-semibold mb-3">
                Novas credenciais geradas — anote antes de fechar!
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Usuário</p>
                  <p className="text-white font-mono text-lg">{newCredentials.username}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Senha</p>
                  <p className="text-white font-mono text-lg">{newCredentials.password}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

### Step 3.3 — TypeScript check

```bash
cd apps/web && npx tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors.

### Step 3.4 — Run API tests

```bash
cd apps/api && pnpm test 2>&1 | tail -8
```

Expected: 89 tests pass.

### Step 3.5 — Commit

```bash
git add "apps/web/src/app/(dashboard)/clients/[clientId]/credentials/page.tsx" \
        "apps/web/src/app/(dashboard)/clients/[clientId]/devices/page.tsx"
git commit -m "feat(web): add client credentials page with reset button"
```

---

## Summary

### Create
| File | Purpose |
|------|---------|
| `apps/web/src/app/(dashboard)/clients/[clientId]/credentials/page.tsx` | Shows username, reset button, new credentials display |

### Modify
| File | Change |
|------|--------|
| `apps/api/src/clients/clients.service.ts` | `getCredentials()` + `resetCredentials()` |
| `apps/api/src/clients/clients.service.spec.ts` | 6 new tests |
| `apps/api/src/clients/clients.controller.ts` | 2 new endpoints |
| `apps/api/src/clients/clients.module.ts` | Import `UsersModule` if not present |
| `apps/web/src/app/(dashboard)/clients/[clientId]/devices/page.tsx` | Add "Credenciais" nav link |

### Test count
| After | Expected |
|-------|---------|
| Task 1 | 89 (+6) |
| Task 2 | 89 (no new tests) |
| Task 3 | 89 (frontend only) |

### Commits
```
feat(web): add client credentials page with reset button
feat(clients): add GET /credentials and POST /reset-credentials endpoints
feat(clients): add getCredentials and resetCredentials methods
```
