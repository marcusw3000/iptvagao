import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { TvService } from './tv.service'
import { ActivateDeviceDto } from './dto/activate-device.dto'
import { Public } from '../common/decorators/public.decorator'
import { DeviceAuthGuard, AuthenticatedDevice } from './guards/device-auth.guard'

@Controller('tv')
export class TvController {
  constructor(private readonly tvService: TvService) {}

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
}
