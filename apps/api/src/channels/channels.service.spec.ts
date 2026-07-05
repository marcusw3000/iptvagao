import { Test } from '@nestjs/testing'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { ChannelsService } from './channels.service'
import { PrismaService } from '../prisma/prisma.service'

const mockChannel = {
  id: 'ch-1',
  categoryId: null,
  name: 'TV Globo',
  url: 'https://stream.example.com/globo.m3u8',
  logoUrl: null,
  order: 0,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  plans: [],
}

describe('ChannelsService', () => {
  let service: ChannelsService
  let prisma: {
    channel: {
      create: jest.Mock
      findMany: jest.Mock
      findUnique: jest.Mock
      update: jest.Mock
      delete: jest.Mock
      count: jest.Mock
    }
    subscription: { findUnique: jest.Mock }
    plan: { findMany: jest.Mock }
  }

  beforeEach(async () => {
    prisma = {
      channel: {
        create: jest.fn().mockResolvedValue(mockChannel),
        findMany: jest.fn().mockResolvedValue([mockChannel]),
        findUnique: jest.fn().mockResolvedValue(mockChannel),
        update: jest.fn().mockResolvedValue(mockChannel),
        delete: jest.fn().mockResolvedValue(mockChannel),
        count: jest.fn().mockResolvedValue(1),
      },
      subscription: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      plan: {
        findMany: jest.fn().mockResolvedValue([{ id: 'plan-1' }, { id: 'plan-2' }]),
      },
    }

    const module = await Test.createTestingModule({
      providers: [ChannelsService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<ChannelsService>(ChannelsService)
  })

  it('create returns new channel', async () => {
    const result = await service.create({ name: 'TV Globo', url: 'https://s.test/x.m3u8' })
    expect(result.name).toBe('TV Globo')
  })

  it('create defaults to all active plans when planIds not provided', async () => {
    await service.create({ name: 'TV Globo', url: 'https://s.test/x.m3u8' })
    expect(prisma.channel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plans: { connect: [{ id: 'plan-1' }, { id: 'plan-2' }] } }),
      }),
    )
  })

  it('create connects plans when planIds provided', async () => {
    await service.create({ name: 'TV Globo', url: 'https://s.test/x.m3u8', planIds: ['plan-1', 'plan-2'] })
    expect(prisma.channel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plans: { connect: [{ id: 'plan-1' }, { id: 'plan-2' }] } }),
      }),
    )
  })

  it('findAll returns paginated channels (global, no client scoping)', async () => {
    const result = await service.findAll({ page: 1, limit: 20 })
    expect(result).toHaveProperty('data')
    expect(result.total).toBe(1)
    expect(result.totalPages).toBe(1)
    expect(prisma.channel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { order: 'asc' } }),
    )
  })

  it('findForClient returns empty array when client has no subscription', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null)
    const result = await service.findForClient('client-1')
    expect(result).toEqual([])
  })

  it('findForClient throws ForbiddenException for suspended subscription', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ status: 'suspended', planId: 'plan-1' })
    await expect(service.findForClient('client-1')).rejects.toThrow(ForbiddenException)
  })

  it('findForClient returns channels available for the client plan', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ status: 'active', planId: 'plan-1' })
    const result = await service.findForClient('client-1')
    expect(result).toEqual([mockChannel])
    expect(prisma.channel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true, plans: { some: { id: 'plan-1' } } },
      }),
    )
  })

  it('findOne returns channel by id', async () => {
    const result = await service.findOne('ch-1')
    expect(result.id).toBe('ch-1')
  })

  it('findOne throws NotFoundException for unknown id', async () => {
    prisma.channel.findUnique.mockResolvedValue(null)
    await expect(service.findOne('bad')).rejects.toThrow(NotFoundException)
  })

  it('update calls findOne then updates with CHANNEL_SELECT', async () => {
    await service.update('ch-1', { name: 'SBT' })
    expect(prisma.channel.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ch-1' }, data: { name: 'SBT' } }),
    )
  })

  it('update replaces plan assignment when planIds provided', async () => {
    await service.update('ch-1', { planIds: ['plan-2'] })
    expect(prisma.channel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plans: { set: [{ id: 'plan-2' }] } }),
      }),
    )
  })

  it('remove deletes channel', async () => {
    await service.remove('ch-1')
    expect(prisma.channel.delete).toHaveBeenCalledWith({ where: { id: 'ch-1' } })
  })

  it('remove throws NotFoundException for unknown id', async () => {
    prisma.channel.findUnique.mockResolvedValue(null)
    await expect(service.remove('bad')).rejects.toThrow(NotFoundException)
  })
})
