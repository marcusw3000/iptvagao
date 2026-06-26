import { Test } from '@nestjs/testing'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { UsersService } from './users.service'
import { PrismaService } from '../prisma/prisma.service'

describe('UsersService', () => {
  let service: UsersService
  let prisma: {
    user: {
      findUnique: jest.Mock
      create: jest.Mock
      findMany: jest.Mock
      count: jest.Mock
    }
  }

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'u1',
          username: 'abcd',
          email: null,
          role: 'client_user',
          clientId: null,
          active: true,
          createdAt: new Date(),
        }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
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

  it('create throws ConflictException if username taken', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' })
    await expect(
      service.create({ username: 'abcd', password: '123456', role: 'client_user' as any }),
    ).rejects.toThrow(ConflictException)
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
})
