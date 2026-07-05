import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator'

export class CreatePlanDto {
  @IsString()
  @MinLength(2)
  name: string

  @IsEnum(['basic', 'premium'])
  type: string

  @IsNumber()
  @Min(0)
  price: number

  @IsInt()
  @Min(1)
  maxDevices: number

  @IsInt()
  @Min(0)
  maxChannels: number
}

export class UpdatePlanDto {
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number

  @IsInt()
  @Min(1)
  @IsOptional()
  maxDevices?: number

  @IsInt()
  @Min(0)
  @IsOptional()
  maxChannels?: number
}
