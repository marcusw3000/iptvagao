import { Injectable } from '@nestjs/common'
import { PaymentStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export interface DashboardMetrics {
  totalClients: number
  activeSubscriptions: number
  pastDueSubscriptions: number
  totalDevices: number
  newClientsThisMonth: number
  mrr: number
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(): Promise<DashboardMetrics> {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [
      totalClients,
      activeSubscriptions,
      pastDueSubscriptions,
      totalDevices,
      newClientsThisMonth,
      mrrAggregate,
    ] = await Promise.all([
      this.prisma.client.count({ where: { active: true } }),
      this.prisma.subscription.count({ where: { status: 'active' } }),
      this.prisma.subscription.count({ where: { status: 'past_due' } }),
      this.prisma.device.count({ where: { activated: true } }),
      this.prisma.client.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.paid, paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
    ])

    const mrr = mrrAggregate._sum.amount
      ? parseFloat(mrrAggregate._sum.amount.toString())
      : 0

    return { totalClients, activeSubscriptions, pastDueSubscriptions, totalDevices, newClientsThisMonth, mrr }
  }
}
