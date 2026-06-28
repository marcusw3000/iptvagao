import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { PaymentsService } from './payments.service'
import { PrismaService } from '../prisma/prisma.service'
import { PaymentMethod, PaymentStatus, SubscriptionStatus } from '@prisma/client'

const mockSubscription = {
  id: 'sub-1',
  clientId: 'client-1',
  status: SubscriptionStatus.past_due,
}

const mockPayment = {
  id: 'pay-1',
  subscriptionId: 'sub-1',
  amount: '99.90',
  method: PaymentMethod.pix,
  status: PaymentStatus.pending,
  reference: null,
  paidAt: null,
  createdAt: new Date(),
}

const confirmedPayment = { ...mockPayment, status: PaymentStatus.paid, paidAt: new Date() }

describe('PaymentsService', () => {
  let service: PaymentsService
  let prisma: {
    payment: {
      create: jest.Mock
      findMany: jest.Mock
      count: jest.Mock
      findUnique: jest.Mock
      update: jest.Mock
    }
    subscription: {
      findUnique: jest.Mock
      update: jest.Mock
    }
  }

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
        update: jest.fn().mockResolvedValue({ ...mockSubscription, status: SubscriptionStatus.active }),
      },
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
    await expect(service.create({
      subscriptionId: 'bad',
      amount: '99.90',
      method: PaymentMethod.pix,
    })).rejects.toThrow(NotFoundException)
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
})
