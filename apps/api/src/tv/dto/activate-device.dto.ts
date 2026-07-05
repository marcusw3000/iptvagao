import { IsOptional, IsString, Length } from 'class-validator'

export class ActivateDeviceDto {
  @IsString()
  @Length(6, 6)
  activationCode!: string

  @IsOptional()
  @IsString()
  deviceInfo?: string
}
