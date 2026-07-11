import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Public } from '../common/decorators/public.decorator'
import { CreatePublicSignupDto } from './dto/create-public-signup.dto'
import { PublicSignupService } from './public-signup.service'

@Controller('public/signup')
export class PublicSignupController {
  constructor(private readonly publicSignupService: PublicSignupService) {}

  @Public()
  @Get('referral-code/:referralCode')
  resolveReferralCode(@Param('referralCode') referralCode: string) {
    return this.publicSignupService.resolveReferralCode(referralCode)
  }

  @Public()
  @Get('plans')
  listPlans() {
    return this.publicSignupService.listPlans()
  }

  @Public()
  @Post('onboard')
  onboard(@Body() dto: CreatePublicSignupDto) {
    return this.publicSignupService.onboard(dto)
  }
}
