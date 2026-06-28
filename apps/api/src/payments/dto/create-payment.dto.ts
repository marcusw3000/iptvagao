import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator'
import { PaymentMethod } from '@prisma/client'

export class CreatePaymentDto {
  @IsString()
  subscriptionId: string

  @IsNumberString()
  amount: string

  @IsEnum(PaymentMethod)
  method: PaymentMethod

  @IsString()
  @IsOptional()
  reference?: string
}
