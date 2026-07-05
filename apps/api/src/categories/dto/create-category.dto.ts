import { IsInt, IsOptional, IsString, MinLength } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  name: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number
}
