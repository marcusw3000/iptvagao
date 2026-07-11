import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { RolesGuard } from './common/guards/roles.guard'
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { ClientsModule } from './clients/clients.module'
import { PlansModule } from './plans/plans.module'
import { DevicesModule } from './devices/devices.module'
import { CategoriesModule } from './categories/categories.module'
import { ChannelsModule } from './channels/channels.module'
import { SubscriptionsModule } from './subscriptions/subscriptions.module'
import { PaymentsModule } from './payments/payments.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { ResellersModule } from './resellers/resellers.module'
import { UploadsModule } from './uploads/uploads.module'
import { TvModule } from './tv/tv.module'
import { EpgModule } from './epg/epg.module'
import { AppReleasesModule } from './app-releases/app-releases.module'
import { PublicSignupModule } from './public-signup/public-signup.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    PlansModule,
    DevicesModule,
    CategoriesModule,
    ChannelsModule,
    SubscriptionsModule,
    PaymentsModule,
    DashboardModule,
    ResellersModule,
    UploadsModule,
    TvModule,
    EpgModule,
    AppReleasesModule,
    PublicSignupModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
