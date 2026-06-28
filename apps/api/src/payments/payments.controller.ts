import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CreatePaymentDto } from './dto/create-payment.dto'
import { PaymentsService } from './payments.service'

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto)
  }

  @Get('by-subscription/:subscriptionId')
  findBySubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.paymentsService.findBySubscription(subscriptionId, { page, limit })
  }

  @Patch(':id/confirm')
  confirm(@Param('id') id: string) {
    return this.paymentsService.confirm(id)
  }
}
