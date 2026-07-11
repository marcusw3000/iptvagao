import { Module } from '@nestjs/common'
import { ClientsModule } from '../clients/clients.module'
import { PaymentsModule } from '../payments/payments.module'
import { PlansModule } from '../plans/plans.module'
import { PrismaModule } from '../prisma/prisma.module'
import { ResellersModule } from '../resellers/resellers.module'
import { SubscriptionsModule } from '../subscriptions/subscriptions.module'
import { PublicSignupController } from './public-signup.controller'
import { PublicSignupService } from './public-signup.service'

@Module({
  imports: [
    PrismaModule,
    ClientsModule,
    PaymentsModule,
    PlansModule,
    ResellersModule,
    SubscriptionsModule,
  ],
  controllers: [PublicSignupController],
  providers: [PublicSignupService],
})
export class PublicSignupModule {}
