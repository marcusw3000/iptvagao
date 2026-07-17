import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateDeviceDto } from './dto/create-device.dto'
import { tvErrors } from '../tv/tv.errors'

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

const DEVICE_SELECT = {
  id: true,
  clientId: true,
  name: true,
  activationCode: true,
  activated: true,
  lastSeenAt: true,
  ipAddress: true,
  userAgent: true,
  createdAt: true,
  updatedAt: true,
} as const

type DeviceRecord = {
  activated: boolean
  lastSeenAt: Date | null
  userAgent?: string | null
}

export function generateCode(length: number): string {
  const { randomBytes } = require('crypto') as typeof import('crypto')
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => chars[randomBytes(1)[0] % chars.length]).join('')
}

function isOnline(device: DeviceRecord, now = Date.now()) {
  if (!device.activated || !device.lastSeenAt) return false
  return now - device.lastSeenAt.getTime() < ONLINE_THRESHOLD_MS
}

function operationalStatus(device: DeviceRecord, now = Date.now()) {
  if (!device.activated) return 'pending'
  return isOnline(device, now) ? 'online' : 'offline'
}

function parseDeviceSignature(userAgent?: string | null) {
  if (!userAgent) {
    return {
      appVersion: null,
      deviceModel: null,
      appEnvironment: null,
    }
  }

  const versionMatch = userAgent.match(/^iptvagao-tv\/([^\s]+)\s+\((.*?)\)\s+env\/(.+)$/i)
  if (!versionMatch) {
    return {
      appVersion: null,
      deviceModel: userAgent,
      appEnvironment: null,
    }
  }

  return {
    appVersion: versionMatch[1] || null,
    deviceModel: versionMatch[2] || null,
    appEnvironment: versionMatch[3] || null,
  }
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  private enrichDevice<T extends DeviceRecord>(device: T, now = Date.now()) {
    const signature = parseDeviceSignature(device.userAgent)
    return {
      ...device,
      online: isOnline(device, now),
      operationalStatus: operationalStatus(device, now),
      appVersion: signature.appVersion,
      deviceModel: signature.deviceModel,
      appEnvironment: signature.appEnvironment,
    }
  }

  async create(dto: CreateDeviceDto) {
    const activationCode = generateCode(6)
    const device = await this.prisma.device.create({
      data: { ...dto, activationCode, activated: true },
      select: DEVICE_SELECT,
    })
    return this.enrichDevice(device)
  }

  async selfRegister(clientId: string, name?: string) {
    const activationCode = generateCode(6)
    const device = await this.prisma.device.create({
      data: { clientId, name: name ?? 'TV', activationCode, activated: true },
      select: DEVICE_SELECT,
    })
    return this.enrichDevice(device)
  }

  async findByClient(clientId: string, { page = 1, limit = 20 }: { page: number; limit: number }) {
    const skip = (page - 1) * limit
    const [devices, total] = await Promise.all([
      this.prisma.device.findMany({
        where: { clientId },
        skip,
        take: limit,
        select: DEVICE_SELECT,
        orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.device.count({ where: { clientId } }),
    ])
    const now = Date.now()
    return {
      data: devices.map((device) => this.enrichDevice(device, now)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async findOne(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id }, select: DEVICE_SELECT })
    if (!device) throw new NotFoundException('Dispositivo nao encontrado')
    return this.enrichDevice(device)
  }

  async heartbeat(deviceId: string, ipAddress?: string, userAgent?: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } })
    if (!device) throw new NotFoundException('Dispositivo nao encontrado')
    if (!device.activated) throw new ForbiddenException('Dispositivo nao ativado')

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
        throw tvErrors.subscriptionInactive()
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
        throw tvErrors.tvLimitReached(limit)
      }
    }

    const updated = await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        lastSeenAt: new Date(),
        ipAddress: ipAddress ?? null,
        ...(userAgent ? { userAgent } : {}),
      },
      select: DEVICE_SELECT,
    })
    return this.enrichDevice(updated)
  }

  async findAllForMonitoring({ page = 1, limit = 50 }: { page: number; limit: number }) {
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
          userAgent: true,
          createdAt: true,
          updatedAt: true,
          client: { select: { id: true, name: true } },
        },
        orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.device.count(),
    ])

    const now = Date.now()
    const data = devices.map((device) => this.enrichDevice(device, now))

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      onlineCount: data.filter((device) => device.online).length,
    }
  }

  async remove(id: string) {
    await this.findOne(id)
    await this.prisma.device.delete({ where: { id } })
  }
}
