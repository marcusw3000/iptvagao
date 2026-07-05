import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { ActivateSubscriptionDto } from './dto/activate-subscription.dto'
import { CreateSubscriptionDto } from './dto/create-subscription.dto'
import { ChangePlanDto } from './dto/change-plan.dto'
import { FindSubscriptionsQueryDto } from './dto/find-subscriptions-query.dto'
import { SubscriptionsService } from './subscriptions.service'

const ADMIN_ROLES = [UserRole.master_admin, UserRole.support, UserRole.financial]

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @Roles(...ADMIN_ROLES)
  findAll(@Query() query: FindSubscriptionsQueryDto) {
    return this.subscriptionsService.findAll({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
    })
  }

  @Post()
  @Roles(...ADMIN_ROLES)
  create(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(dto)
  }

  @Get('by-client/:clientId')
  findByClient(@Param('clientId') clientId: string) {
    return this.subscriptionsService.findByClient(clientId)
  }

  @Patch(':id/cancel')
  @Roles(...ADMIN_ROLES)
  cancel(@Param('id') id: string) {
    return this.subscriptionsService.cancel(id)
  }

  @Patch(':id/activate')
  @Roles(...ADMIN_ROLES)
  activate(@Param('id') id: string, @Body() dto: ActivateSubscriptionDto) {
    return this.subscriptionsService.activate(id, dto)
  }

  @Patch(':id/change-plan')
  @Roles(...ADMIN_ROLES)
  changePlan(@Param('id') id: string, @Body() dto: ChangePlanDto) {
    return this.subscriptionsService.changePlan(id, dto.planId)
  }
}
