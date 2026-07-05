import { Module } from '@nestjs/common'
import { EpgController } from './epg.controller'
import { EpgService } from './epg.service'
import { EpgScheduler } from './epg.scheduler'

@Module({
  controllers: [EpgController],
  providers: [EpgService, EpgScheduler],
  exports: [EpgService],
})
export class EpgModule {}
