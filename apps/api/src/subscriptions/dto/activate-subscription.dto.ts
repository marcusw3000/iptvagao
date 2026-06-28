import { IsDateString } from 'class-validator'

export class ActivateSubscriptionDto {
  @IsDateString()
  endDate: string
}
