import { Test } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { PaymentsService } from './payments.service'
import { PrismaService } from '../prisma/prisma.service'
import { AbacatepayService } from '../abacatepay/abacatepay.service'
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
  // nested include shape — resellerId null means no commission
  subscription: {
    client: { resellerId: null },
  },
}

const confirmedPayment = { ...mockPayment, status: PaymentStatus.paid, paidAt: new Date() }

const mockPlan = { id: 'plan-1', name: 'Premium', price: '99.90' }
const mockSubscriptionFull = {
  ...{ id: 'sub-1', clientId: 'client-1', status: SubscriptionStatus.past_due },
  plan: mockPlan,
  client: { id: 'client-1', name: 'Acme', email: 'acme@test.com', document: '12345678901', phone: null },
}

describe('PaymentsService', () => {
  let service: PaymentsService
  let prisma: any
  let abacatepay: any

  beforeEach(async () => {
    const paymentUpdateMock = jest.fn().mockResolvedValue(confirmedPayment)
    const subscriptionUpdateMock = jest.fn().mockResolvedValue({ ...mockSubscription, status: SubscriptionStatus.active })

    prisma = {
      payment: {
        create: jest.fn().mockResolvedValue(mockPayment),
        findMany: jest.fn().mockResolvedValue([mockPayment]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(null),
        update: paymentUpdateMock,
      },
      subscription: {
        findUnique: jest.fn().mockResolvedValue(mockSubscription),
        update: subscriptionUpdateMock,
      },
      reseller: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      resellerCommission: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(),
    }

    abacatepay = {
      createCustomer: jest.fn().mockResolvedValue({ id: 'cust-1', name: 'Acme', email: 'acme@test.com' }),
      ensureProduct: jest.fn().mockResolvedValue(undefined),
      createCheckout: jest.fn().mockResolvedValue({ id: 'chk-1', url: 'https://pay.abacatepay.com/chk-1' }),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
    }

    // callback-style $transaction: pass prisma itself as tx so inner mocks are the same references
    prisma.$transaction.mockImplementation((cb: any) =>
      typeof cb === 'function' ? cb(prisma) : Promise.resolve([confirmedPayment]),
    )

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AbacatepayService, useValue: abacatepay },
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

  it('confirm does NOT create commission when resellerId is null', async () => {
    // mockPayment already has resellerId: null
    prisma.payment.findUnique.mockResolvedValue(mockPayment)
    await service.confirm('pay-1')
    expect(prisma.resellerCommission.create).not.toHaveBeenCalled()
  })

  it('confirm creates commission when client has resellerId', async () => {
    const paymentWithReseller = {
      ...mockPayment,
      subscription: { client: { resellerId: 'res-1' } },
    }
    prisma.payment.findUnique.mockResolvedValue(paymentWithReseller)
    prisma.reseller.findUnique.mockResolvedValue({
      id: 'res-1',
      commissionPct: '10.00',
    })

    await service.confirm('pay-1')

    expect(prisma.resellerCommission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resellerId: 'res-1',
          paymentId: 'pay-1',
        }),
      }),
    )
  })

  describe('createCheckout', () => {
    beforeEach(() => {
      prisma.subscription.findUnique.mockResolvedValue(mockSubscriptionFull)
    })

    it('returns paymentId and checkoutUrl on success', async () => {
      const result = await service.createCheckout('sub-1')
      expect(result.paymentId).toBe('pay-1')
      expect(result.checkoutUrl).toBe('https://pay.abacatepay.com/chk-1')
    })

    it('calls ensureProduct with price in centavos', async () => {
      await service.createCheckout('sub-1')
      expect(abacatepay.ensureProduct).toHaveBeenCalledWith(
        expect.objectContaining({ priceInCentavos: 9990 }),
      )
    })

    it('throws NotFoundException when subscription not found', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null)
      await expect(service.createCheckout('bad')).rejects.toThrow(NotFoundException)
    })
  })

  describe('handleWebhook', () => {
    const rawBody = Buffer.from('{}')

    it('throws BadRequestException on invalid signature', async () => {
      abacatepay.verifyWebhookSignature.mockReturnValue(false)
      await expect(
        service.handleWebhook({}, rawBody, 'bad-sig'),
      ).rejects.toThrow(BadRequestException)
    })

    it('confirms payment on checkout.completed', async () => {
      prisma.payment.findUnique.mockResolvedValue(mockPayment)
      const payload = { event: 'checkout.completed', data: { externalId: 'pay-1' } }
      await service.handleWebhook(payload, rawBody, 'sig')
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('skips confirm when payment already paid', async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...mockPayment, status: PaymentStatus.paid })
      const payload = { event: 'checkout.completed', data: { externalId: 'pay-1' } }
      await service.handleWebhook(payload, rawBody, 'sig')
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })
  })
})
