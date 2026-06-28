import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { SubscriptionStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ActivateSubscriptionDto } from './dto/activate-subscription.dto'
import { CreateSubscriptionDto } from './dto/create-subscription.dto'

const SUBSCRIPTION_SELECT = {
  id: true,
  clientId: true,
  planId: true,
  status: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
  plan: { select: { id: true, name: true, type: true, price: true } },
} as const

const SUBSCRIPTION_SELECT_WITH_CLIENT = {
  id: true,
  clientId: true,
  planId: true,
  status: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
  plan: { select: { id: true, name: true, type: true, price: true } },
  client: { select: { id: true, name: true, email: true } },
} as const

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll({ page = 1, limit = 20, status }: { page: number; limit: number; status?: SubscriptionStatus }) {
    const skip = (page - 1) * limit
    const where = status ? { status } : undefined
    const [data, total] = await Promise.all([
      this.prisma.subscription.findMany({
        skip,
        take: limit,
        select: SUBSCRIPTION_SELECT_WITH_CLIENT,
        orderBy: { createdAt: 'desc' },
        where,
      }),
      this.prisma.subscription.count({ where }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async create(dto: CreateSubscriptionDto) {
    const exists = await this.prisma.subscription.findUnique({ where: { clientId: dto.clientId } })
    if (exists) throw new ConflictException('Cliente já possui assinatura')

    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } })
    if (!client) throw new NotFoundException('Cliente não encontrado')

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } })
    if (!plan) throw new NotFoundException('Plano não encontrado')

    return this.prisma.subscription.create({
      data: {
        clientId: dto.clientId,
        planId: dto.planId,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      select: SUBSCRIPTION_SELECT,
    })
  }

  async findByClient(clientId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { clientId },
      select: SUBSCRIPTION_SELECT,
    })
    if (!subscription) throw new NotFoundException('Assinatura não encontrada')
    return subscription
  }

  async cancel(id: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { id } })
    if (!subscription) throw new NotFoundException('Assinatura não encontrada')
    return this.prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.cancelled },
      select: SUBSCRIPTION_SELECT,
    })
  }

  async activate(id: string, dto: ActivateSubscriptionDto) {
    const subscription = await this.prisma.subscription.findUnique({ where: { id } })
    if (!subscription) throw new NotFoundException('Assinatura não encontrada')
    return this.prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.active, endDate: new Date(dto.endDate) },
      select: SUBSCRIPTION_SELECT,
    })
  }
}
