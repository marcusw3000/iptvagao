import { IsOptional, IsString } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class FindClientsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  resellerId?: string

  @IsOptional()
  @IsString()
  search?: string
}
