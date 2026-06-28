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
