import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateChannelDto, UpdateChannelDto } from './dto/create-channel.dto'

const CHANNEL_SELECT = {
  id: true,
  clientId: true,
  categoryId: true,
  name: true,
  url: true,
  logoUrl: true,
  order: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateChannelDto) {
    return this.prisma.channel.create({ data: dto, select: CHANNEL_SELECT })
  }

  async findByClient(clientId: string, { page = 1, limit = 20 }: { page: number; limit: number }) {
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.channel.findMany({
        where: { clientId },
        skip,
        take: limit,
        select: CHANNEL_SELECT,
        orderBy: { order: 'asc' },
      }),
      this.prisma.channel.count({ where: { clientId } }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id }, select: CHANNEL_SELECT })
    if (!channel) throw new NotFoundException('Canal não encontrado')
    return channel
  }

  async update(id: string, dto: UpdateChannelDto) {
    await this.findOne(id)
    return this.prisma.channel.update({ where: { id }, data: dto, select: CHANNEL_SELECT })
  }

  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.channel.delete({ where: { id } })
  }
}
