import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PaginationDto } from '../common/dto/pagination.dto'

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto)
  }

  @Get()
  findAll(@Query() pagination: PaginationDto, @Query('internalOnly') internalOnly?: string) {
    return this.usersService.findAll({
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
      internalOnly: internalOnly === 'true',
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id)
  }
}
