import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { CategoriesService } from './categories.service'
import { CreateCategoryDto } from './dto/create-category.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto)
  }

  @Get()
  findAll() {
    return this.categoriesService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: { name?: string; order?: number }) {
    return this.categoriesService.update(id, data)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id)
  }
}
