import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { CategoriesService } from './categories.service'
import { PrismaService } from '../prisma/prisma.service'

const mockCategory = {
  id: 'cat-1',
  clientId: 'client-1',
  name: 'Filmes',
  order: 0,
  createdAt: new Date(),
}

describe('CategoriesService', () => {
  let service: CategoriesService
  let prisma: {
    category: {
      create: jest.Mock
      findMany: jest.Mock
      findUnique: jest.Mock
      update: jest.Mock
      delete: jest.Mock
    }
  }

  beforeEach(async () => {
    prisma = {
      category: {
        create: jest.fn().mockResolvedValue(mockCategory),
        findMany: jest.fn().mockResolvedValue([mockCategory]),
        findUnique: jest.fn().mockResolvedValue(mockCategory),
        update: jest.fn().mockResolvedValue(mockCategory),
        delete: jest.fn().mockResolvedValue(mockCategory),
      },
    }

    const module = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<CategoriesService>(CategoriesService)
  })

  it('create returns new category', async () => {
    const result = await service.create({ clientId: 'client-1', name: 'Filmes' })
    expect(result.name).toBe('Filmes')
    expect(result.clientId).toBe('client-1')
  })

  it('findByClient returns categories ordered by order asc', async () => {
    const result = await service.findByClient('client-1')
    expect(result[0].clientId).toBe('client-1')
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: 'client-1' }, orderBy: { order: 'asc' } }),
    )
  })

  it('findOne returns category by id', async () => {
    const result = await service.findOne('cat-1')
    expect(result.id).toBe('cat-1')
  })

  it('findOne throws NotFoundException for unknown id', async () => {
    prisma.category.findUnique.mockResolvedValue(null)
    await expect(service.findOne('bad')).rejects.toThrow(NotFoundException)
  })

  it('update calls findOne then updates', async () => {
    await service.update('cat-1', { name: 'Séries' })
    expect(prisma.category.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cat-1' }, data: { name: 'Séries' } }),
    )
  })

  it('remove deletes category', async () => {
    await service.remove('cat-1')
    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } })
  })

  it('remove throws NotFoundException for unknown id', async () => {
    prisma.category.findUnique.mockResolvedValue(null)
    await expect(service.remove('bad')).rejects.toThrow(NotFoundException)
  })
})
