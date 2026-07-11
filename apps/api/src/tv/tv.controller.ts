import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import { createReadStream } from 'fs'
import { FastifyReply } from 'fastify'
import { Throttle } from '@nestjs/throttler'
import { TvService } from './tv.service'
import { TorrentioService } from './torrentio.service'
import { VodService } from './vod.service'
import { TorrentEngineService } from './torrent-engine.service'
import { ActivateDeviceDto } from './dto/activate-device.dto'
import { Public } from '../common/decorators/public.decorator'
import { DeviceAuthGuard, AuthenticatedDevice } from './guards/device-auth.guard'

@Controller('tv')
export class TvController {
  constructor(
    private readonly tvService: TvService,
    private readonly torrentioService: TorrentioService,
    private readonly vodService: VodService,
    private readonly torrentEngineService: TorrentEngineService,
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
  @Get('torrent/prepare')
  async prepareTorrent(@Query('source') source: string) {
    return this.torrentEngineService.prepareStream(source)
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Get('torrent/file/:id')
  async torrentFile(@Param('id') id: string, @Res({ passthrough: true }) reply: FastifyReply) {
    const file = await this.torrentEngineService.getFile(id)
    reply.header('Content-Type', file.mimeType)
    reply.header('Cache-Control', 'no-store')
    reply.header('Content-Disposition', `inline; filename="${file.fileName}"`)
    return reply.send(createReadStream(file.filePath))
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Get('vod/catalog')
  vodCatalog(
    @Query('type') type = 'movie',
    @Query('page') page = '1',
    @Query('limit') limit = '24',
    @Query('genre') genre?: string,
  ) {
    return this.vodService.catalog(type, Number(page), Number(limit), genre)
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
  vodItem(@Param('id') id: string, @Query('type') type?: string) {
    return this.vodService.item(id, type)
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Get('vod/streams/:id')
  async vodStreams(@Param('id') id: string, @Query('videoId') videoId?: string, @Query('type') type?: string) {
    return { streams: await this.vodService.streamsDebug(id, videoId, type).then((result) => result.streams) }
  }

  @Public()
  @UseGuards(DeviceAuthGuard)
  @Get('vod/streams/:id/raw')
  async vodStreamsRaw(@Param('id') id: string, @Query('videoId') videoId?: string, @Query('type') type?: string) {
    return await this.vodService.streamsDebug(id, videoId, type)
  }
}
