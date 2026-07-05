import { Body, Controller, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { Public } from '../common/decorators/public.decorator'
import { RawBody } from '../common/decorators/raw-body.decorator'
import { CreatePaymentDto } from './dto/create-payment.dto'
import { PaymentsService } from './payments.service'

const FINANCIAL_ROLES = [UserRole.master_admin, UserRole.financial, UserRole.support]

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Webhook — no JWT, verified via HMAC
  @Public()
  @Post('webhook')
  webhook(
    @Body() body: Record<string, unknown>,
    @RawBody() rawBody: Buffer,
    @Headers('x-abacatepay-token') signature: string,
  ) {
    return this.paymentsService.handleWebhook(body, rawBody, signature)
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto)
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  createCheckout(@Body() body: { subscriptionId: string }) {
    return this.paymentsService.createCheckout(body.subscriptionId)
  }

  @Get('by-subscription/:subscriptionId')
  @UseGuards(JwtAuthGuard)
  findBySubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.paymentsService.findBySubscription(subscriptionId, { page, limit })
  }

  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @Roles(...FINANCIAL_ROLES)
  confirm(@Param('id') id: string) {
    return this.paymentsService.confirm(id)
  }
}
