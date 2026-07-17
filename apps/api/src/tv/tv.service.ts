import { Injectable, NotFoundException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import { ChannelsService } from '../channels/channels.service'
import { FavoritesService } from '../channels/favorites.service'
import { DevicesService, generateCode } from '../devices/devices.service'
import { EpgService } from '../epg/epg.service'
import { tvErrors } from './tv.errors'

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
    private readonly favoritesService: FavoritesService,
    private readonly devicesService: DevicesService,
    private readonly epgService: EpgService,
  ) {}

  async activate(activationCode: string, userAgent?: string) {
    const device = await this.prisma.device.findUnique({
      where: { activationCode: activationCode.toUpperCase().trim() },
    })
    if (!device) throw tvErrors.activationCodeInvalid()

    // Rotaciona o codigo apos o resgate: codigo de ativacao e de uso unico.
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

  async channelsForClient(clientId: string) {
    const channels = await this.channelsService.findForClient(clientId)
    if (channels.length === 0) return channels

    const channelIds = channels.map((c) => c.id)
    const [favoriteChannels, epg] = await Promise.all([
      this.favoritesService.annotateChannels(clientId, channels),
      this.epgService.nowNextForChannels(channelIds),
    ])

    return favoriteChannels.map((c) => ({
      ...c,
      epgNow: epg[c.id]?.now ?? null,
      epgNext: epg[c.id]?.next ?? null,
    }))
  }

  heartbeat(deviceId: string, ipAddress?: string, userAgent?: string) {
    return this.devicesService.heartbeat(deviceId, ipAddress, userAgent)
  }

  async addFavorite(clientId: string, channelId: string) {
    return this.favoritesService.addFavorite(clientId, channelId)
  }

  async removeFavorite(clientId: string, channelId: string) {
    return this.favoritesService.removeFavorite(clientId, channelId)
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
    if (!client) throw new NotFoundException('Cliente nao encontrado')

    return {
      clientName: client.name,
      planName: client.subscription?.plan.name ?? null,
      subscriptionStatus: client.subscription?.status ?? null,
      subscriptionEndDate: client.subscription?.endDate ?? null,
    }
  }
}
