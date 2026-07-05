import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { ChannelsService } from './channels.service'
import { CreateChannelDto, FindChannelsQueryDto, UpdateChannelDto } from './dto/create-channel.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'

const ADMIN_ROLES = [UserRole.master_admin, UserRole.support]

@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post()
  create(@Body() dto: CreateChannelDto) {
    return this.channelsService.create(dto)
  }

  @Post('import-m3u')
  @Roles(...ADMIN_ROLES)
  importM3u(@Body() body: { url: string }) {
    return this.channelsService.importFromM3u(body.url)
  }

  @Get('for-client/:clientId')
  findForClient(@Param('clientId') clientId: string) {
    return this.channelsService.findForClient(clientId)
  }

  @Get()
  findAll(@Query() query: FindChannelsQueryDto) {
    return this.channelsService.findAll({ page: query.page ?? 1, limit: query.limit ?? 50 })
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
