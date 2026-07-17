import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { tvErrors } from '../tv/tv.errors'

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async annotateChannels<T extends { id: string }>(clientId: string, channels: T[]) {
    if (channels.length === 0) {
      return channels.map((channel) => ({ ...channel, isFavorite: false }))
    }

    const favorites = await this.prisma.favorite.findMany({
      where: { clientId, channelId: { in: channels.map((channel) => channel.id) } },
      select: { channelId: true },
    })
    const favoriteIds = new Set(favorites.map((favorite) => favorite.channelId))

    return channels.map((channel) => ({
      ...channel,
      isFavorite: favoriteIds.has(channel.id),
    }))
  }

  async addFavorite(clientId: string, channelId: string) {
    const planId = await this.getAccessiblePlanId(clientId)
    const channel = await this.prisma.channel.findFirst({
      where: {
        id: channelId,
        active: true,
        plans: { some: { id: planId } },
      },
      select: { id: true },
    })
    if (!channel) throw new NotFoundException('Canal não disponível para este cliente')

    await this.prisma.favorite.upsert({
      where: { clientId_channelId: { clientId, channelId } },
      create: { clientId, channelId },
      update: {},
    })

    return { channelId, isFavorite: true }
  }

  async removeFavorite(clientId: string, channelId: string) {
    await this.prisma.favorite.deleteMany({ where: { clientId, channelId } })
    return { channelId, isFavorite: false }
  }

  private async getAccessiblePlanId(clientId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { clientId },
      select: { status: true, planId: true },
    })

    if (!subscription) throw tvErrors.subscriptionRequired()
    if (subscription.status === 'suspended' || subscription.status === 'cancelled') {
      throw tvErrors.subscriptionInactive()
    }

    return subscription.planId
  }
}
