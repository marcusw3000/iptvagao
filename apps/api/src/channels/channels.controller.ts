import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ChannelsService } from './channels.service'
import { CreateChannelDto, UpdateChannelDto } from './dto/create-channel.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PaginationDto } from '../common/dto/pagination.dto'

@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post()
  create(@Body() dto: CreateChannelDto) {
    return this.channelsService.create(dto)
  }

  @Get('by-client/:clientId')
  findByClient(@Param('clientId') clientId: string, @Query() pagination: PaginationDto) {
    return this.channelsService.findByClient(clientId, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.channelsService.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateChannelDto) {
    return this.channelsService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.channelsService.remove(id)
  }
}
