import { Test } from '@nestjs/testing'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
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

const mockActivatedDevice = { ...mockDevice, activated: true }
const mockSubscription = { plan: { type: 'basic' } }

describe('DevicesService', () => {
  let service: DevicesService
  let prisma: {
    device: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; count: jest.Mock; delete: jest.Mock }
    subscription: { findUnique: jest.Mock }
  }

  beforeEach(async () => {
    prisma = {
      device: {
        create: jest.fn().mockResolvedValue(mockDevice),
        findMany: jest.fn().mockResolvedValue([mockDevice]),
        findUnique: jest.fn().mockResolvedValue(mockDevice),
        update: jest.fn().mockResolvedValue(mockActivatedDevice),
        count: jest.fn().mockResolvedValue(1),
        delete: jest.fn().mockResolvedValue(mockDevice),
      },
      subscription: {
        findUnique: jest.fn().mockResolvedValue(mockSubscription),
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

  it('selfRegister creates already-activated device', async () => {
    const result = await service.selfRegister('client-1', 'TV Sala')
    expect(result.id).toBe('device-1')
    expect(prisma.device.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clientId: 'client-1', name: 'TV Sala', activated: true, activationCode: expect.any(String) }),
      }),
    )
  })

  it('heartbeat throws NotFoundException for unknown device', async () => {
    prisma.device.findUnique.mockResolvedValue(null)
    await expect(service.heartbeat('bad')).rejects.toThrow(NotFoundException)
  })

  it('heartbeat throws ForbiddenException for non-activated device', async () => {
    prisma.device.findUnique.mockResolvedValue(mockDevice)
    await expect(service.heartbeat('device-1')).rejects.toThrow(ForbiddenException)
  })

  it('heartbeat throws ForbiddenException when concurrent limit reached (basic=1)', async () => {
    prisma.device.findUnique.mockResolvedValue(mockActivatedDevice)
    prisma.device.count.mockResolvedValue(1)
    await expect(service.heartbeat('device-1')).rejects.toThrow(ForbiddenException)
  })

  it('heartbeat updates lastSeenAt when within limit', async () => {
    prisma.device.findUnique.mockResolvedValue(mockActivatedDevice)
    prisma.device.count.mockResolvedValue(0)
    const result = await service.heartbeat('device-1', '192.168.1.1')
    expect(prisma.device.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastSeenAt: expect.any(Date) }) }),
    )
    expect(result.activated).toBe(true)
  })

  it('heartbeat allows 4 concurrent TVs on premium plan', async () => {
    prisma.device.findUnique.mockResolvedValue(mockActivatedDevice)
    prisma.subscription.findUnique.mockResolvedValue({ plan: { type: 'premium' } })
    prisma.device.count.mockResolvedValue(3)
    await expect(service.heartbeat('device-1')).resolves.toBeDefined()
  })

  it('findAllForMonitoring returns data with online flag', async () => {
    const recentDevice = { ...mockActivatedDevice, lastSeenAt: new Date(), client: { id: 'c1', name: 'Empresa' } }
    prisma.device.findMany.mockResolvedValue([recentDevice])
    prisma.device.count.mockResolvedValue(1)
    const result = await service.findAllForMonitoring({ page: 1, limit: 50 })
    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('onlineCount')
    expect(result.data[0]).toHaveProperty('online')
  })

  it('remove deletes device and returns nothing', async () => {
    prisma.device.findUnique.mockResolvedValue(mockDevice)
    await service.remove('device-1')
    expect(prisma.device.delete).toHaveBeenCalledWith({ where: { id: 'device-1' } })
  })

  it('remove throws NotFoundException for unknown device', async () => {
    prisma.device.findUnique.mockResolvedValue(null)
    await expect(service.remove('bad')).rejects.toThrow(NotFoundException)
  })
})
