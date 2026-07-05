import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { ClientsService } from './clients.service'
import { CreateClientDto } from './dto/create-client.dto'
import { UpdateClientDto } from './dto/update-client.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { PaginationDto } from '../common/dto/pagination.dto'

const ADMIN_ROLES = [UserRole.master_admin, UserRole.support, UserRole.financial]

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Roles(...ADMIN_ROLES)
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto)
  }

  @Get()
  findAll(
    @Query() pagination: PaginationDto,
    @Query('resellerId') resellerId?: string,
    @Query('search') search?: string,
  ) {
    return this.clientsService.findAll({
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
      resellerId,
      search,
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id)
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto)
  }

  @Patch(':id/suspend')
  @Roles(...ADMIN_ROLES)
  suspend(@Param('id') id: string) {
    return this.clientsService.suspend(id)
  }

  @Patch(':id/activate')
  @Roles(...ADMIN_ROLES)
  activate(@Param('id') id: string) {
    return this.clientsService.activate(id)
  }

  @Get(':id/credentials')
  getCredentials(@Param('id') id: string) {
    return this.clientsService.getCredentials(id)
  }

  @Post(':id/reset-credentials')
  @HttpCode(HttpStatus.OK)
  @Roles(...ADMIN_ROLES)
  resetCredentials(@Param('id') id: string) {
    return this.clientsService.resetCredentials(id)
  }
}
