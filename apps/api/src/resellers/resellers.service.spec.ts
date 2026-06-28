import { Test } from '@nestjs/testing'
import { ConflictException, NotFoundException } from '@nestjs/common'
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

  it('findAll returns paginated result with clientCount', async () => {
    const result = await service.findAll({ page: 1, limit: 20 })
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
    expect(result.totalPages).toBe(1)
    expect(result.data[0]).toHaveProperty('clientCount')
  })

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
