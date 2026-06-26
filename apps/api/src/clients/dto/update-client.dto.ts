import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator'

export class UpdateClientDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsEmail()
  @IsOptional()
  email?: string

  @IsString()
  @IsOptional()
  document?: string

  @IsString()
  @IsOptional()
  phone?: string

  @IsBoolean()
  @IsOptional()
  active?: boolean
}
