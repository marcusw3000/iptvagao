import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { FavoritesService } from './favorites.service'
import { PrismaService } from '../prisma/prisma.service'

describe('FavoritesService', () => {
  let service: FavoritesService
  let prisma: {
    favorite: {
      findMany: jest.Mock
      upsert: jest.Mock
      deleteMany: jest.Mock
    }
    subscription: {
      findUnique: jest.Mock
    }
    channel: {
      findFirst: jest.Mock
    }
  }

  beforeEach(async () => {
    prisma = {
      favorite: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      subscription: {
        findUnique: jest.fn().mockResolvedValue({ status: 'active', planId: 'plan-1' }),
      },
      channel: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ch-1' }),
      },
    }

    const module = await Test.createTestingModule({
      providers: [FavoritesService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get(FavoritesService)
  })

  it('annotates channels with isFavorite', async () => {
    prisma.favorite.findMany.mockResolvedValue([{ channelId: 'ch-1' }])

    const result = await service.annotateChannels('client-1', [
      { id: 'ch-1', name: 'Canal 1' },
      { id: 'ch-2', name: 'Canal 2' },
    ])

    expect(prisma.favorite.findMany).toHaveBeenCalledWith({
      where: { clientId: 'client-1', channelId: { in: ['ch-1', 'ch-2'] } },
      select: { channelId: true },
    })
    expect(result).toEqual([
      { id: 'ch-1', name: 'Canal 1', isFavorite: true },
      { id: 'ch-2', name: 'Canal 2', isFavorite: false },
    ])
  })

  it('adds a favorite for an accessible channel', async () => {
    const result = await service.addFavorite('client-1', 'ch-1')

    expect(prisma.channel.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'ch-1',
        active: true,
        plans: { some: { id: 'plan-1' } },
      },
      select: { id: true },
    })
    expect(prisma.favorite.upsert).toHaveBeenCalledWith({
      where: { clientId_channelId: { clientId: 'client-1', channelId: 'ch-1' } },
      create: { clientId: 'client-1', channelId: 'ch-1' },
      update: {},
    })
    expect(result).toEqual({ channelId: 'ch-1', isFavorite: true })
  })

  it('blocks addFavorite when client has no subscription', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null)
    await expect(service.addFavorite('client-1', 'ch-1')).rejects.toMatchObject({
      response: {
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Cliente sem assinatura ativa',
      },
      status: 403,
    })
  })

  it('blocks addFavorite when subscription is suspended', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ status: 'suspended', planId: 'plan-1' })
    await expect(service.addFavorite('client-1', 'ch-1')).rejects.toMatchObject({
      response: {
        code: 'SUBSCRIPTION_INACTIVE',
        message: 'Assinatura suspensa ou cancelada',
      },
      status: 403,
    })
  })

  it('blocks addFavorite when channel is not available in the plan', async () => {
    prisma.channel.findFirst.mockResolvedValue(null)
    await expect(service.addFavorite('client-1', 'bad')).rejects.toThrow(NotFoundException)
  })

  it('removes a favorite by client and channel', async () => {
    const result = await service.removeFavorite('client-1', 'ch-1')

    expect(prisma.favorite.deleteMany).toHaveBeenCalledWith({
      where: { clientId: 'client-1', channelId: 'ch-1' },
    })
    expect(result).toEqual({ channelId: 'ch-1', isFavorite: false })
  })
})
