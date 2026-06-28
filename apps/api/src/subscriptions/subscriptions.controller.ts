import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ActivateSubscriptionDto } from './dto/activate-subscription.dto'
import { CreateSubscriptionDto } from './dto/create-subscription.dto'
import { SubscriptionsService } from './subscriptions.service'

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

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
