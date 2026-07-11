import { Transform } from 'class-transformer'
import { IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class UpdateReferralCodeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'O codigo deve conter apenas letras e numeros',
  })
  referralCode: string
}
