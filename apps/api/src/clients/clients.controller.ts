import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ClientsService } from './clients.service'
import { CreateClientDto } from './dto/create-client.dto'
import { UpdateClientDto } from './dto/update-client.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PaginationDto } from '../common/dto/pagination.dto'

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto)
  }

  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.clientsService.findAll({ page: pagination.page ?? 1, limit: pagination.limit ?? 20 })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto)
  }

  @Patch(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.clientsService.suspend(id)
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.clientsService.activate(id)
  }
}
