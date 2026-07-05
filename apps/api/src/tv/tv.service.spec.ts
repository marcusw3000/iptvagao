import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { TvService } from './tv.service'
import { PrismaService } from '../prisma/prisma.service'
import { ChannelsService } from '../channels/channels.service'
import { DevicesService } from '../devices/devices.service'
import { EpgService } from '../epg/epg.service'

describe('TvService', () => {
  let service: TvService
  const prisma = {
    device: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    favorite: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    client: {
      findUnique: jest.fn(),
    },
  }
  const jwt = { signAsync: jest.fn().mockResolvedValue('device-token') }
  const channels = { findForClient: jest.fn() }
  const devices = { heartbeat: jest.fn() }
  const epg = { nowNextForChannels: jest.fn().mockResolvedValue({}) }

  beforeEach(async () => {
    jest.clearAllMocks()
    epg.nowNextForChannels.mockResolvedValue({})
    prisma.favorite.findMany.mockResolvedValue([])
    const module = await Test.createTestingModule({
      providers: [
        TvService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ChannelsService, useValue: channels },
        { provide: DevicesService, useValue: devices },
        { provide: EpgService, useValue: epg },
      ],
    }).compile()
    service = module.get(TvService)
  })

  describe('activate', () => {
    it('throws when activation code is unknown', async () => {
      prisma.device.findUnique.mockResolvedValue(null)
      await expect(service.activate('ABC123')).rejects.toThrow(NotFoundException)
    })

    it('normalizes code, activates device and returns token', async () => {
      prisma.device.findUnique.mockResolvedValue({ id: 'dev1', clientId: 'cli1', userAgent: null })
      prisma.device.update.mockResolvedValue({ id: 'dev1', clientId: 'cli1', name: 'Sala' })

      const result = await service.activate(' abc123 ', 'FireTV')

      expect(prisma.device.findUnique).toHaveBeenCalledWith({ where: { activationCode: 'ABC123' } })
      expect(prisma.device.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dev1' },
          data: expect.objectContaining({
            activated: true,
            userAgent: 'FireTV',
            // código rotacionado após o resgate (uso único)
            activationCode: expect.stringMatching(/^[A-Z2-9]{6}$/),
          }),
        }),
      )
      expect(jwt.signAsync).toHaveBeenCalledWith(
        { sub: 'dev1', clientId: 'cli1', kind: 'device' },
        { expiresIn: '365d' },
      )
      expect(result).toEqual({ token: 'device-token', deviceId: 'dev1', deviceName: 'Sala' })
    })
  })

  it('delegates channel listing to ChannelsService and returns empty list untouched', async () => {
    channels.findForClient.mockResolvedValue([])
    const result = await service.channelsForClient('cli1', 'dev1')
    expect(channels.findForClient).toHaveBeenCalledWith('cli1')
    expect(result).toEqual([])
  })

  it('enriches channels with favorite flag and EPG now/next', async () => {
    channels.findForClient.mockResolvedValue([{ id: 'ch1', name: 'Canal 1' }])
    prisma.favorite.findMany.mockResolvedValue([{ channelId: 'ch1' }])
    epg.nowNextForChannels.mockResolvedValue({ ch1: { now: { title: 'Jornal' }, next: null } })

    const result = await service.channelsForClient('cli1', 'dev1')

    expect(prisma.favorite.findMany).toHaveBeenCalledWith({
      where: { deviceId: 'dev1', channelId: { in: ['ch1'] } },
      select: { channelId: true },
    })
    expect(result).toEqual([
      { id: 'ch1', name: 'Canal 1', isFavorite: true, epgNow: { title: 'Jornal' }, epgNext: null },
    ])
  })

  it('delegates heartbeat to DevicesService', () => {
    devices.heartbeat.mockResolvedValue({})
    service.heartbeat('dev1', '1.2.3.4')
    expect(devices.heartbeat).toHaveBeenCalledWith('dev1', '1.2.3.4')
  })

  describe('favorites', () => {
    it('upserts a favorite for the device', async () => {
      prisma.favorite.upsert.mockResolvedValue({})
      const result = await service.addFavorite('dev1', 'ch1')
      expect(prisma.favorite.upsert).toHaveBeenCalledWith({
        where: { deviceId_channelId: { deviceId: 'dev1', channelId: 'ch1' } },
        create: { deviceId: 'dev1', channelId: 'ch1' },
        update: {},
      })
      expect(result).toEqual({ channelId: 'ch1', isFavorite: true })
    })

    it('removes a favorite for the device', async () => {
      prisma.favorite.deleteMany.mockResolvedValue({})
      const result = await service.removeFavorite('dev1', 'ch1')
      expect(prisma.favorite.deleteMany).toHaveBeenCalledWith({ where: { deviceId: 'dev1', channelId: 'ch1' } })
      expect(result).toEqual({ channelId: 'ch1', isFavorite: false })
    })
  })

  describe('accountInfo', () => {
    it('throws when client does not exist', async () => {
      prisma.client.findUnique.mockResolvedValue(null)
      await expect(service.accountInfo('cli1')).rejects.toThrow(NotFoundException)
    })

    it('returns client name with plan and subscription details when subscribed', async () => {
      prisma.client.findUnique.mockResolvedValue({
        name: 'João da Silva',
        subscription: {
          status: 'active',
          endDate: new Date('2026-12-31T00:00:00.000Z'),
          plan: { name: 'Premium' },
        },
      })

      const result = await service.accountInfo('cli1')

      expect(prisma.client.findUnique).toHaveBeenCalledWith({
        where: { id: 'cli1' },
        select: {
          name: true,
          subscription: {
            select: { status: true, endDate: true, plan: { select: { name: true } } },
          },
        },
      })
      expect(result).toEqual({
        clientName: 'João da Silva',
        planName: 'Premium',
        subscriptionStatus: 'active',
        subscriptionEndDate: new Date('2026-12-31T00:00:00.000Z'),
      })
    })

    it('returns nulls for plan/subscription fields when client has no subscription', async () => {
      prisma.client.findUnique.mockResolvedValue({ name: 'Cliente Sem Plano', subscription: null })

      const result = await service.accountInfo('cli1')

      expect(result).toEqual({
        clientName: 'Cliente Sem Plano',
        planName: null,
        subscriptionStatus: null,
        subscriptionEndDate: null,
      })
    })
  })
})
