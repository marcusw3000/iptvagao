import { Injectable, NotFoundException } from '@nestjs/common'
import { PaymentStatus, SubscriptionStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePaymentDto } from './dto/create-payment.dto'

const PAYMENT_SELECT = {
  id: true,
  subscriptionId: true,
  amount: true,
  method: true,
  status: true,
  reference: true,
  paidAt: true,
  createdAt: true,
} as const

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaymentDto) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: dto.subscriptionId },
    })
    if (!subscription) throw new NotFoundException('Assinatura não encontrada')

    return this.prisma.payment.create({
      data: {
        subscriptionId: dto.subscriptionId,
        amount: dto.amount,
        method: dto.method,
        reference: dto.reference,
      },
      select: PAYMENT_SELECT,
    })
  }

  async findBySubscription(
    subscriptionId: string,
    { page = 1, limit = 20 }: { page: number; limit: number },
  ) {
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { subscriptionId },
        skip,
        take: limit,
        select: PAYMENT_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where: { subscriptionId } }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async confirm(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } })
    if (!payment) throw new NotFoundException('Pagamento não encontrado')

    const [confirmed] = await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id },
        data: { status: PaymentStatus.paid, paidAt: new Date() },
        select: PAYMENT_SELECT,
      }),
      this.prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: SubscriptionStatus.active },
      }),
    ])

    return confirmed
  }
}
