import { Module } from '@nestjs/common'
import { AbacatepayService } from './abacatepay.service'

@Module({
  providers: [AbacatepayService],
  exports: [AbacatepayService],
})
export class AbacatepayModule {}
