import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCategoryDto } from './dto/create-category.dto'

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: dto })
  }

  async findByClient(clientId: string) {
    return this.prisma.category.findMany({
      where: { clientId },
      orderBy: { order: 'asc' },
    })
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } })
    if (!category) throw new NotFoundException('Categoria não encontrada')
    return category
  }

  async update(id: string, data: Partial<{ name: string; order: number }>) {
    await this.findOne(id)
    return this.prisma.category.update({ where: { id }, data })
  }

  async remove(id: string) {
    await this.findOne(id)
    return this.prisma.category.delete({ where: { id } })
  }
}
