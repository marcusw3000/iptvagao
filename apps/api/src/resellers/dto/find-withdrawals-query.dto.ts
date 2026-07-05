import { IsEnum, IsOptional } from 'class-validator'
import { WithdrawalStatus } from '@prisma/client'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class FindWithdrawalsQueryDto extends PaginationDto {
  @IsEnum(WithdrawalStatus)
  @IsOptional()
  status?: WithdrawalStatus
}
