import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TvController } from './tv.controller'
import { TvService } from './tv.service'
import { TorrentioService } from './torrentio.service'
import { VodService } from './vod.service'
import { DeviceAuthGuard } from './guards/device-auth.guard'
import { ChannelsModule } from '../channels/channels.module'
import { DevicesModule } from '../devices/devices.module'
import { EpgModule } from '../epg/epg.module'

@Module({
  imports: [
    ChannelsModule,
    DevicesModule,
    EpgModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [TvController],
  providers: [TvService, TorrentioService, VodService, DeviceAuthGuard],
  exports: [TorrentioService],
})
export class TvModule {}
