import { IsIn, IsOptional } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class FindUsersQueryDto extends PaginationDto {
  @IsIn(['true', 'false'])
  @IsOptional()
  internalOnly?: string
}
