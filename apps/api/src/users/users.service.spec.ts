import { Test } from '@nestjs/testing'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { UsersService } from './users.service'
import { PrismaService } from '../prisma/prisma.service'

describe('UsersService', () => {
  let service: UsersService
  const mockUser = { id: 'u1', username: 'abcd', email: null, role: 'support', clientId: null, active: true, createdAt: new Date() }

  let prisma: {
    user: {
      findUnique: jest.Mock
      create: jest.Mock
      findMany: jest.Mock
      count: jest.Mock
      update: jest.Mock
    }
  }

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockUser),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({ ...mockUser, active: false }),
      },
    }

    const module = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<UsersService>(UsersService)
  })

  it('create returns new user without password field', async () => {
    const result = await service.create({
      username: 'abcd',
      password: '123456',
      role: 'client_user' as any,
    })
    expect(result.username).toBe('abcd')
    expect(result).not.toHaveProperty('password')
  })

  it('create throws ConflictException if username taken (P2002 on username)', async () => {
    prisma.user.create.mockRejectedValue({ code: 'P2002', meta: { target: ['username'] } })
    await expect(
      service.create({ username: 'abcd', password: '123456', role: 'client_user' as any }),
    ).rejects.toThrow(ConflictException)
  })

  it('create throws ConflictException if client already has a user (P2002 on clientId)', async () => {
    prisma.user.create.mockRejectedValue({ code: 'P2002', meta: { target: ['clientId'] } })
    await expect(
      service.create({ username: 'wxyz', password: '123456', role: 'client_user' as any, clientId: 'client-1' }),
    ).rejects.toThrow(ConflictException)
  })

  it('create allows first user for a client', async () => {
    const result = await service.create({ username: 'wxyz', password: '123456', role: 'client_admin' as any, clientId: 'client-1' })
    expect(result.username).toBe('abcd')
    expect(prisma.user.create).toHaveBeenCalled()
  })

  it('findAll returns paginated result with correct shape', async () => {
    const result = await service.findAll({ page: 1, limit: 10 })
    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('total')
    expect(result).toHaveProperty('totalPages')
  })

  it('findOne throws NotFoundException for unknown id', async () => {
    await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException)
  })

  it('generateClientCredentials returns 4-letter username and 6-digit password', async () => {
    const creds = await service.generateClientCredentials()
    expect(creds.username).toMatch(/^[a-z]{4}$/)
    expect(creds.password).toMatch(/^\d{6}$/)
  })

  it('deactivate throws NotFoundException for unknown user', async () => {
    await expect(service.deactivate('bad')).rejects.toThrow(NotFoundException)
  })

  it('deactivate sets active to false', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser)
    await service.deactivate('u1')
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false } }),
    )
  })

  it('activateUser sets active to true', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser)
    prisma.user.update.mockResolvedValue({ ...mockUser, active: true })
    await service.activateUser('u1')
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: true } }),
    )
  })
})
