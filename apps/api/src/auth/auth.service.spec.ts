import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { PrismaService } from '../prisma/prisma.service'
import * as bcrypt from 'bcrypt'

const mockUser = {
  id: 'user-1',
  username: 'admin',
  password: '',
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
