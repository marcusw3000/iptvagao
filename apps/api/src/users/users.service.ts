import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserDto } from './dto/create-user.dto'

const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  role: true,
  clientId: true,
  resellerId: true,
  active: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const { password, ...data } = dto
    const hashed = await bcrypt.hash(password, 10)

    try {
      return await this.prisma.user.create({
        data: { ...data, password: hashed },
        select: USER_SELECT,
      })
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const target: string[] = e.meta?.target ?? []
        if (target.includes('clientId')) throw new ConflictException('Cliente já possui um usuário cadastrado')
        throw new ConflictException('Username já utilizado')
      }
      throw e
    }
  }

  async findAll({ page = 1, limit = 20, internalOnly }: { page: number; limit: number; internalOnly?: boolean }) {
    const skip = (page - 1) * limit
    const where = internalOnly
      ? { role: { in: ['master_admin', 'support', 'financial'] as any[] } }
      : undefined
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
        where,
      }),
      this.prisma.user.count({ where }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    })
    if (!user) throw new NotFoundException('Usuário não encontrado')
    return user
  }

  async deactivate(id: string) {
    await this.findOne(id)
    return this.prisma.user.update({ where: { id }, data: { active: false }, select: USER_SELECT })
  }

  async activateUser(id: string) {
    await this.findOne(id)
    return this.prisma.user.update({ where: { id }, data: { active: true }, select: USER_SELECT })
  }

  async generateClientCredentials(): Promise<{ username: string; password: string }> {
    const { randomBytes, randomInt } = await import('crypto')
    const letters = 'abcdefghijklmnopqrstuvwxyz'
    let username = ''

    for (let attempts = 0; attempts < 100; attempts++) {
      const candidate = Array.from(
        { length: 4 },
        () => letters[randomBytes(1)[0] % 26],
      ).join('')

      const exists = await this.prisma.user.findUnique({ where: { username: candidate } })
      if (!exists) {
        username = candidate
        break
      }
    }

    if (!username) {
      throw new Error('Could not generate unique username after 100 attempts')
    }

    const password = String(randomInt(100_000, 1_000_000))
    return { username, password }
  }
}
