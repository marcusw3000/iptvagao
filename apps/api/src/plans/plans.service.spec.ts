import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { PlansService } from './plans.service'
import { PrismaService } from '../prisma/prisma.service'

const mockPlan = {
  id: 'plan-1',
  name: 'Básico',
  type: 'basic',
  price: '99.90',
  maxDevices: 5,
  storageGB: 10,
  maxChannels: 20,
  maxPlaylists: 5,
  maxUsers: 2,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('PlansService', () => {
  let service: PlansService
  let prisma: {
    plan: {
      findMany: jest.Mock
      findUnique: jest.Mock
      create: jest.Mock
      update: jest.Mock
    }
  }

  beforeEach(async () => {
    prisma = {
      plan: {
        findMany: jest.fn().mockResolvedValue([mockPlan]),
        findUnique: jest.fn().mockResolvedValue(mockPlan),
        create: jest.fn().mockResolvedValue(mockPlan),
        update: jest.fn().mockResolvedValue(mockPlan),
      },
    }

    const module = await Test.createTestingModule({
      providers: [PlansService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<PlansService>(PlansService)
  })

  it('findAll returns active plans array', async () => {
    const result = await service.findAll()
    expect(Array.isArray(result)).toBe(true)
    expect(result[0].id).toBe('plan-1')
    expect(result[0]).toHaveProperty('type')
  })

  it('findAll calls prisma with active:true filter by default', async () => {
    await service.findAll()
    expect(prisma.plan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    )
  })

  it('findAll returns all plans when showAll=true', async () => {
    await service.findAll(true)
    expect(prisma.plan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    )
  })

  it('findOne returns plan by id', async () => {
    const result = await service.findOne('plan-1')
    expect(result.id).toBe('plan-1')
  })

  it('findOne throws NotFoundException for unknown id', async () => {
    prisma.plan.findUnique.mockResolvedValue(null)
    await expect(service.findOne('bad')).rejects.toThrow(NotFoundException)
  })

  it('create returns new plan', async () => {
    const result = await service.create({
      name: 'Básico',
      type: 'basic',
      price: 99.9,
      maxDevices: 5,
      maxChannels: 20,
    })
    expect(result.id).toBe('plan-1')
    expect(prisma.plan.create).toHaveBeenCalled()
  })

  it('update calls prisma update with provided fields', async () => {
    await service.update('plan-1', { name: 'Premium', price: 199.9 })
    expect(prisma.plan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'plan-1' },
        data: expect.objectContaining({ name: 'Premium', price: 199.9 }),
      }),
    )
  })

  it('update throws NotFoundException for unknown id', async () => {
    prisma.plan.findUnique.mockResolvedValue(null)
    await expect(service.update('bad', { name: 'X' })).rejects.toThrow(NotFoundException)
  })

  it('deactivate sets active to false', async () => {
    await service.deactivate('plan-1')
    expect(prisma.plan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: false } }),
    )
  })

  it('deactivate throws NotFoundException for unknown id', async () => {
    prisma.plan.findUnique.mockResolvedValue(null)
    await expect(service.deactivate('bad')).rejects.toThrow(NotFoundException)
  })

  it('activatePlan sets active to true', async () => {
    await service.activatePlan('plan-1')
    expect(prisma.plan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { active: true } }),
    )
  })

  it('activatePlan throws NotFoundException for unknown id', async () => {
    prisma.plan.findUnique.mockResolvedValue(null)
    await expect(service.activatePlan('bad')).rejects.toThrow(NotFoundException)
  })
})
