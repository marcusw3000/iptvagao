import { IsEmail, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateResellerDto {
  @IsString()
  @MinLength(2)
  name: string

  @IsEmail()
  email: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPct?: number
}
