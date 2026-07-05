import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { TvService } from './tv.service'
import { PrismaService } from '../prisma/prisma.service'
import { ChannelsService } from '../channels/channels.service'
import { DevicesService } from '../devices/devices.service'

describe('TvService', () => {
  let service: TvService
  const prisma = {
    device: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  }
  const jwt = { signAsync: jest.fn().mockResolvedValue('device-token') }
  const channels = { findForClient: jest.fn() }
  const devices = { heartbeat: jest.fn() }

  beforeEach(async () => {
    jest.clearAllMocks()
    const module = await Test.createTestingModule({
      providers: [
        TvService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ChannelsService, useValue: channels },
        { provide: DevicesService, useValue: devices },
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

  it('delegates channel listing to ChannelsService', () => {
    channels.findForClient.mockResolvedValue([])
    service.channelsForClient('cli1')
    expect(channels.findForClient).toHaveBeenCalledWith('cli1')
  })

  it('delegates heartbeat to DevicesService', () => {
    devices.heartbeat.mockResolvedValue({})
    service.heartbeat('dev1', '1.2.3.4')
    expect(devices.heartbeat).toHaveBeenCalledWith('dev1', '1.2.3.4')
  })
})
