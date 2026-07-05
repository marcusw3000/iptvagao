import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TvController } from './tv.controller'
import { TvService } from './tv.service'
import { DeviceAuthGuard } from './guards/device-auth.guard'
import { ChannelsModule } from '../channels/channels.module'
import { DevicesModule } from '../devices/devices.module'

@Module({
  imports: [
    ChannelsModule,
    DevicesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [TvController],
  providers: [TvService, DeviceAuthGuard],
})
export class TvModule {}
