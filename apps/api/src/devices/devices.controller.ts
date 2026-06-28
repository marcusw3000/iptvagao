import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { DevicesService } from './devices.service'
import { CreateDeviceDto } from './dto/create-device.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PaginationDto } from '../common/dto/pagination.dto'

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  create(@Body() dto: CreateDeviceDto) {
    return this.devicesService.create(dto)
  }

  @Get('monitoring')
  findAllForMonitoring(@Query() pagination: PaginationDto) {
    return this.devicesService.findAllForMonitoring({
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 50,
    })
  }

  @Get('by-client/:clientId')
  findByClient(@Param('clientId') clientId: string, @Query() pagination: PaginationDto) {
    return this.devicesService.findByClient(clientId, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.devicesService.findOne(id)
  }

  @Post(':id/activation-code')
  generateActivationCode(@Param('id') id: string) {
    return this.devicesService.generateActivationCode(id)
  }
}

@Controller('activate')
export class ActivateController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post(':code')
  activate(@Param('code') code: string) {
    return this.devicesService.activate(code)
  }

  @Post('heartbeat/:deviceId')
  heartbeat(@Param('deviceId') deviceId: string, @Body() body: { ipAddress?: string }) {
    return this.devicesService.heartbeat(deviceId, body.ipAddress)
  }
}
