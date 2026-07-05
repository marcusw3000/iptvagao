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
      delete: jest.Mock
    }
    user: {
      findFirst: jest.Mock
      update: jest.Mock
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
        delete: jest.fn().mockResolvedValue(mockClient),
      },
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
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
    prisma.client.update.mockResolvedValue(mockClient)
    await service.suspend('client-1')
    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: 'client-1' },
      data: { active: false },
      select: expect.any(Object),
    })
  })

  it('activate sets active to true', async () => {
    prisma.client.findUnique.mockResolvedValue(mockClient)
    await service.activate('client-1')
    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: 'client-1' },
      data: { active: true },
      select: expect.any(Object),
    })
  })

  it('activate throws NotFoundException for unknown id', async () => {
    prisma.client.findUnique.mockResolvedValue(null)
    await expect(service.activate('bad-id')).rejects.toThrow(NotFoundException)
  })

  it('findAll returns correct pagination metadata', async () => {
    const result = await service.findAll({ page: 1, limit: 20 })
    expect(result.data[0].id).toBe('client-1')
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
    expect(result.totalPages).toBe(1)
  })

  it('findAll filters by resellerId when provided', async () => {
    await service.findAll({ page: 1, limit: 20, resellerId: 'res-1' })
    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ resellerId: 'res-1' }) }),
    )
  })

  it('findAll filters by search across name and email', async () => {
    await service.findAll({ page: 1, limit: 20, search: 'empresa' })
    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ name: expect.objectContaining({ contains: 'empresa' }) }),
          ]),
        }),
      }),
    )
  })

  it('create calls usersService.create with correct clientId', async () => {
    await service.create({ name: 'Empresa', email: 'e@test.com' })
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'client-1' }),
    )
  })

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
      prisma.user.update.mockResolvedValue({ username: 'abcd' })

      const result = await service.resetCredentials('client-1')
      expect(result).toHaveProperty('username')
      expect(result).toHaveProperty('password')
      expect(result.username).toHaveLength(4)
      expect(result.password).toMatch(/^\d{6}$/)
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            username: expect.any(String),
            password: expect.stringMatching(/^\$2[ab]\$/),
          }),
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
})
