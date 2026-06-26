import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { UsersService } from '../users/users.service'
import { CreateClientDto } from './dto/create-client.dto'
import { UpdateClientDto } from './dto/update-client.dto'

const CLIENT_SELECT = {
  id: true,
  name: true,
  email: true,
  document: true,
  phone: true,
  active: true,
  resellerId: true,
  createdAt: true,
  updatedAt: true,
} as const

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateClientDto) {
    const exists = await this.prisma.client.findUnique({ where: { email: dto.email } })
    if (exists) throw new ConflictException('Email já utilizado')

    const credentials = await this.usersService.generateClientCredentials()

    const client = await this.prisma.client.create({
      data: dto,
      select: CLIENT_SELECT,
    })

    try {
      await this.usersService.create({
        username: credentials.username,
        password: credentials.password,
        role: UserRole.client_admin,
        clientId: client.id,
      })
    } catch (err) {
      await this.prisma.client.delete({ where: { id: client.id } })
      throw err
    }

    return { client, credentials }
  }

  async findAll({ page = 1, limit = 20 }: { page: number; limit: number }) {
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        skip,
        take: limit,
        select: CLIENT_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.count(),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id }, select: CLIENT_SELECT })
    if (!client) throw new NotFoundException('Cliente não encontrado')
    return client
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id)
    return this.prisma.client.update({ where: { id }, data: dto, select: CLIENT_SELECT })
  }

  async suspend(id: string) {
    await this.findOne(id)
    return this.prisma.client.update({ where: { id }, data: { active: false }, select: CLIENT_SELECT })
  }

  async activate(id: string) {
    await this.findOne(id)
    return this.prisma.client.update({ where: { id }, data: { active: true }, select: CLIENT_SELECT })
  }
}
