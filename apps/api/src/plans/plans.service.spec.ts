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
  let prisma: { plan: { findMany: jest.Mock; findUnique: jest.Mock } }

  beforeEach(async () => {
    prisma = {
      plan: {
        findMany: jest.fn().mockResolvedValue([mockPlan]),
        findUnique: jest.fn().mockResolvedValue(mockPlan),
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

  it('findAll calls prisma with active:true filter', async () => {
    await service.findAll()
    expect(prisma.plan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
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
})
