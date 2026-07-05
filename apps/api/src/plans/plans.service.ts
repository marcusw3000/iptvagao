import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePlanDto, UpdatePlanDto } from './dto/create-plan.dto'

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(showAll = false) {
    return this.prisma.plan.findMany({
      where: showAll ? undefined : { active: true },
      orderBy: { price: 'asc' },
    })
  }

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } })
    if (!plan) throw new NotFoundException('Plano não encontrado')
    return plan
  }

  async create(dto: CreatePlanDto) {
    return this.prisma.plan.create({
      data: {
        name: dto.name,
        type: dto.type as any,
        price: dto.price,
        maxDevices: dto.maxDevices,
        maxChannels: dto.maxChannels,
      },
    })
  }

  async update(id: string, dto: UpdatePlanDto) {
    await this.findOne(id)
    return this.prisma.plan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.maxDevices !== undefined && { maxDevices: dto.maxDevices }),
        ...(dto.maxChannels !== undefined && { maxChannels: dto.maxChannels }),
      },
    })
  }

  async deactivate(id: string) {
    await this.findOne(id)
    return this.prisma.plan.update({ where: { id }, data: { active: false } })
  }

  async activatePlan(id: string) {
    await this.findOne(id)
    return this.prisma.plan.update({ where: { id }, data: { active: true } })
  }
}
