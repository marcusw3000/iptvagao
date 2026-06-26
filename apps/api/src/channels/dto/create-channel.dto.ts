import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateChannelDto {
  @IsString()
  clientId: string

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
}
