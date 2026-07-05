import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { FindUsersQueryDto } from './dto/find-users-query.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto)
  }

  @Get()
  findAll(@Query() query: FindUsersQueryDto) {
    return this.usersService.findAll({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      internalOnly: query.internalOnly === 'true',
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id)
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id)
  }

  @Patch(':id/activate')
  activateUser(@Param('id') id: string) {
    return this.usersService.activateUser(id)
  }
}
