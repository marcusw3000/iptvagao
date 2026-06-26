import { IsEmail, IsEnum, IsOptional, IsString, Matches } from 'class-validator'
import { UserRole } from '@prisma/client'

export class CreateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string

  @IsString()
  @Matches(/^[a-z]{4}$/, { message: 'username must be exactly 4 lowercase letters' })
  username: string

  @IsString()
  @Matches(/^\d{6}$/, { message: 'password must be exactly 6 digits' })
  password: string

  @IsEnum(UserRole)
  role: UserRole

  @IsString()
  @IsOptional()
  clientId?: string

  @IsString()
  @IsOptional()
  resellerId?: string
}
