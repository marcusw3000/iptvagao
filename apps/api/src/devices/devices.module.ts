import { Module } from '@nestjs/common'
import { DevicesService } from './devices.service'
import { DevicesController, ActivateController } from './devices.controller'

@Module({
  controllers: [DevicesController, ActivateController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
