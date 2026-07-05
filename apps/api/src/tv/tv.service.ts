import { Injectable, NotFoundException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import { ChannelsService } from '../channels/channels.service'
import { DevicesService, generateCode } from '../devices/devices.service'
import { EpgService } from '../epg/epg.service'

export interface DeviceTokenPayload {
  sub: string
  clientId: string
  kind: 'device'
}

@Injectable()
export class TvService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly channelsService: ChannelsService,
    private readonly devicesService: DevicesService,
    private readonly epgService: EpgService,
  ) {}

  async activate(activationCode: string, userAgent?: string) {
    const device = await this.prisma.device.findUnique({
      where: { activationCode: activationCode.toUpperCase().trim() },
    })
    if (!device) throw new NotFoundException('Código de ativação inválido')

    // Rotaciona o código após o resgate: código de ativação é de uso único
    const updated = await this.prisma.device.update({
      where: { id: device.id },
      data: {
        activated: true,
        activationCode: generateCode(6),
        userAgent: userAgent ?? device.userAgent,
        lastSeenAt: new Date(),
      },
      select: { id: true, clientId: true, name: true },
    })

    const payload: DeviceTokenPayload = { sub: updated.id, clientId: updated.clientId, kind: 'device' }
    const token = await this.jwtService.signAsync(payload, { expiresIn: '365d' })

    return { token, deviceId: updated.id, deviceName: updated.name }
  }

  async channelsForClient(clientId: string, deviceId: string) {
    const channels = await this.channelsService.findForClient(clientId)
    if (channels.length === 0) return channels

    const channelIds = channels.map((c) => c.id)
    const [favorites, epg] = await Promise.all([
      this.prisma.favorite.findMany({ where: { deviceId, channelId: { in: channelIds } }, select: { channelId: true } }),
      this.epgService.nowNextForChannels(channelIds),
    ])
    const favoriteIds = new Set(favorites.map((f) => f.channelId))

    return channels.map((c) => ({
      ...c,
      isFavorite: favoriteIds.has(c.id),
      epgNow: epg[c.id]?.now ?? null,
      epgNext: epg[c.id]?.next ?? null,
    }))
  }

  heartbeat(deviceId: string, ipAddress?: string) {
    return this.devicesService.heartbeat(deviceId, ipAddress)
  }

  async addFavorite(deviceId: string, channelId: string) {
    await this.prisma.favorite.upsert({
      where: { deviceId_channelId: { deviceId, channelId } },
      create: { deviceId, channelId },
      update: {},
    })
    return { channelId, isFavorite: true }
  }

  async removeFavorite(deviceId: string, channelId: string) {
    await this.prisma.favorite.deleteMany({ where: { deviceId, channelId } })
    return { channelId, isFavorite: false }
  }

  async accountInfo(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        name: true,
        subscription: {
          select: {
            status: true,
            endDate: true,
            plan: { select: { name: true } },
          },
        },
      },
    })
    if (!client) throw new NotFoundException('Cliente não encontrado')

    return {
      clientName: client.name,
      planName: client.subscription?.plan.name ?? null,
      subscriptionStatus: client.subscription?.status ?? null,
      subscriptionEndDate: client.subscription?.endDate ?? null,
    }
  }
}
