import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import * as bcrypt from 'bcrypt'
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
  reseller: { select: { id: true, name: true } },
  subscription: { select: { status: true, plan: { select: { name: true } } } },
} as const

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateClientDto) {
    const exists = await this.prisma.client.findUnique({ where: { email: dto.email } })
    if (exists) throw new ConflictException('Email já utilizado')

    const credentials = await this.usersService.generateClientCredentials()

    let client: Awaited<ReturnType<typeof this.prisma.client.create>>
    try {
      client = await this.prisma.client.create({ data: dto, select: CLIENT_SELECT })
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Email já utilizado')
      throw e
    }

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

  async findAll({
    page = 1,
    limit = 20,
    resellerId,
    search,
  }: {
    page: number
    limit: number
    resellerId?: string
    search?: string
  }) {
    const skip = (page - 1) * limit
    const where: any = {}
    if (resellerId) where.resellerId = resellerId
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }
    const hasWhere = Object.keys(where).length > 0
    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        skip,
        take: limit,
        select: CLIENT_SELECT,
        orderBy: { createdAt: 'desc' },
        where: hasWhere ? where : undefined,
      }),
      this.prisma.client.count({ where: hasWhere ? where : undefined }),
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

  async getCredentials(clientId: string): Promise<{ username: string }> {
    await this.findOne(clientId)
    const user = await this.prisma.user.findFirst({
      where: { clientId, role: 'client_admin' },
      select: { username: true },
    })
    if (!user) throw new NotFoundException('Credenciais não encontradas')
    return { username: user.username }
  }

  async resetCredentials(clientId: string): Promise<{ username: string; password: string }> {
    await this.findOne(clientId)
    const user = await this.prisma.user.findFirst({
      where: { clientId, role: 'client_admin' },
      select: { id: true },
    })
    if (!user) throw new NotFoundException('Usuário do cliente não encontrado')

    const credentials = await this.usersService.generateClientCredentials()
    const hashedPassword = await bcrypt.hash(credentials.password, 10)

    await this.prisma.user.update({
      where: { id: user.id },
      data: { username: credentials.username, password: hashedPassword },
    })

    return credentials
  }
}
