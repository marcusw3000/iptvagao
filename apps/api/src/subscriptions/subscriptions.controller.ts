import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { SubscriptionStatus } from '@prisma/client'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ActivateSubscriptionDto } from './dto/activate-subscription.dto'
import { CreateSubscriptionDto } from './dto/create-subscription.dto'
import { SubscriptionsService } from './subscriptions.service'
import { PaginationDto } from '../common/dto/pagination.dto'

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  findAll(@Query() pagination: PaginationDto, @Query('status') status?: string) {
    return this.subscriptionsService.findAll({
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
      status: status as SubscriptionStatus | undefined,
    })
  }

  @Post()
  create(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(dto)
  }

  @Get('by-client/:clientId')
  findByClient(@Param('clientId') clientId: string) {
    return this.subscriptionsService.findByClient(clientId)
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.subscriptionsService.cancel(id)
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string, @Body() dto: ActivateSubscriptionDto) {
    return this.subscriptionsService.activate(id, dto)
  }
}
