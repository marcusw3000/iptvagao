import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { DevicesService } from './devices.service'
import { PrismaService } from '../prisma/prisma.service'

const mockDevice = {
  id: 'device-1',
  clientId: 'client-1',
  name: 'TV Recepção',
  activationCode: 'ABC123',
  activated: false,
  lastSeenAt: null,
  ipAddress: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('DevicesService', () => {
  let service: DevicesService
  let prisma: {
    device: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; count: jest.Mock }
    activationCode: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock }
  }

  beforeEach(async () => {
    prisma = {
      device: {
        create: jest.fn().mockResolvedValue(mockDevice),
        findMany: jest.fn().mockResolvedValue([mockDevice]),
        findUnique: jest.fn().mockResolvedValue(mockDevice),
        update: jest.fn().mockResolvedValue(mockDevice),
        count: jest.fn().mockResolvedValue(1),
      },
      activationCode: {
        create: jest.fn().mockResolvedValue({ id: 'ac-1', code: 'XY9Z12', expiresAt: new Date(Date.now() + 600_000) }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
    }

    const module = await Test.createTestingModule({
      providers: [DevicesService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<DevicesService>(DevicesService)
  })

  it('create returns device with auto-generated activationCode', async () => {
    const result = await service.create({ clientId: 'client-1', name: 'TV Sala' })
    expect(result.id).toBe('device-1')
    expect(prisma.device.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clientId: 'client-1', name: 'TV Sala', activationCode: expect.any(String) }),
      }),
    )
  })

  it('findByClient returns paginated devices for clientId', async () => {
    const result = await service.findByClient('client-1', { page: 1, limit: 20 })
    expect(result).toHaveProperty('data')
    expect(result.data[0].clientId).toBe('client-1')
    expect(result.total).toBe(1)
    expect(result.totalPages).toBe(1)
  })

  it('findOne throws NotFoundException for unknown device', async () => {
    prisma.device.findUnique.mockResolvedValue(null)
    await expect(service.findOne('bad')).rejects.toThrow(NotFoundException)
  })

  it('generateActivationCode creates code with 10-min expiry', async () => {
    prisma.device.findUnique.mockResolvedValue(mockDevice)
    const result = await service.generateActivationCode('device-1')
    expect(result).toHaveProperty('code')
    expect(result).toHaveProperty('expiresAt')
    expect(prisma.activationCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deviceId: 'device-1', code: expect.any(String) }),
      }),
    )
  })

  it('activate throws NotFoundException for invalid code', async () => {
    prisma.activationCode.findUnique.mockResolvedValue(null)
    await expect(service.activate('BADCODE')).rejects.toThrow(NotFoundException)
  })

  it('activate throws NotFoundException for expired code', async () => {
    prisma.activationCode.findUnique.mockResolvedValue({
      id: 'ac-1', code: 'XY9Z12', deviceId: 'device-1',
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    })
    await expect(service.activate('XY9Z12')).rejects.toThrow(NotFoundException)
  })
})
