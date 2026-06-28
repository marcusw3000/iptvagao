import { IsDateString, IsOptional, IsString } from 'class-validator'

export class CreateSubscriptionDto {
  @IsString()
  clientId: string

  @IsString()
  planId: string

  @IsDateString()
  @IsOptional()
  endDate?: string
}
