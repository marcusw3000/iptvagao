import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { TvService } from './tv.service'
import { TorrentioService } from './torrentio.service'
import { VodService } from './vod.service'
import { ActivateDeviceDto } from './dto/activate-device.dto'
import { Public } from '../common/decorators/public.decorator'
import { DeviceAuthGuard, AuthenticatedDevice } from './guards/device-auth.guard'

@Controller('tv')
export class TvController {
  constructor(
    private readonly tvService: TvService,
    private readonly torrentioService: TorrentioService,
    private readonly vodService: VodService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('activate')
  activate(@Body() dto: ActivateDeviceDto, @Req() req: { headers: Record<string, string | undefined> }) {
    return this.tvService.activate(dto.activationCode, dto.deviceInfo ?? req.headers['user-agent'])
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Get('channels')
  channels(@Req() req: { device: AuthenticatedDevice }) {
    return this.tvService.channelsForClient(req.device.clientId, req.device.deviceId)
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Post('heartbeat')
  heartbeat(@Req() req: { device: AuthenticatedDevice; ip?: string }) {
    return this.tvService.heartbeat(req.device.deviceId, req.ip)
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Post('favorites/:channelId')
  addFavorite(@Req() req: { device: AuthenticatedDevice }, @Param('channelId') channelId: string) {
    return this.tvService.addFavorite(req.device.deviceId, channelId)
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Delete('favorites/:channelId')
  removeFavorite(@Req() req: { device: AuthenticatedDevice }, @Param('channelId') channelId: string) {
    return this.tvService.removeFavorite(req.device.deviceId, channelId)
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Get('account')
  account(@Req() req: { device: AuthenticatedDevice }) {
    return this.tvService.accountInfo(req.device.clientId)
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Get('torrentio/manifest')
  torrentioManifest() {
    return this.torrentioService.manifest()
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Get('torrentio/stream')
  torrentioStream(
    @Query('type') type: string,
    @Query('id') id: string,
    @Query('quality') quality?: string,
  ) {
    return this.torrentioService.stream(type, id, quality)
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Get('torrentio/catalog')
  torrentioCatalog(@Query('type') type: string, @Query('page') page = '1') {
    return this.torrentioService.catalog(type, Number(page))
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Get('torrentio/search')
  torrentioSearch(@Query('q') q: string) {
    return this.torrentioService.search(q)
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Get('vod/catalog')
  vodCatalog(
    @Query('type') type = 'movie',
    @Query('page') page = '1',
    @Query('limit') limit = '24',
  ) {
    return this.vodService.catalog(type, Number(page), Number(limit))
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Get('vod/search')
  vodSearch(@Query('q') q: string) {
    return this.vodService.search(q ?? '')
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Get('vod/item/:id')
  vodItem(@Param('id') id: string) {
    return this.vodService.item(id)
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Get('vod/streams/:id')
  vodStreams(@Param('id') id: string) {
    return { streams: this.vodService.streams(id) }
  }
}
