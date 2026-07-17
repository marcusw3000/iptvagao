import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PaymentMethod, PaymentStatus, SubscriptionStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AbacatepayService } from '../abacatepay/abacatepay.service'
import { CreatePaymentDto } from './dto/create-payment.dto'

const ABACATEPAY_SUBSCRIPTION_CYCLE = 'MONTHLY' as const

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
  private readonly logger = new Logger(PaymentsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly abacatepay: AbacatepayService,
  ) {}

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
    await this.syncPendingPaymentsBySubscription(subscriptionId)

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
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        subscription: {
          include: {
            client: { select: { resellerId: true } },
          },
        },
      },
    })
    if (!payment) throw new NotFoundException('Pagamento não encontrado')
    if (payment.status === PaymentStatus.paid) {
      const existing = await this.prisma.payment.findUnique({ where: { id }, select: PAYMENT_SELECT })
      return existing!
    }

    const resellerId = payment.subscription?.client?.resellerId ?? null
    const reseller = resellerId
      ? await this.prisma.reseller.findUnique({ where: { id: resellerId } })
      : null

    const confirmed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: { status: PaymentStatus.paid, paidAt: new Date() },
        select: PAYMENT_SELECT,
      })
      await tx.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: SubscriptionStatus.active },
      })
      if (reseller) {
        await tx.resellerCommission.create({
          data: {
            resellerId: reseller.id,
            paymentId: id,
            amount: String(
              (Number(payment.amount) * Number(reseller.commissionPct)) / 100,
            ),
          },
        })
      }
      return updated
    })

    return confirmed
  }

  async createCheckout(subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
        client: { select: { id: true, name: true, email: true, document: true, phone: true } },
      },
    })
    if (!subscription) throw new NotFoundException('Assinatura não encontrada')

    const customer = await this.abacatepay.createCustomer({
      name: subscription.client.name,
      email: subscription.client.email,
      taxId: subscription.client.document ?? undefined,
      cellphone: subscription.client.phone ?? undefined,
    })

    const priceInCentavos = Math.round(Number(subscription.plan.price) * 100)
    const abacatePlanId = `sub-${subscription.plan.id}`

    await this.abacatepay.ensureProduct({
      id: abacatePlanId,
      name: subscription.plan.name,
      priceInCentavos,
      cycle: ABACATEPAY_SUBSCRIPTION_CYCLE,
    })

    const payment = await this.prisma.payment.create({
      data: {
        subscriptionId,
        amount: subscription.plan.price,
        method: PaymentMethod.credit_card,
        status: PaymentStatus.pending,
      },
      select: PAYMENT_SELECT,
    })

    const webUrl = (process.env.WEB_URL ?? 'http://localhost:3000').split(',')[0]
    const checkoutReturnUrl = `${webUrl}/signup/complete?paymentId=${payment.id}&clientId=${subscription.client.id}`

    let checkout: { id: string; url: string }
    try {
      checkout = await this.abacatepay.createSubscriptionCheckout({
        customerId: customer.id,
        planId: abacatePlanId,
        paymentId: payment.id,
        returnUrl: checkoutReturnUrl,
        completionUrl: checkoutReturnUrl,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (!message.includes('PIX Automático is not available for this store')) {
        throw error
      }

      this.logger.warn('Store without PIX automatic. Falling back to card-only subscription checkout.')
      checkout = await this.abacatepay.createSubscriptionCheckout({
        customerId: customer.id,
        planId: abacatePlanId,
        paymentId: payment.id,
        returnUrl: checkoutReturnUrl,
        completionUrl: checkoutReturnUrl,
        methods: ['CARD'],
      })
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { reference: checkout.id },
    })

    return { paymentId: payment.id, checkoutUrl: checkout.url }
  }

  async handleWebhook(payload: Record<string, unknown>, rawBody: Buffer, signature: string) {
    const isValid = this.abacatepay.verifyWebhookSignature(rawBody, signature)
    if (!isValid) throw new BadRequestException('Assinatura inválida')

    const event = payload.event as string
    this.logger.log(`Webhook received: ${event}`)

    if (event === 'checkout.completed' || event === 'subscription.completed' || event === 'billing.paid') {
      const externalId = this.extractExternalId(payload)
      if (!externalId) return

      const payment = await this.prisma.payment.findUnique({ where: { id: externalId } })
      if (payment && payment.status === PaymentStatus.pending) {
        await this.confirm(payment.id)
        this.logger.log('Payment confirmed via webhook')
      }
    }

    if (event === 'checkout.refunded') {
      const data = payload.data as Record<string, unknown>
      const checkout = data?.checkout as Record<string, unknown>
      const externalId = (checkout?.externalId ?? data?.externalId) as string | undefined
      if (!externalId) return

      const payment = await this.prisma.payment.findUnique({ where: { id: externalId } })
      if (payment && payment.status === PaymentStatus.paid) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.refunded },
        })
      }
    }
  }

  private extractExternalId(payload: Record<string, unknown>) {
    const data = payload.data as Record<string, unknown> | undefined
    const checkout = data?.checkout as Record<string, unknown> | undefined
    const subscription = data?.subscription as Record<string, unknown> | undefined
    const billing = data?.billing as Record<string, unknown> | undefined

    return (checkout?.externalId ??
      subscription?.externalId ??
      billing?.externalId ??
      data?.externalId) as string | undefined
  }

  private async syncPendingPaymentsBySubscription(subscriptionId: string) {
    const pendingPayments = await this.prisma.payment.findMany({
      where: {
        subscriptionId,
        status: PaymentStatus.pending,
        reference: { not: null },
      },
      select: { id: true, reference: true },
      take: 10,
    })

    for (const payment of pendingPayments) {
      if (!payment.reference) continue

      try {
        const checkout = await this.abacatepay.getCheckout(payment.reference)
        if (checkout.status === 'PAID') {
          await this.confirm(payment.id)
        }
      } catch {
        this.logger.warn('Could not sync pending payment')
      }
    }
  }
}
