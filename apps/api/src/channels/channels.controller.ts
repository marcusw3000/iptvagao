import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { ChannelsService } from './channels.service'
import { FavoritesService } from './favorites.service'
import { CreateChannelDto, FindChannelsQueryDto, UpdateChannelDto } from './dto/create-channel.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'

const ADMIN_ROLES = [UserRole.master_admin, UserRole.support]
type AuthUser = { role: UserRole; clientId: string | null }
const isAdmin = (user: AuthUser) => (ADMIN_ROLES as UserRole[]).includes(user.role)

@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly favoritesService: FavoritesService,
  ) {}

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
  async findForClient(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    if (!isAdmin(user) && user.clientId !== clientId) {
      throw new ForbiddenException('Acesso negado')
    }

    const channels = await this.channelsService.findForClient(clientId)
    return this.favoritesService.annotateChannels(clientId, channels)
  }

  @Post('favorites/:channelId')
  addFavorite(
    @CurrentUser() user: AuthUser,
    @Param('channelId') channelId: string,
    @Query('clientId') clientId?: string,
  ) {
    const authorizedClientId = this.resolveAuthorizedClientId(user, clientId)
    return this.favoritesService.addFavorite(authorizedClientId, channelId)
  }

  @Delete('favorites/:channelId')
  removeFavorite(
    @CurrentUser() user: AuthUser,
    @Param('channelId') channelId: string,
    @Query('clientId') clientId?: string,
  ) {
    const authorizedClientId = this.resolveAuthorizedClientId(user, clientId)
    return this.favoritesService.removeFavorite(authorizedClientId, channelId)
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

  private resolveAuthorizedClientId(user: AuthUser, requestedClientId?: string) {
    if (requestedClientId) {
      if (!isAdmin(user) && user.clientId !== requestedClientId) {
        throw new ForbiddenException('Acesso negado')
      }
      return requestedClientId
    }

    if (!user.clientId) {
      throw new ForbiddenException('Usuário não vinculado a um cliente')
    }

    return user.clientId
  }
}
