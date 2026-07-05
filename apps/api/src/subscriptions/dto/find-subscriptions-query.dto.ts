import { IsEnum, IsOptional } from 'class-validator'
import { SubscriptionStatus } from '@prisma/client'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class FindSubscriptionsQueryDto extends PaginationDto {
  @IsEnum(SubscriptionStatus)
  @IsOptional()
  status?: SubscriptionStatus
}
