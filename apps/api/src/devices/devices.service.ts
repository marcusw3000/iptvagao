import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateDeviceDto } from './dto/create-device.dto'

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

const DEVICE_SELECT = {
  id: true,
  clientId: true,
  name: true,
  activationCode: true,
  activated: true,
  lastSeenAt: true,
  ipAddress: true,
  createdAt: true,
  updatedAt: true,
} as const

export function generateCode(length: number): string {
  const { randomBytes } = require('crypto') as typeof import('crypto')
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => chars[randomBytes(1)[0] % chars.length]).join('')
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDeviceDto) {
    const activationCode = generateCode(6)
    return this.prisma.device.create({
      data: { ...dto, activationCode, activated: true },
      select: DEVICE_SELECT,
    })
  }

  async selfRegister(clientId: string, name?: string) {
    const activationCode = generateCode(6)
    return this.prisma.device.create({
      data: { clientId, name: name ?? 'TV', activationCode, activated: true },
      select: DEVICE_SELECT,
    })
  }

  async findByClient(clientId: string, { page = 1, limit = 20 }: { page: number; limit: number }) {
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.device.findMany({
        where: { clientId },
        skip,
        take: limit,
        select: DEVICE_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.device.count({ where: { clientId } }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id }, select: DEVICE_SELECT })
    if (!device) throw new NotFoundException('Dispositivo não encontrado')
    return device
  }

  async heartbeat(deviceId: string, ipAddress?: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } })
    if (!device) throw new NotFoundException('Dispositivo não encontrado')
    if (!device.activated) throw new ForbiddenException('Dispositivo não ativado')

    const subscription = await this.prisma.subscription.findUnique({
      where: { clientId: device.clientId },
      select: {
        status: true,
        plan: {
          select: {
            maxDevices: true,
          },
        },
      },
    })

    if (subscription) {
      if (subscription.status === 'suspended' || subscription.status === 'cancelled') {
        throw new ForbiddenException('Assinatura suspensa ou cancelada')
      }

      const limit = Math.max(subscription.plan.maxDevices ?? 1, 1)
      const onlineThreshold = new Date(Date.now() - ONLINE_THRESHOLD_MS)
      const onlineCount = await this.prisma.device.count({
        where: {
          clientId: device.clientId,
          activated: true,
          lastSeenAt: { gte: onlineThreshold },
          id: { not: deviceId },
        },
      })
      if (onlineCount >= limit) {
        throw new ForbiddenException(`Limite de ${limit} TV(s) simultânea(s) atingido`)
      }
    }

    return this.prisma.device.update({
      where: { id: deviceId },
      data: { lastSeenAt: new Date(), ipAddress: ipAddress ?? null },
      select: DEVICE_SELECT,
    })
  }

  async findAllForMonitoring({ page = 1, limit = 50 }: { page: number; limit: number }) {
    const onlineThreshold = new Date(Date.now() - ONLINE_THRESHOLD_MS)
    const skip = (page - 1) * limit
    const [devices, total] = await Promise.all([
      this.prisma.device.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          clientId: true,
          name: true,
          activationCode: true,
          activated: true,
          lastSeenAt: true,
          ipAddress: true,
          createdAt: true,
          updatedAt: true,
          client: { select: { id: true, name: true } },
        },
        orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.device.count(),
    ])

    const data = devices.map((d) => ({
      ...d,
      online: d.activated && !!d.lastSeenAt && d.lastSeenAt >= onlineThreshold,
    }))

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      onlineCount: data.filter((d) => d.online).length,
    }
  }

  async remove(id: string) {
    await this.findOne(id)
    await this.prisma.device.delete({ where: { id } })
  }
}
