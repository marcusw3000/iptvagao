import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { ChannelsService } from './channels.service'
import { PrismaService } from '../prisma/prisma.service'

const mockChannel = {
  id: 'ch-1',
  clientId: 'client-1',
  categoryId: null,
  name: 'TV Globo',
  url: 'https://stream.example.com/globo.m3u8',
  logoUrl: null,
  order: 0,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
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
    }

    const module = await Test.createTestingModule({
      providers: [ChannelsService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<ChannelsService>(ChannelsService)
  })

  it('create returns new channel', async () => {
    const result = await service.create({ clientId: 'client-1', name: 'TV Globo', url: 'https://s.test/x.m3u8' })
    expect(result.name).toBe('TV Globo')
    expect(result.clientId).toBe('client-1')
  })

  it('findByClient returns paginated channels ordered by order asc', async () => {
    const result = await service.findByClient('client-1', { page: 1, limit: 20 })
    expect(result).toHaveProperty('data')
    expect(result.data[0].clientId).toBe('client-1')
    expect(result.total).toBe(1)
    expect(result.totalPages).toBe(1)
    expect(prisma.channel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: 'client-1' }, orderBy: { order: 'asc' } }),
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

  it('remove deletes channel', async () => {
    await service.remove('ch-1')
    expect(prisma.channel.delete).toHaveBeenCalledWith({ where: { id: 'ch-1' } })
  })

  it('remove throws NotFoundException for unknown id', async () => {
    prisma.channel.findUnique.mockResolvedValue(null)
    await expect(service.remove('bad')).rejects.toThrow(NotFoundException)
  })
})
