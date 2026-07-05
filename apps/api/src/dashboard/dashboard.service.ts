import { Injectable } from '@nestjs/common'
import { PaymentStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export interface RecentPayment {
  id: string
  clientName: string
  amount: string
  method: string
  paidAt: Date | null
}

export interface RecentClient {
  id: string
  name: string
  email: string
  createdAt: Date
  planName: string | null
}

export interface DashboardMetrics {
  totalClients: number
  activeSubscriptions: number
  suspendedSubscriptions: number
  pastDueSubscriptions: number
  totalDevices: number
  onlineDevices: number
  newClientsThisMonth: number
  mrr: number
  recentPayments: RecentPayment[]
  recentClients: RecentClient[]
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(): Promise<DashboardMetrics> {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const onlineThreshold = new Date(Date.now() - 5 * 60 * 1000)

    const [
      totalClients,
      activeSubscriptions,
      suspendedSubscriptions,
      pastDueSubscriptions,
      totalDevices,
      onlineDevices,
      newClientsThisMonth,
      mrrAggregate,
      recentPaymentsRaw,
      recentClientsRaw,
    ] = await Promise.all([
      this.prisma.client.count({ where: { active: true } }),
      this.prisma.subscription.count({ where: { status: 'active' } }),
      this.prisma.subscription.count({ where: { status: 'suspended' } }),
      this.prisma.subscription.count({ where: { status: 'past_due' } }),
      this.prisma.device.count({ where: { activated: true } }),
      this.prisma.device.count({ where: { activated: true, lastSeenAt: { gte: onlineThreshold } } }),
      this.prisma.client.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.paid, paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.paid },
        orderBy: { paidAt: 'desc' },
        take: 6,
        select: {
          id: true,
          amount: true,
          method: true,
          paidAt: true,
          subscription: { select: { client: { select: { name: true } } } },
        },
      }),
      this.prisma.client.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          subscription: { select: { plan: { select: { name: true } } } },
        },
      }),
    ])

    const mrr = mrrAggregate._sum.amount
      ? parseFloat(mrrAggregate._sum.amount.toString())
      : 0

    const recentPayments: RecentPayment[] = recentPaymentsRaw.map((p) => ({
      id: p.id,
      clientName: p.subscription?.client?.name ?? '—',
      amount: p.amount.toString(),
      method: p.method,
      paidAt: p.paidAt,
    }))

    const recentClients: RecentClient[] = recentClientsRaw.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      createdAt: c.createdAt,
      planName: c.subscription?.plan?.name ?? null,
    }))

    return {
      totalClients,
      activeSubscriptions,
      suspendedSubscriptions,
      pastDueSubscriptions,
      totalDevices,
      onlineDevices,
      newClientsThisMonth,
      mrr,
      recentPayments,
      recentClients,
    }
  }
}
