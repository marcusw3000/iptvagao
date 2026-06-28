import { Test } from '@nestjs/testing'
import { DashboardService } from './dashboard.service'
import { PrismaService } from '../prisma/prisma.service'

describe('DashboardService', () => {
  let service: DashboardService
  let prisma: {
    client: { count: jest.Mock }
    subscription: { count: jest.Mock }
    device: { count: jest.Mock }
    payment: { aggregate: jest.Mock }
  }

  beforeEach(async () => {
    prisma = {
      client: { count: jest.fn() },
      subscription: { count: jest.fn() },
      device: { count: jest.fn() },
      payment: { aggregate: jest.fn() },
    }

    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()

    service = module.get<DashboardService>(DashboardService)
  })

  it('getMetrics returns all six fields', async () => {
    prisma.client.count
      .mockResolvedValueOnce(42)
      .mockResolvedValueOnce(5)
    prisma.subscription.count
      .mockResolvedValueOnce(38)
      .mockResolvedValueOnce(3)
    prisma.device.count.mockResolvedValueOnce(120)
    prisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: '1999.70' } })

    const result = await service.getMetrics()

    expect(result).toEqual({
      totalClients: 42,
      activeSubscriptions: 38,
      pastDueSubscriptions: 3,
      totalDevices: 120,
      newClientsThisMonth: 5,
      mrr: 1999.70,
    })
  })

  it('getMetrics calls each Prisma method exactly the right number of times', async () => {
    prisma.client.count.mockResolvedValue(0)
    prisma.subscription.count.mockResolvedValue(0)
    prisma.device.count.mockResolvedValue(0)
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } })

    await service.getMetrics()

    expect(prisma.client.count).toHaveBeenCalledTimes(2)
    expect(prisma.subscription.count).toHaveBeenCalledTimes(2)
    expect(prisma.device.count).toHaveBeenCalledTimes(1)
    expect(prisma.payment.aggregate).toHaveBeenCalledTimes(1)
  })

  it('mrr returns 0 when no paid payments this month', async () => {
    prisma.client.count.mockResolvedValue(0)
    prisma.subscription.count.mockResolvedValue(0)
    prisma.device.count.mockResolvedValue(0)
    prisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: null } })

    const result = await service.getMetrics()

    expect(result.mrr).toBe(0)
  })

  it('mrr sums payment amounts correctly', async () => {
    prisma.client.count.mockResolvedValue(0)
    prisma.subscription.count.mockResolvedValue(0)
    prisma.device.count.mockResolvedValue(0)
    prisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: '3750.50' } })

    const result = await service.getMetrics()

    expect(result.mrr).toBe(3750.50)
  })
})
