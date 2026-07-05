import { Module } from '@nestjs/common'
import { AbacatepayModule } from '../abacatepay/abacatepay.module'
import { PrismaModule } from '../prisma/prisma.module'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'

@Module({
  imports: [PrismaModule, AbacatepayModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
