import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { DevicesService } from './devices.service'
import { CreateDeviceDto } from './dto/create-device.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { PaginationDto } from '../common/dto/pagination.dto'

const ADMIN_ROLES = [UserRole.master_admin, UserRole.support]

type AuthUser = { role: UserRole; clientId: string | null }

const isAdmin = (user: AuthUser) => (ADMIN_ROLES as UserRole[]).includes(user.role)

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @Roles(...ADMIN_ROLES)
  create(@Body() dto: CreateDeviceDto) {
    return this.devicesService.create(dto)
  }

  @Post('self-register')
  selfRegister(@CurrentUser() user: { clientId: string | null }, @Body() body?: { name?: string }) {
    if (!user.clientId) throw new ForbiddenException('Usuário não vinculado a um cliente')
    return this.devicesService.selfRegister(user.clientId, body?.name)
  }

  @Get('monitoring')
  @Roles(...ADMIN_ROLES)
  findAllForMonitoring(@Query() pagination: PaginationDto) {
    return this.devicesService.findAllForMonitoring({
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 50,
    })
  }

  @Get('by-client/:clientId')
  findByClient(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Query() pagination: PaginationDto,
  ) {
    if (!isAdmin(user) && user.clientId !== clientId) {
      throw new ForbiddenException('Acesso negado')
    }
    return this.devicesService.findByClient(clientId, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
    })
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const device = await this.devicesService.findOne(id)
    if (!isAdmin(user) && user.clientId !== device.clientId) {
      throw new ForbiddenException('Acesso negado')
    }
    return device
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const device = await this.devicesService.findOne(id)
    if (!isAdmin(user) && user.clientId !== device.clientId) {
      throw new ForbiddenException('Acesso negado')
    }
    return this.devicesService.remove(id)
  }
}
