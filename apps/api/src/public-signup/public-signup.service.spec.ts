import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ClientsService } from '../clients/clients.service'
import { PaymentsService } from '../payments/payments.service'
import { PlansService } from '../plans/plans.service'
import { PrismaService } from '../prisma/prisma.service'
import { ResellersService } from '../resellers/resellers.service'
import { SubscriptionsService } from '../subscriptions/subscriptions.service'
import { PublicSignupService } from './public-signup.service'

describe('PublicSignupService', () => {
  let service: PublicSignupService
  let clientsService: any
  let paymentsService: any
  let plansService: any
  let prisma: any
  let resellersService: any
  let subscriptionsService: any

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb({
        payment: { deleteMany: jest.fn() },
        subscription: { deleteMany: jest.fn() },
        user: { deleteMany: jest.fn() },
        client: { deleteMany: jest.fn() },
      })),
    }
    clientsService = {
      create: jest.fn().mockResolvedValue({
        client: { id: 'client-1' },
        credentials: { username: 'abcd', password: '123456' },
      }),
    }
    subscriptionsService = {
      create: jest.fn().mockResolvedValue({ id: 'sub-1' }),
    }
    paymentsService = {
      createCheckout: jest.fn().mockResolvedValue({
        paymentId: 'pay-1',
        checkoutUrl: 'https://checkout.test/pay-1',
      }),
    }
    plansService = {
      findPublicPlans: jest.fn().mockResolvedValue([
        { id: 'plan-1', name: 'Premium', type: 'premium', price: '99.90' },
      ]),
      findActivePlan: jest.fn().mockResolvedValue({
        id: 'plan-1',
        name: 'Premium',
        type: 'premium',
        price: '99.90',
      }),
    }
    resellersService = {
      findByReferralCode: jest.fn().mockResolvedValue({
        id: 'res-1',
        name: 'Revendedor Teste',
        referralCode: 'VIP123',
        active: true,
      }),
    }

    const module = await Test.createTestingModule({
      providers: [
        PublicSignupService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClientsService, useValue: clientsService },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: PlansService, useValue: plansService },
        { provide: ResellersService, useValue: resellersService },
        { provide: SubscriptionsService, useValue: subscriptionsService },
      ],
    }).compile()

    service = module.get(PublicSignupService)
  })

  it('returns valid false for unknown referral code', async () => {
    resellersService.findByReferralCode.mockResolvedValueOnce(null)
    await expect(service.resolveReferralCode('bad')).resolves.toEqual({
      valid: false,
      referralCode: 'BAD',
    })
  })

  it('lists public plans', async () => {
    await expect(service.listPlans()).resolves.toEqual([
      { id: 'plan-1', name: 'Premium', type: 'premium', price: '99.90' },
    ])
  })

  it('creates client, subscription and checkout on public onboarding', async () => {
    const result = await service.onboard({
      name: 'Cliente Teste',
      email: 'cliente@test.com',
      phone: '11999999999',
      referralCode: 'vip123',
      planId: 'plan-1',
    })

    expect(clientsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ resellerId: 'res-1' }),
    )
    expect(subscriptionsService.create).toHaveBeenCalledWith({
      clientId: 'client-1',
      planId: 'plan-1',
    })
    expect(paymentsService.createCheckout).toHaveBeenCalledWith('sub-1')
    expect(result.checkoutUrl).toBe('https://checkout.test/pay-1')
  })

  it('throws BadRequestException when referral code is invalid', async () => {
    resellersService.findByReferralCode.mockResolvedValueOnce(null)

    await expect(service.onboard({
      name: 'Cliente Teste',
      email: 'cliente@test.com',
      phone: '11999999999',
      referralCode: 'zzz',
      planId: 'plan-1',
    })).rejects.toThrow(BadRequestException)
  })

  it('throws NotFoundException when plan is inactive or missing', async () => {
    plansService.findActivePlan.mockResolvedValueOnce(null)

    await expect(service.onboard({
      name: 'Cliente Teste',
      email: 'cliente@test.com',
      phone: '11999999999',
      referralCode: 'vip123',
      planId: 'plan-x',
    })).rejects.toThrow(NotFoundException)
  })
})
