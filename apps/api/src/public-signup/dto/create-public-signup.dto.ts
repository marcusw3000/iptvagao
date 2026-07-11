import { Transform } from 'class-transformer'
import { IsEmail, IsString, Length, MinLength } from 'class-validator'

export class CreatePublicSignupDto {
  @IsString()
  @MinLength(2)
  name: string

  @IsEmail()
  email: string

  @IsString()
  @MinLength(8)
  phone: string

  @Transform(({ value }) => String(value ?? '').replace(/\D/g, ''))
  @IsString()
  @Length(11, 11)
  document: string

  @IsString()
  @MinLength(6)
  password: string

  @IsString()
  @MinLength(4)
  referralCode: string

  @IsString()
  planId: string
}
