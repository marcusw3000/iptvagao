import { IsEmail, IsString, MinLength } from 'class-validator'

export class CreatePublicSignupDto {
  @IsString()
  @MinLength(2)
  name: string

  @IsEmail()
  email: string

  @IsString()
  @MinLength(8)
  phone: string

  @IsString()
  @MinLength(4)
  referralCode: string

  @IsString()
  planId: string
}
