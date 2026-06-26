import { IsInt, IsOptional, IsString, MinLength } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateCategoryDto {
  @IsString()
  clientId: string

  @IsString()
  @MinLength(1)
  name: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number
}
