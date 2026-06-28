import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { WithdrawalStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateResellerDto } from './dto/create-reseller.dto'
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto'

const RESELLER_SELECT = {
  id: true,
  name: true,
  email: true,
  commissionPct: true,
  active: true,
  referralCode: true,
  createdAt: true,
  updatedAt: true,
} as const

const COMMISSION_SELECT = {
  id: true,
  resellerId: true,
  paymentId: true,
  amount: true,
  paid: true,
  createdAt: true,
} as const

const WITHDRAWAL_SELECT = {
  id: true,
  resellerId: true,
  amount: true,
  status: true,
  pixKey: true,
  processedAt: true,
  createdAt: true,
} as const

@Injectable()
export class ResellersService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertReseller(id: string) {
    const reseller = await this.prisma.reseller.findUnique({ where: { id } })
    if (!reseller) throw new NotFoundException('Revendedor não encontrado')
    return reseller
  }

  private async assertWithdrawal(resellerId: string, withdrawalId: string) {
    const wd = await this.prisma.resellerWithdrawal.findUnique({
      where: { id: withdrawalId },
    })
    if (!wd || wd.resellerId !== resellerId)
      throw new NotFoundException('Saque não encontrado')
    return wd
  }

  async create(dto: CreateResellerDto) {
    const exists = await this.prisma.reseller.findUnique({
      where: { email: dto.email },
    })
    if (exists) throw new ConflictException('Email já utilizado')

    return this.prisma.reseller.create({
      data: {
        name: dto.name,
        email: dto.email,
        ...(dto.commissionPct !== undefined && {
          commissionPct: dto.commissionPct,
        }),
      },
      select: RESELLER_SELECT,
    })
  }

  async findAll({ page = 1, limit = 20 }: { page: number; limit: number }) {
    const skip = (page - 1) * limit
    const [resellers, total] = await Promise.all([
      this.prisma.reseller.findMany({
        skip,
        take: limit,
        select: RESELLER_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reseller.count(),
    ])

    const data = await Promise.all(
      resellers.map(async (r) => {
        const clientCount = await this.prisma.client.count({
          where: { resellerId: r.id },
        })
        return { ...r, clientCount }
      }),
    )

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string) {
    const reseller = await this.prisma.reseller.findUnique({
      where: { id },
      select: RESELLER_SELECT,
    })
    if (!reseller) throw new NotFoundException('Revendedor não encontrado')

    const [clientCount, commissionsAgg, withdrawalsAgg] = await Promise.all([
      this.prisma.client.count({ where: { resellerId: id } }),
      this.prisma.resellerCommission.aggregate({
        where: { resellerId: id },
        _sum: { amount: true },
      }),
      this.prisma.resellerWithdrawal.aggregate({
        where: { resellerId: id, status: WithdrawalStatus.pending },
        _sum: { amount: true },
      }),
    ])

    return {
      ...reseller,
      clientCount,
      totalCommissions: commissionsAgg._sum.amount?.toString() ?? '0',
      pendingWithdrawalAmount: withdrawalsAgg._sum.amount?.toString() ?? '0',
    }
  }

  async suspend(id: string) {
    await this.assertReseller(id)
    return this.prisma.reseller.update({
      where: { id },
      data: { active: false },
      select: RESELLER_SELECT,
    })
  }

  async activate(id: string) {
    await this.assertReseller(id)
    return this.prisma.reseller.update({
      where: { id },
      data: { active: true },
      select: RESELLER_SELECT,
    })
  }

  async findCommissions(
    resellerId: string,
    { page = 1, limit = 20 }: { page: number; limit: number },
  ) {
    await this.assertReseller(resellerId)
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.resellerCommission.findMany({
        where: { resellerId },
        skip,
        take: limit,
        select: COMMISSION_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.resellerCommission.count({ where: { resellerId } }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async requestWithdrawal(resellerId: string, dto: CreateWithdrawalDto) {
    await this.assertReseller(resellerId)
    return this.prisma.resellerWithdrawal.create({
      data: {
        resellerId,
        amount: dto.amount,
        status: WithdrawalStatus.pending,
        ...(dto.pixKey && { pixKey: dto.pixKey }),
      },
      select: WITHDRAWAL_SELECT,
    })
  }

  async findWithdrawals(
    resellerId: string,
    { page = 1, limit = 20 }: { page: number; limit: number },
  ) {
    await this.assertReseller(resellerId)
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.resellerWithdrawal.findMany({
        where: { resellerId },
        skip,
        take: limit,
        select: WITHDRAWAL_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.resellerWithdrawal.count({ where: { resellerId } }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async approveWithdrawal(resellerId: string, withdrawalId: string) {
    await this.assertReseller(resellerId)
    await this.assertWithdrawal(resellerId, withdrawalId)
    return this.prisma.resellerWithdrawal.update({
      where: { id: withdrawalId },
      data: { status: WithdrawalStatus.approved, processedAt: new Date() },
      select: WITHDRAWAL_SELECT,
    })
  }

  async rejectWithdrawal(resellerId: string, withdrawalId: string) {
    await this.assertReseller(resellerId)
    await this.assertWithdrawal(resellerId, withdrawalId)
    return this.prisma.resellerWithdrawal.update({
      where: { id: withdrawalId },
      data: { status: WithdrawalStatus.rejected, processedAt: new Date() },
      select: WITHDRAWAL_SELECT,
    })
  }
}
