import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class CreateClientDto {
  @IsString()
  @MinLength(2)
  name: string

  @IsEmail()
  email: string

  @IsString()
  @IsOptional()
  document?: string

  @IsString()
  @IsOptional()
  phone?: string

  @IsString()
  @IsOptional()
  resellerId?: string
}
