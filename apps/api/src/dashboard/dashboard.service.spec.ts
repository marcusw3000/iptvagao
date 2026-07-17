import { Test } from '@nestjs/testing'
import { DashboardService } from './dashboard.service'
import { PrismaService } from '../prisma/prisma.service'

const mockRecentPayments = [
  {
    id: 'pay-1',
    amount: '29.00',
    method: 'pix',
    paidAt: new Date(),
    subscription: { client: { name: 'Acme' } },
  },
]

const mockRecentClients = [
  {
    id: 'client-1',
    name: 'Acme Corp',
    email: 'acme@test.com',
    createdAt: new Date(),
    subscription: { plan: { name: 'Premium' } },
  },
]

describe('DashboardService', () => {
  let service: DashboardService
  let prisma: {
    client: { count: jest.Mock; findMany: jest.Mock }
    subscription: { count: jest.Mock }
    device: { count: jest.Mock }
    payment: { aggregate: jest.Mock; findMany: jest.Mock }
  }

  beforeEach(async () => {
    prisma = {
      client: { count: jest.fn(), findMany: jest.fn().mockResolvedValue(mockRecentClients) },
      subscription: { count: jest.fn() },
      device: { count: jest.fn() },
      payment: { aggregate: jest.fn(), findMany: jest.fn().mockResolvedValue(mockRecentPayments) },
    }

    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()

    service = module.get<DashboardService>(DashboardService)
  })

  it('getMetrics returns all fields', async () => {
    prisma.client.count
      .mockResolvedValueOnce(42)  // totalClients
      .mockResolvedValueOnce(5)   // newClientsThisMonth
    prisma.subscription.count
      .mockResolvedValueOnce(38)  // active
      .mockResolvedValueOnce(2)   // suspended
      .mockResolvedValueOnce(3)   // past_due
    prisma.device.count
      .mockResolvedValueOnce(120) // total
      .mockResolvedValueOnce(15)  // online
    prisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: '1999.70' } })

    const result = await service.getMetrics()

    expect(result.totalClients).toBe(42)
    expect(result.activeSubscriptions).toBe(38)
    expect(result.suspendedSubscriptions).toBe(2)
    expect(result.pastDueSubscriptions).toBe(3)
    expect(result.totalDevices).toBe(120)
    expect(result.onlineDevices).toBe(15)
    expect(result.newClientsThisMonth).toBe(5)
    expect(result.mrr).toBe(1999.70)
    expect(result.recentPayments).toHaveLength(1)
    expect(result.recentClients).toHaveLength(1)
  })

  it('mrr returns 0 when no paid payments this month', async () => {
    prisma.client.count.mockResolvedValue(0)
    prisma.subscription.count.mockResolvedValue(0)
    prisma.device.count.mockResolvedValue(0)
    prisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: null } })

    const result = await service.getMetrics()

    expect(result.mrr).toBe(0)
  })

  it('recentPayments maps client name correctly', async () => {
    prisma.client.count.mockResolvedValue(0)
    prisma.subscription.count.mockResolvedValue(0)
    prisma.device.count.mockResolvedValue(0)
    prisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: null } })

    const result = await service.getMetrics()

    expect(result.recentPayments[0].clientName).toBe('Acme')
  })

  it('recentClients maps plan name correctly', async () => {
    prisma.client.count.mockResolvedValue(0)
    prisma.subscription.count.mockResolvedValue(0)
    prisma.device.count.mockResolvedValue(0)
    prisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: null } })

    const result = await service.getMetrics()

    expect(result.recentClients[0].planName).toBe('Premium')
  })
})
