import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator'
import { Type } from 'class-transformer'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class CreateChannelDto {
  @IsString()
  @IsOptional()
  categoryId?: string

  @IsString()
  @MinLength(1)
  name: string

  @IsString()
  url: string

  @IsString()
  @IsOptional()
  logoUrl?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  planIds?: string[]
}

export class UpdateChannelDto {
  @IsString()
  @IsOptional()
  categoryId?: string

  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  url?: string

  @IsString()
  @IsOptional()
  logoUrl?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number

  @IsBoolean()
  @IsOptional()
  active?: boolean

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  planIds?: string[]
}

export class FindChannelsQueryDto extends PaginationDto {}
