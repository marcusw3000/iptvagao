import { IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateWithdrawalDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number

  @IsOptional()
  @IsString()
  pixKey?: string
}
