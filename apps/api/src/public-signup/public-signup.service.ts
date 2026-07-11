import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ClientsService } from '../clients/clients.service'
import { PaymentsService } from '../payments/payments.service'
import { PlansService } from '../plans/plans.service'
import { ResellersService } from '../resellers/resellers.service'
import { SubscriptionsService } from '../subscriptions/subscriptions.service'
import { CreatePublicSignupDto } from './dto/create-public-signup.dto'

@Injectable()
export class PublicSignupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    private readonly paymentsService: PaymentsService,
    private readonly plansService: PlansService,
    private readonly resellersService: ResellersService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async resolveReferralCode(referralCode: string) {
    const normalized = referralCode.trim().toUpperCase()
    if (!normalized) {
      return { valid: false as const, referralCode: normalized }
    }

    const reseller = await this.resellersService.findByReferralCode(normalized)
    if (!reseller || !reseller.active) {
      return { valid: false as const, referralCode: normalized }
    }

    return {
      valid: true as const,
      resellerId: reseller.id,
      resellerName: reseller.name,
      referralCode: reseller.referralCode,
    }
  }

  async listPlans() {
    const plans = await this.plansService.findPublicPlans()
    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      type: plan.type,
      price: plan.price,
    }))
  }

  async onboard(dto: CreatePublicSignupDto) {
    const normalizedDocument = dto.document.replace(/\D/g, '')
    if (!this.isValidCpf(normalizedDocument)) {
      throw new BadRequestException('CPF invalido')
    }

    const referral = await this.resolveReferralCode(dto.referralCode)
    if (!referral.valid) {
      throw new BadRequestException('Codigo de indicacao invalido')
    }

    const plan = await this.plansService.findActivePlan(dto.planId)
    if (!plan) {
      throw new NotFoundException('Plano nao encontrado')
    }

    let clientId: string | null = null
    let subscriptionId: string | null = null

    try {
      const { client, credentials } = await this.clientsService.create({
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        document: normalizedDocument,
        resellerId: referral.resellerId,
      }, {
        username: dto.email.trim().toLowerCase(),
        password: dto.password,
        email: dto.email.trim().toLowerCase(),
      })
      clientId = client.id

      const subscription = await this.subscriptionsService.create({
        clientId: client.id,
        planId: plan.id,
      })
      subscriptionId = subscription.id

      const checkout = await this.paymentsService.createCheckout(subscription.id)

      return {
        clientId: client.id,
        subscriptionId: subscription.id,
        credentials,
        checkoutUrl: checkout.checkoutUrl,
        paymentId: checkout.paymentId,
        plan: {
          id: plan.id,
          name: plan.name,
          type: plan.type,
          price: plan.price,
        },
        reseller: {
          id: referral.resellerId,
          name: referral.resellerName,
          referralCode: referral.referralCode,
        },
      }
    } catch (error) {
      if (subscriptionId || clientId) {
        await this.cleanupPartialSignup({ clientId, subscriptionId })
      }
      throw error instanceof BadRequestException || error instanceof NotFoundException
        ? error
        : error
    }
  }

  private async cleanupPartialSignup({
    clientId,
    subscriptionId,
  }: {
    clientId: string | null
    subscriptionId: string | null
  }) {
    try {
      await this.prisma.$transaction(async (tx) => {
        if (subscriptionId) {
          await tx.payment.deleteMany({ where: { subscriptionId } })
          await tx.subscription.deleteMany({ where: { id: subscriptionId } })
        }
        if (clientId) {
          await tx.user.deleteMany({ where: { clientId } })
          await tx.client.deleteMany({ where: { id: clientId } })
        }
      })
    } catch {
      throw new InternalServerErrorException('Falha ao reverter cadastro publico incompleto')
    }
  }

  private isValidCpf(value: string) {
    if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) {
      return false
    }

    const digits = value.split('').map(Number)
    const calcCheckDigit = (sliceLength: number) => {
      const sum = digits
        .slice(0, sliceLength)
        .reduce((acc, digit, index) => acc + digit * (sliceLength + 1 - index), 0)
      const remainder = (sum * 10) % 11
      return remainder === 10 ? 0 : remainder
    }

    return calcCheckDigit(9) === digits[9] && calcCheckDigit(10) === digits[10]
  }
}
